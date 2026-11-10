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

  async isAncestor(base, head) {
    const result = await runner.run(
      'git',
      ['merge-base', '--is-ancestor', base, head],
      { cwd, timeoutMs: GIT_LIMIT_MS },
    );
    if (result.exitCode === 0) return true;
    if (result.exitCode === 1) return false;
    throw new Error(
      `git merge-base failed (${result.exitCode}): ${result.stderr.trim()}`,
    );
  },

  async serverChangedBetween(base, head) {
    // The rules stay in delivery-targets.sh, the script of the staging plan: one list of the
    // paths that affect the server, whoever asks. The commits are positional arguments, never
    // part of the script text.
    const result = await runner.run(
      'sh',
      [
        '-c',
        'files=$(git diff --name-only "$1" "$2") || exit 1; printf "%s\\n" "$files" | sh .github/scripts/delivery-targets.sh',
        'sh',
        base,
        head,
      ],
      { cwd, timeoutMs: GIT_LIMIT_MS },
    );
    if (result.exitCode !== 0) {
      throw new Error(
        `git diff failed (${result.exitCode}): ${result.stderr.trim()}`,
      );
    }
    return result.stdout.split('\n').includes('server=true');
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
