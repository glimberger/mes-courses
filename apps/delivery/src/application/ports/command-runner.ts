export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** True when the time limit killed the command. */
  timedOut: boolean;
};

export interface CommandRunner {
  /**
   * Runs `command` with an argument array, never a shell string. `input` is written to its standard
   * input (so a secret or a script never shows in `ps`); without it, stdin is closed.
   */
  run(
    command: string,
    args: string[],
    options?: { timeoutMs?: number; cwd?: string; input?: string },
  ): Promise<CommandResult>;
}
