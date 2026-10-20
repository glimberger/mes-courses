import type { CommandRunner } from '../../application/ports/command-runner';
import type { ReleaseRuns } from '../../application/ports/release-runs';
import type { Sleep } from '../../application/ports/sleep';
import type { RunOutcome } from '../../domain/release-plan';
import { REQUIRED_WORKFLOWS } from '../../domain/release-rules';
import { createGh } from './gh';

const RELEASE_POLL_MS = 3_000;
const RELEASE_POLL_TRIES = 10;

type GhRun = { status: string; conclusion: string; url: string };

/** The workflow runs of a commit, read with `gh run list` in the repository at `cwd`. */
export const createGithubReleaseRuns = (
  runner: CommandRunner,
  cwd: string,
  sleep: Sleep,
): ReleaseRuns => {
  const gh = createGh(runner, cwd);

  /** The runs of a workflow on a commit, newest first. */
  const listRuns = async (sha: string, workflow: string): Promise<GhRun[]> =>
    JSON.parse(
      await gh([
        'run',
        'list',
        '--commit',
        sha,
        '--workflow',
        workflow,
        '--json',
        'conclusion,status,url',
        '--limit',
        '20',
      ]),
    ) as GhRun[];

  return {
    /**
     * The rule of the Release gate (`run-history`): a workflow passes as soon as one of its runs on
     * the commit succeeded, so a later re-run that fails does not undo it.
     */
    requiredRuns: (sha) =>
      Promise.all(
        REQUIRED_WORKFLOWS.map(async (workflow): Promise<RunOutcome> => {
          const list = await listRuns(sha, workflow);
          const succeeded = list.find(
            (run) => run.status === 'completed' && run.conclusion === 'success',
          );
          if (succeeded !== undefined)
            return { workflow, state: 'success', url: succeeded.url };
          const [newest] = list;
          if (newest === undefined)
            return { workflow, state: 'pending', url: null };
          const open = list.find((run) => run.status !== 'completed');
          return open !== undefined
            ? { workflow, state: 'pending', url: open.url }
            : { workflow, state: 'failed', url: newest.url };
        }),
      ),

    async releaseRunUrl(sha) {
      for (let attempt = 0; attempt < RELEASE_POLL_TRIES; attempt += 1) {
        const [run] = await listRuns(sha, 'Release');
        if (run !== undefined) return run.url;
        await sleep(RELEASE_POLL_MS);
      }
      const repository = (
        await gh(['repo', 'view', '--json', 'url', '--jq', '.url'])
      ).trim();
      return `${repository}/actions`;
    },
  };
};
