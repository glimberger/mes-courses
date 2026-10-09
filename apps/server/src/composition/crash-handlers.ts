import type { ErrorReporter } from '../application/ports/error-reporter';

/** The slice of `process` the handlers use, so a test can inject an event emitter. */
export type ProcessLike = {
  on(
    event: 'uncaughtException' | 'unhandledRejection',
    fn: (error: unknown) => void,
  ): unknown;
};

/**
 * Reports a crash and exits non-zero so systemd restarts the service (FR-022a). `exit` runs after
 * the report whatever the reporter does.
 */
export const installCrashHandlers = (
  proc: ProcessLike,
  reporter: ErrorReporter,
  exit: (code: number) => void,
): void => {
  const onCrash = (error: unknown) => {
    try {
      reporter.report(error, { operation: 'process', route: 'none' });
    } finally {
      exit(1);
    }
  };
  proc.on('uncaughtException', onCrash);
  proc.on('unhandledRejection', onCrash);
};
