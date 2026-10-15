import type { CommandRunner } from '../../application/ports/command-runner';

const BUILD_LIMIT_MS = 5 * 60_000;

/** `nix build github:NixOS/nixpkgs/<rev>#nodejs_24 --out-link <release>/runtime`. */
export const buildRuntime = async (
  runner: CommandRunner,
  nixpkgsRev: string,
  outLink: string,
): Promise<void> => {
  const result = await runner.run(
    'nix',
    [
      'build',
      `github:NixOS/nixpkgs/${nixpkgsRev}#nodejs_24`,
      '--out-link',
      outLink,
    ],
    { timeoutMs: BUILD_LIMIT_MS },
  );
  if (result.timedOut) {
    throw new Error('The Node runtime build exceeded its time limit');
  }
  if (result.exitCode !== 0) {
    throw new Error(`The Node runtime build failed: ${result.stderr.trim()}`);
  }
};
