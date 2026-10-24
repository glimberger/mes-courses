import type { CommandRunner } from '../../application/ports/command-runner';
import type { ReleasePullRequests } from '../../application/ports/release-pull-requests';
import type { BumpPullRequest } from '../../domain/release-plan';
import { createGh } from './gh';

const FAILED_CONCLUSIONS = [
  'FAILURE',
  'TIMED_OUT',
  'STARTUP_FAILURE',
  'CANCELLED',
  'ACTION_REQUIRED',
];
// A commit status (not a check run) has a `state` and no `conclusion`.
const FAILED_STATES = ['FAILURE', 'ERROR'];

type GhPullRequest = {
  state: string;
  url: string;
  mergeCommit: { oid: string } | null;
  statusCheckRollup: { conclusion?: string; state?: string }[] | null;
  autoMergeRequest?: object | null;
};

const toBump = (pr: GhPullRequest): BumpPullRequest => ({
  state:
    pr.state === 'OPEN' ? 'open' : pr.state === 'MERGED' ? 'merged' : 'closed',
  url: pr.url,
  mergeCommit: pr.mergeCommit?.oid ?? null,
  checksFailed: (pr.statusCheckRollup ?? []).some(
    (check) =>
      FAILED_CONCLUSIONS.includes(check.conclusion ?? '') ||
      FAILED_STATES.includes(check.state ?? ''),
  ),
  autoMergeEnabled: pr.autoMergeRequest != null,
});

/** The pull request of a release bump, through `gh` run in the repository at `cwd`. */
export const createGithubReleasePullRequests = (
  runner: CommandRunner,
  cwd: string,
): ReleasePullRequests => {
  const gh = createGh(runner, cwd);

  const findBump = async (branch: string) => {
    const out = await gh([
      'pr',
      'list',
      '--head',
      branch,
      '--state',
      'all',
      '--json',
      'number,state,url,mergeCommit,statusCheckRollup,autoMergeRequest',
    ]);
    const all = (JSON.parse(out) as GhPullRequest[]).map(toBump);
    // Open first, then merged; a closed one is reported so that the run can stop on it.
    return (
      ['open', 'merged', 'closed']
        .map((state) => all.find((pr) => pr.state === state))
        .find((pr) => pr !== undefined) ?? null
    );
  };

  return {
    findBump,

    async open(branch, title) {
      await gh([
        'pr',
        'create',
        '--head',
        branch,
        '--base',
        'main',
        '--title',
        title,
        '--body',
        'Release bump opened by `pnpm release`.',
      ]);
      const pr = await findBump(branch);
      if (pr === null) {
        throw new Error(`gh created no pull request for ${branch}`);
      }
      return pr;
    },

    async enableAutoMerge(pr) {
      await gh([
        'pr',
        'merge',
        pr.url,
        '--auto',
        '--squash',
        '--delete-branch',
      ]);
    },
  };
};
