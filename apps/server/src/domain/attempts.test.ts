import { ATTEMPT_LIMITS, attemptKey, evaluate, limitFor } from './attempts';

const MINUTE = 60 * 1000;
const T0 = Date.parse('2026-10-12T10:00:00.000Z');
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

describe('the limits of research R6', () => {
  it('004 R6 holds the four limits as data', () => {
    expect(
      ATTEMPT_LIMITS.map(({ kind, subject, max, windowMs }) => [
        kind,
        subject,
        max,
        windowMs / MINUTE,
      ]),
    ).toEqual([
      ['signIn', 'email', 5, 10],
      ['signIn', 'client', 20, 10],
      ['passwordReset', 'email', 3, 60],
      ['passwordReset', 'client', 10, 60],
    ]);
  });
});

describe('evaluate', () => {
  const signIn = limitFor('signIn', 'email');
  const reset = limitFor('passwordReset', 'email');

  it('004 FR-006 allows the fifth failure and refuses the sixth attempt', () => {
    expect(evaluate(signIn, 4, at(0), T0 + MINUTE)).toEqual({ allowed: true });
    expect(evaluate(signIn, 5, at(0), T0 + MINUTE).allowed).toBe(false);
  });

  it('004 R6 ends the lock when the oldest counted failure leaves the window', () => {
    // Oldest failure at T0; 10-minute window; now T0 + 4 min: 6 minutes left.
    expect(evaluate(signIn, 5, at(0), T0 + 4 * MINUTE)).toEqual({
      allowed: false,
      retryAfterSeconds: 360,
    });
    // One second before the window ends: 1 second.
    expect(evaluate(signIn, 5, at(0), T0 + 10 * MINUTE - 1000)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it('004 R6 rounds up and never answers less than 1 second', () => {
    expect(evaluate(signIn, 5, at(0), T0 + 10 * MINUTE - 1)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(evaluate(signIn, 5, at(0), T0 + 10 * MINUTE + 5000)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it('004 US4-4 refuses the fourth reset in an hour with the seconds to wait', () => {
    expect(evaluate(reset, 2, at(0), T0)).toEqual({ allowed: true });
    expect(evaluate(reset, 3, at(0), T0 + 20 * MINUTE)).toEqual({
      allowed: false,
      retryAfterSeconds: 40 * 60,
    });
  });

  it('004 R6 slides: once the oldest row leaves, fewer rows count and the next attempt is allowed', () => {
    expect(evaluate(signIn, 4, at(MINUTE), T0 + 11 * MINUTE)).toEqual({
      allowed: true,
    });
  });
});

describe('attemptKey', () => {
  // The real SHA-256 is the crypto adapter's; here a stand-in that hides the value.
  const sha256Hex = (input: string) =>
    [...input].reduce((sum, c) => sum * 31 + c.charCodeAt(0), 7).toString(16);

  it('004 R6 is the hash of the normalized value, deterministic, and does not contain it', () => {
    const key = attemptKey(sha256Hex, 'marie@example.org');
    expect(key).not.toContain('marie');
    expect(attemptKey(sha256Hex, 'marie@example.org')).toBe(key);
    expect(attemptKey(sha256Hex, 'paul@example.org')).not.toBe(key);
  });
});
