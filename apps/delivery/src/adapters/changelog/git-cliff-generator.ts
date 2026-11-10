import type { ChangelogGenerator } from '../../application/ports/changelog-generator';
import type { CommandRunner } from '../../application/ports/command-runner';
import { parseContext } from '../../domain/changelog';

const CLIFF_LIMIT_MS = 60_000;
const NOT_FOUND = 127;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/**
 * Runs git-cliff in the repository at `cwd` with the configuration `config` (research R1, R3).
 * `--unreleased` takes the commits of HEAD since the last release tag; the release prerequisites
 * make HEAD the same commit as `origin/main` (git-cliff 2.13 ignores a range given with
 * `--unreleased`). `--offline` keeps git-cliff from checking for a newer version over the network.
 */
export const createGitCliffGenerator = (
  runner: CommandRunner,
  cwd: string,
  config: string,
): ChangelogGenerator => ({
  async generate(version, date) {
    const result = await runner.run(
      'git-cliff',
      [
        '--offline',
        '--config',
        config,
        '--context',
        '--unreleased',
        '--tag',
        `v${version}`,
      ],
      { cwd, timeoutMs: CLIFF_LIMIT_MS },
    );
    if (result.exitCode === NOT_FOUND)
      throw new Error(
        'git-cliff is not installed: run the release from the Nix dev shell (nix develop)',
      );
    if (result.exitCode !== 0)
      throw new Error(
        `git-cliff failed (${result.exitCode}): ${result.stderr.replace(ANSI, '').trim()}`,
      );
    return parseContext(result.stdout, version, date);
  },
});
