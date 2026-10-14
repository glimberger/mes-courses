import {
  normalizeEmail,
  normalizeTemporaryPassword,
} from '@mes-courses/sync-core';

import { temporaryExpiresAt } from '../../domain/account';
import type { Clock } from '../ports/clock';
import type { MailMessage } from '../ports/mailer';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { PasswordHasher } from '../ports/password-hasher';
import type { ServerStore } from '../ports/store';
import {
  attemptKeys,
  pruneAttempts,
  recordAttempt,
  retryAfterIfBlocked,
} from './attempt-limits';

export type RequestPasswordResetDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: Pick<PairingCrypto, 'generateTemporaryPassword' | 'sha256Hex'>;
  hasher: PasswordHasher;
};

export type PasswordResetOutcome =
  /** The same for every address; `message` is `null` when there is nothing to send. */
  | {
      kind: 'accepted';
      message: Extract<MailMessage, { kind: 'newTemporaryPassword' }> | null;
    }
  | { kind: 'invalidEmail' }
  | { kind: 'blocked'; retryAfterSeconds: number };

/**
 * Asks for a new temporary password (research R4). Every well-formed request counts against the
 * limits, known address or not, and is checked before anything else. For an existing,
 * non-suspended account the new temporary password replaces any previous one and the current
 * password is left alone; the caller sends the returned message after answering.
 */
export const requestPasswordReset = async (
  deps: RequestPasswordResetDeps,
  request: { email: string; clientAddress: string },
): Promise<PasswordResetOutcome> => {
  const { store, clock, crypto, hasher } = deps;
  const email = normalizeEmail(request.email);
  if (email === null) return { kind: 'invalidEmail' };
  const keys = attemptKeys(crypto.sha256Hex, email, request.clientAddress);

  // A blocked request is refused before it pays for a hash, so a flood past the limit stays cheap.
  // The decision below checks again, in the transaction that counts the attempt.
  const early = await store.run(async (repos) =>
    retryAfterIfBlocked(
      repos.authAttempts,
      'passwordReset',
      keys,
      clock.nowMs(),
    ),
  );
  if (early !== null) return { kind: 'blocked', retryAfterSeconds: early };

  // Generated and hashed whatever the address, so an unknown one costs what a known one does.
  const temporaryPassword = crypto.generateTemporaryPassword();
  const temporaryPasswordHash = await hasher.hash(
    normalizeTemporaryPassword(temporaryPassword),
  );

  return store.run(async (repos): Promise<PasswordResetOutcome> => {
    const nowMs = clock.nowMs();
    await pruneAttempts(repos.authAttempts, nowMs);

    const wait = await retryAfterIfBlocked(
      repos.authAttempts,
      'passwordReset',
      keys,
      nowMs,
    );
    if (wait !== null) return { kind: 'blocked', retryAfterSeconds: wait };
    await recordAttempt(repos.authAttempts, 'passwordReset', keys, nowMs);

    const account = await repos.accounts.findByEmail(email);
    if (account === null || account.suspendedAt !== null) {
      return { kind: 'accepted', message: null };
    }
    const expiresAt = temporaryExpiresAt(nowMs);
    await repos.accounts.update({
      ...account,
      temporaryPasswordHash,
      temporaryExpiresAt: expiresAt,
    });
    return {
      kind: 'accepted',
      message: {
        kind: 'newTemporaryPassword',
        to: email,
        temporaryPassword,
        expiresAt,
      },
    };
  });
};
