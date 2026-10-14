import {
  ATTEMPT_RETENTION_MS,
  attemptKey,
  evaluate,
  limitFor,
  type AttemptKind,
} from '../../domain/attempts';
import type { AuthAttemptRepository } from '../ports/auth-attempt-repository';

type Sha256 = (input: string) => string;

/** The stored keys of one request: hashes of the normalized address and of the client. */
export const attemptKeys = (
  sha256Hex: Sha256,
  normalizedEmail: string,
  clientAddress: string,
) => ({
  email: attemptKey(sha256Hex, normalizedEmail),
  client: attemptKey(sha256Hex, clientAddress),
});

export type AttemptKeys = ReturnType<typeof attemptKeys>;

/** Forgets the rows no window reads any more; called at the start of every auth request. */
export const pruneAttempts = (
  attempts: AuthAttemptRepository,
  nowMs: number,
): Promise<void> =>
  attempts.pruneBefore(new Date(nowMs - ATTEMPT_RETENTION_MS).toISOString());

/**
 * `null` when one more attempt is allowed, else the seconds to wait: the longest of the limits
 * that are reached. Checked before any password (research R6).
 */
export const retryAfterIfBlocked = async (
  attempts: AuthAttemptRepository,
  kind: AttemptKind,
  keys: AttemptKeys,
  nowMs: number,
): Promise<number | null> => {
  let wait: number | null = null;
  for (const subject of ['email', 'client'] as const) {
    const limit = limitFor(kind, subject);
    // A failure leaves its window exactly `windowMs` later, so the bound is exclusive.
    const since = new Date(nowMs - limit.windowMs + 1).toISOString();
    const key = keys[subject];
    const evaluation = evaluate(
      limit,
      await attempts.countSince(kind, key, since),
      await attempts.earliestSince(kind, key, since),
      nowMs,
    );
    if (!evaluation.allowed) {
      wait = Math.max(wait ?? 0, evaluation.retryAfterSeconds);
    }
  }
  return wait;
};

/** Counts one attempt against the address and the client. */
export const recordAttempt = async (
  attempts: AuthAttemptRepository,
  kind: AttemptKind,
  keys: AttemptKeys,
  nowMs: number,
): Promise<void> => {
  const at = new Date(nowMs).toISOString();
  await attempts.add(kind, keys.email, at);
  await attempts.add(kind, keys.client, at);
};
