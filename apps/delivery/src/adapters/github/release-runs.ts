import type { CommandRunner } from '../../application/ports/command-runner';
import type { ReleaseRuns } from '../../application/ports/release-runs';
import type { Sleep } from '../../application/ports/sleep';
import type { RunOutcome } from '../../domain/release-plan';
import { REQUIRED_WORKFLOWS } from '../../domain/release-rules';

const GH_LIMIT_MS = 60_000;
const RELEASE_POLL_MS = 3_000;
const RELEASE_POLL_TRIES = 10;

type GhRun = { status: string; conclusion: string; url: string };

/** The workflow runs of a commit, read with `gh run list` in the repository at `cwd`. */
export const createGithubReleaseRuns = (
  runner: CommandRunner,
  cwd: string,
  sleep: Sleep,
): ReleaseRuns => {
  const gh = async (args: string[]): Promise<string> => {
    const result = await runner.run('gh', args, {
      cwd,
      timeoutMs: GH_LIMIT_MS,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `gh ${args[0]} ${args[1]} failed (${result.exitCode}): ${result.stderr.trim()}`,
      );
    }
    return result.stdout;
  };

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
    async requiredRuns(sha) {
      const outcomes: RunOutcome[] = [];
      for (const workflow of REQUIRED_WORKFLOWS) {
        const [newest] = await listRuns(sha, workflow);
        if (newest === undefined) {
          outcomes.push({ workflow, state: 'pending', url: null });
          continue;
        }
        const state =
          newest.status !== 'completed'
            ? 'pending'
            : newest.conclusion === 'success'
              ? 'success'
              : 'failed';
        outcomes.push({ workflow, state, url: newest.url });
      }
      return outcomes;
    },

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
