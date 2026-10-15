import type { CommandRunner } from '../../application/ports/command-runner';
import type { RunHistory } from '../../application/ports/run-history';

const GH_LIMIT_MS = 60_000;

/** Reads the workflow runs of a commit with `gh run list`. */
export const createGithubRunHistory = (
  runner: CommandRunner,
  repository: string,
  workflows: string[],
): RunHistory => ({
  async successfulWorkflows(commit) {
    const succeeded: string[] = [];
    for (const workflow of workflows) {
      const result = await runner.run(
        'gh',
        [
          'run',
          'list',
          '--repo',
          repository,
          '--commit',
          commit,
          '--workflow',
          workflow,
          '--json',
          'conclusion',
          '--limit',
          '50',
        ],
        { timeoutMs: GH_LIMIT_MS },
      );
      if (result.exitCode !== 0) {
        throw new Error(
          `gh run list failed for "${workflow}" (${result.exitCode}): ${result.stderr.trim()}`,
        );
      }
      const runs = JSON.parse(result.stdout) as { conclusion: string }[];
      if (runs.some((run) => run.conclusion === 'success')) {
        succeeded.push(workflow);
      }
    }
    return succeeded;
  },
});
