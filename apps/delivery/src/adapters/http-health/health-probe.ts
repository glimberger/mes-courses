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

/** What the server last said on `/v1/health`, when it said anything readable. */
export type ReportedRelease = { commit?: string; version?: string };

export type HealthProbeOutcome = {
  result: HealthResult;
  /** From the last attempt that got a readable `release`; absent when none did. */
  reported?: ReportedRelease;
};

/**
 * Polls `GET <baseUrl>/v1/health` until `release.commit` is the expected one or `timeoutMs` has
 * passed; the result of the last attempt tells why it did not succeed, and `reported` carries the
 * version and commit the server last reported.
 */
export const probeHealthyCommit = async (
  baseUrl: string,
  commit: string,
  timeoutMs: number,
  {
    pollMs = 1000,
    requestTimeoutMs = 2000,
    now = Date.now,
    sleep = realSleep,
  }: HttpHealthProbeOptions = {},
): Promise<HealthProbeOutcome> => {
  let reported: ReportedRelease | undefined;
  const attempt = async (): Promise<HealthResult> => {
    try {
      const response = await fetch(`${baseUrl}/v1/health`, {
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!response.ok) return 'unavailable';
      const body = (await response.json()) as {
        release?: { commit?: unknown; version?: unknown };
      };
      const seen = body.release?.commit;
      if (typeof seen !== 'string') return 'unavailable';
      const version = body.release?.version;
      reported = {
        commit: seen,
        ...(typeof version === 'string' ? { version } : {}),
      };
      return seen === commit ? 'healthy' : 'wrong-commit';
    } catch {
      return 'unavailable';
    }
  };

  const deadline = now() + timeoutMs;
  for (;;) {
    const result = await attempt();
    if (result === 'healthy' || now() + pollMs >= deadline) {
      return reported === undefined ? { result } : { result, reported };
    }
    await sleep(pollMs);
  }
};

/** `probeHealthyCommit` without the details: only how the last attempt ended. */
export const waitForHealthyCommit = async (
  baseUrl: string,
  commit: string,
  timeoutMs: number,
  options: HttpHealthProbeOptions = {},
): Promise<HealthResult> =>
  (await probeHealthyCommit(baseUrl, commit, timeoutMs, options)).result;

/** The message of a `wait-health` that timed out: what the server reported, and where to look. */
export const describeHealthTimeout = ({
  url,
  commit,
  timeoutSeconds,
  outcome,
}: {
  url: string;
  commit: string;
  timeoutSeconds: number;
  outcome: HealthProbeOutcome;
}): string => {
  const { reported } = outcome;
  const seen = reported
    ? `The server last reported version ${reported.version ?? 'unknown'}, commit ${reported.commit ?? 'unknown'}.`
    : 'The server never answered with a readable release.';
  return (
    `${url} did not report commit ${commit} within ${timeoutSeconds} s (${outcome.result}). ${seen} ` +
    "The Pi's report says why. If the Pi agent refuses the manifest (it needs a newer agent than " +
    'the one installed, `minAgentVersion`), see docs/procedures/updating-the-agent.md.'
  );
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
