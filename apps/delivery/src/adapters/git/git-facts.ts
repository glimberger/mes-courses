import type { CommandRunner } from '../../application/ports/command-runner';
import type { GitFacts } from '../../application/ports/git-facts';

const GIT_LIMIT_MS = 60_000;
const EXPO_LIMIT_MS = 5 * 60_000;

/** Git and Expo facts about a commit, read in the checked-out repository at `cwd`. */
export const createGitFacts = (
  runner: CommandRunner,
  cwd: string,
): GitFacts => ({
  async isOnMain(commit) {
    const result = await runner.run(
      'git',
      ['merge-base', '--is-ancestor', commit, 'origin/main'],
      { cwd, timeoutMs: GIT_LIMIT_MS },
    );
    if (result.exitCode === 0) return true;
    // 1 means "not an ancestor"; anything else is a failure to ask.
    if (result.exitCode === 1) return false;
    throw new Error(
      `git merge-base failed (${result.exitCode}): ${result.stderr.trim()}`,
    );
  },

  async appVersionAt(commit) {
    const head = await runner.run('git', ['rev-parse', 'HEAD'], {
      cwd,
      timeoutMs: GIT_LIMIT_MS,
    });
    if (head.stdout.trim() !== commit) {
      throw new Error(
        `The checkout is at ${head.stdout.trim()}, not at the tagged commit ${commit}`,
      );
    }
    const result = await runner.run(
      'npx',
      ['expo', 'config', '--json', '--type', 'public'],
      { cwd: `${cwd}/apps/mobile`, timeoutMs: EXPO_LIMIT_MS },
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `expo config failed (${result.exitCode}): ${result.stderr.trim()}`,
      );
    }
    const version = (JSON.parse(result.stdout) as { version?: unknown })
      .version;
    if (typeof version !== 'string') {
      throw new Error('expo config reported no app version');
    }
    return version;
  },
});
