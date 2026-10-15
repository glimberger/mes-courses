import type {
  HealthProbe,
  HealthResult,
} from '../../application/ports/health-probe';

export type HttpHealthProbeOptions = {
  /** Pause between two attempts. */
  pollMs?: number;
  /** Limit for one request. */
  requestTimeoutMs?: number;
  /** Injected by tests. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Polls `GET <baseUrl>/v1/health` until `release.commit` is the expected one or `timeoutMs` has
 * passed; the result of the last attempt tells why it did not succeed.
 */
export const waitForHealthyCommit = async (
  baseUrl: string,
  commit: string,
  timeoutMs: number,
  {
    pollMs = 1000,
    requestTimeoutMs = 2000,
    now = Date.now,
    sleep = realSleep,
  }: HttpHealthProbeOptions = {},
): Promise<HealthResult> => {
  const attempt = async (): Promise<HealthResult> => {
    try {
      const response = await fetch(`${baseUrl}/v1/health`, {
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) return 'unavailable';
      const body = (await response.json()) as {
        release?: { commit?: unknown };
      };
      const reported = body.release?.commit;
      if (typeof reported !== 'string') return 'unavailable';
      return reported === commit ? 'healthy' : 'wrong-commit';
    } catch {
      return 'unavailable';
    }
  };

  const deadline = now() + timeoutMs;
  for (;;) {
    const result = await attempt();
    if (result === 'healthy' || now() + pollMs >= deadline) return result;
    await sleep(pollMs);
  }
};

/** The agent's probe: the instance on this machine, by its port. */
export const createHttpHealthProbe = (
  options: HttpHealthProbeOptions = {},
): HealthProbe => ({
  waitForCommit: (port, commit, timeoutMs) =>
    waitForHealthyCommit(
      `http://127.0.0.1:${port}`,
      commit,
      timeoutMs,
      options,
    ),
});
