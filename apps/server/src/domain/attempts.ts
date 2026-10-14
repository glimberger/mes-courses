export type AttemptKind = 'signIn' | 'passwordReset';

export type AttemptLimit = {
  readonly kind: AttemptKind;
  /** What the key identifies. */
  readonly subject: 'email' | 'client';
  readonly max: number;
  readonly windowMs: number;
};

const MINUTE_MS = 60 * 1000;

/** The limits of research R6, as data. */
export const ATTEMPT_LIMITS: readonly AttemptLimit[] = [
  { kind: 'signIn', subject: 'email', max: 5, windowMs: 10 * MINUTE_MS },
  { kind: 'signIn', subject: 'client', max: 20, windowMs: 10 * MINUTE_MS },
  { kind: 'passwordReset', subject: 'email', max: 3, windowMs: 60 * MINUTE_MS },
  {
    kind: 'passwordReset',
    subject: 'client',
    max: 10,
    windowMs: 60 * MINUTE_MS,
  },
];

/** Rows older than the longest window are of no use to any limit. */
export const ATTEMPT_RETENTION_MS = 60 * MINUTE_MS;

export const limitFor = (
  kind: AttemptKind,
  subject: AttemptLimit['subject'],
): AttemptLimit => {
  const found = ATTEMPT_LIMITS.find(
    (limit) => limit.kind === kind && limit.subject === subject,
  );
  if (found === undefined) throw new Error(`No limit for ${kind}/${subject}`);
  return found;
};

export type Evaluation =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Whether one more attempt is allowed. The lock ends when the oldest counted failure leaves its
 * window; `retryAfterSeconds` is at least 1.
 */
export const evaluate = (
  limit: AttemptLimit,
  count: number,
  earliest: string | null,
  nowMs: number,
): Evaluation => {
  if (count < limit.max) return { allowed: true };
  const earliestMs = earliest === null ? nowMs : Date.parse(earliest);
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((earliestMs + limit.windowMs - nowMs) / 1000),
    ),
  };
};

/**
 * The stored key of a normalized email or client address: its SHA-256, so no readable address is
 * kept (research R6). The hash comes from the crypto adapter's `sha256Hex`.
 */
export const attemptKey = (
  sha256Hex: (input: string) => string,
  normalizedValue: string,
): string => sha256Hex(normalizedValue);
