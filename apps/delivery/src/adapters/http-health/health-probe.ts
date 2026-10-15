import type {
  HealthProbe,
  HealthResult,
} from '../../application/ports/health-probe';

export type HttpHealthProbeOptions = {
  /** Pause between two attempts. */
  pollMs?: number;
  /** Limit for one request. */
  requestTimeoutMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** `GET http://127.0.0.1:<port>/v1/health`, until `release.commit` is the expected one. */
export const createHttpHealthProbe = ({
  pollMs = 1000,
  requestTimeoutMs = 2000,
}: HttpHealthProbeOptions = {}): HealthProbe => {
  const attempt = async (
    port: number,
    commit: string,
  ): Promise<HealthResult> => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/health`, {
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

  return {
    async waitForCommit(port, commit, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      let result: HealthResult = 'unavailable';
      for (;;) {
        result = await attempt(port, commit);
        if (result === 'healthy' || Date.now() + pollMs >= deadline) {
          return result;
        }
        await sleep(pollMs);
      }
    },
  };
};
