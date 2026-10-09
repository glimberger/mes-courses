/** The slice of `process` the shutdown handlers use. */
export type SignalSource = {
  on(event: 'SIGTERM' | 'SIGINT', fn: () => void): unknown;
};

/**
 * Closes the server on SIGTERM/SIGINT (systemd stop or restart), so in-flight requests finish and
 * the database is closed cleanly.
 */
export const installShutdownHandlers = (
  proc: SignalSource,
  server: { close(): Promise<void> },
  exit: (code: number) => void,
): void => {
  let closing = false;
  const onSignal = () => {
    if (closing) return;
    closing = true;
    server.close().then(
      () => exit(0),
      () => exit(1),
    );
  };
  proc.on('SIGTERM', onSignal);
  proc.on('SIGINT', onSignal);
};
