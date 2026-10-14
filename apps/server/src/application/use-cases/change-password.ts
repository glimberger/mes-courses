import {
  validateNewPassword,
  type PasswordProblem,
} from '@mes-courses/sync-core';

import type { AccountRecord } from '../../domain/account';
import type { Clock } from '../ports/clock';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { PasswordHasher } from '../ports/password-hasher';
import type { DirectoryRepositories, ServerStore } from '../ports/store';
import {
  attemptKeys,
  pruneAttempts,
  recordAttempt,
  retryAfterIfBlocked,
} from './attempt-limits';

export type OwnAccountDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: Pick<PairingCrypto, 'sha256Hex'>;
  hasher: PasswordHasher;
};

/** The answers the current password check shares with `deleteOwnAccount`. */
export type PasswordCheckFailure =
  { kind: 'invalid' } | { kind: 'blocked'; retryAfterSeconds: number };

export type ChangePasswordOutcome =
  | { kind: 'changed' }
  | { kind: 'invalidPassword'; problem: PasswordProblem }
  | PasswordCheckFailure;

/**
 * Checks the password an authenticated caller types again before a sensitive change. A wrong one
 * is counted under the account's sign-in limit, like a wrong sign-in (contracts/auth-api.md); the
 * limit is read first. `null` means the password is right.
 */
export const checkCurrentPassword = async (
  { clock, crypto, hasher }: Omit<OwnAccountDeps, 'store'>,
  repos: DirectoryRepositories,
  account: AccountRecord,
  password: string,
  clientAddress: string,
): Promise<PasswordCheckFailure | null> => {
  const nowMs = clock.nowMs();
  await pruneAttempts(repos.authAttempts, nowMs);
  const keys = attemptKeys(
    crypto.sha256Hex,
    account.email ?? account.id,
    clientAddress,
  );
  const wait = await retryAfterIfBlocked(
    repos.authAttempts,
    'signIn',
    keys,
    nowMs,
  );
  if (wait !== null) return { kind: 'blocked', retryAfterSeconds: wait };

  if (await hasher.verify(password, account.passwordHash)) return null;
  await recordAttempt(repos.authAttempts, 'signIn', keys, nowMs);
  return { kind: 'invalid' };
};

/**
 * Changes the caller's password. The current one is verified first, so `SameAsCurrent` is only
 * told to someone who typed it right. The other devices stay signed in; an outstanding temporary
 * password is cleared (US6-2).
 */
export const changePassword = async (
  deps: OwnAccountDeps,
  request: {
    accountId: string;
    currentPassword: string;
    newPassword: string;
    clientAddress: string;
  },
): Promise<ChangePasswordOutcome> =>
  deps.store.run(async (repos): Promise<ChangePasswordOutcome> => {
    const account = await repos.accounts.get(request.accountId);
    if (account === null) return { kind: 'invalid' };

    const failure = await checkCurrentPassword(
      deps,
      repos,
      account,
      request.currentPassword,
      request.clientAddress,
    );
    if (failure !== null) return failure;

    const problem = validateNewPassword(request.newPassword, {
      current: request.currentPassword,
    });
    if (problem !== null) return { kind: 'invalidPassword', problem };

    await repos.accounts.update({
      ...account,
      passwordHash: await deps.hasher.hash(request.newPassword),
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
    });
    return { kind: 'changed' };
  });
