export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** True when the time limit killed the command. */
  timedOut: boolean;
};

export interface CommandRunner {
  /** Runs `command` with an argument array, never a shell string. */
  run(
    command: string,
    args: string[],
    options?: { timeoutMs?: number; cwd?: string },
  ): Promise<CommandResult>;
}
