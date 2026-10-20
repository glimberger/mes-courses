import type { CommandRunner } from '../../application/ports/command-runner';

const GH_LIMIT_MS = 60_000;

/** Runs `gh` in the repository at `cwd`; a failure throws with the first words of the command and gh's message. */
export const createGh =
  (runner: CommandRunner, cwd: string) =>
  async (args: string[]): Promise<string> => {
    const result = await runner.run('gh', args, {
      cwd,
      timeoutMs: GH_LIMIT_MS,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `gh ${args.slice(0, 2).join(' ')} failed (${result.exitCode}): ${result.stderr.trim()}`,
      );
    }
    return result.stdout;
  };
