import {
  validateNewPassword,
  type PasswordProblem,
} from '@mes-courses/sync-core';

import type { AccountRecord } from '../../domain/account';
import type { Clock } from '../ports/clock';
import type { ErrorReporter } from '../ports/error-reporter';
import type { PairingCrypto } from '../ports/pairing-crypto';
import type { PasswordHasher } from '../ports/password-hasher';
import type { DirectoryRepositories, ServerStore } from '../ports/store';
import {
  attemptKeys,
  pruneAttempts,
  recordAttempt,
  retryAfterIfBlocked,
} from './attempt-limits';
import {
  MAX_HASHING_ROUNDS,
  reportExhaustedRounds,
  sameCredentials,
} from './hash-outside-transaction';

export type OwnAccountDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: Pick<PairingCrypto, 'sha256Hex'>;
  hasher: PasswordHasher;
  /** Told when the hashing rounds ran out; optional so a caller without one still works. */
  errorReporter?: ErrorReporter;
};

/** The answers the current password check shares with `deleteOwnAccount`. */
export type PasswordCheckFailure =
  { kind: 'invalid' } | { kind: 'blocked'; retryAfterSeconds: number };

export type ChangePasswordOutcome =
  | { kind: 'changed' }
  | { kind: 'invalidPassword'; problem: PasswordProblem }
  | PasswordCheckFailure;

/**
 * Checks the password an authenticated caller types again before a sensitive change, then runs
 * `decide` in the same transaction as the check's outcome. A wrong one is counted under the
 * account's sign-in limit, like a wrong sign-in (contracts/auth-api.md); the limit is read
 * first. The slow work (`hasher.verify`, and whatever `prepare` hashes) runs outside any
 * transaction: see hash-outside-transaction.ts.
 */
export const withCurrentPassword = async <Prepared, Result>(
  { store, clock, crypto, hasher, errorReporter }: OwnAccountDeps,
  request: { accountId: string; password: string; clientAddress: string },
  prepare: (passwordIsRight: boolean) => Promise<Prepared>,
  decide: (
    repos: DirectoryRepositories,
    account: AccountRecord,
    prepared: Prepared,
  ) => Promise<Result>,
): Promise<Result | PasswordCheckFailure> => {
  const keysOf = (account: AccountRecord) =>
    attemptKeys(
      crypto.sha256Hex,
      account.email ?? account.id,
      request.clientAddress,
    );

  for (let round = 0; round < MAX_HASHING_ROUNDS; round++) {
    const read = await store.run(async (repos) => {
      const account = await repos.accounts.get(request.accountId);
      if (account === null) return { account, wait: null };
      await pruneAttempts(repos.authAttempts, clock.nowMs());
      const wait = await retryAfterIfBlocked(
        repos.authAttempts,
        'signIn',
        keysOf(account),
        clock.nowMs(),
      );
      return { account, wait };
    });
    if (read.account === null) return { kind: 'invalid' };
    if (read.wait !== null) {
      return { kind: 'blocked', retryAfterSeconds: read.wait };
    }

    const passwordIsRight = await hasher.verify(
      request.password,
      read.account.passwordHash,
    );
    const prepared = await prepare(passwordIsRight);

    const outcome = await store.run(
      async (
        repos,
      ): Promise<{ result: Result | PasswordCheckFailure } | null> => {
        const nowMs = clock.nowMs();
        const account = await repos.accounts.get(request.accountId);
        if (account === null) return { result: { kind: 'invalid' } };
        const keys = keysOf(account);
        const wait = await retryAfterIfBlocked(
          repos.authAttempts,
          'signIn',
          keys,
          nowMs,
        );
        if (wait !== null) {
          return { result: { kind: 'blocked', retryAfterSeconds: wait } };
        }
        // Changed while hashing: the answers above may be stale, so read again.
        if (!sameCredentials(read.account, account)) return null;

        if (!passwordIsRight) {
          await recordAttempt(repos.authAttempts, 'signIn', keys, nowMs);
          return { result: { kind: 'invalid' } };
        }
        return { result: await decide(repos, account, prepared) };
      },
    );
    if (outcome !== null) return outcome.result;
  }
  // The account kept changing under us: refuse without counting an attempt.
  reportExhaustedRounds(
    errorReporter,
    'withCurrentPassword',
    '/v1/account',
    request.accountId,
  );
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
): Promise<ChangePasswordOutcome> => {
  const problem = validateNewPassword(request.newPassword, {
    current: request.currentPassword,
  });
  return withCurrentPassword(
    deps,
    {
      accountId: request.accountId,
      password: request.currentPassword,
      clientAddress: request.clientAddress,
    },
    // Hashed only for someone who typed the current password right and chose an acceptable one.
    async (passwordIsRight) =>
      passwordIsRight && problem === null
        ? deps.hasher.hash(request.newPassword)
        : null,
    async (repos, account, newPasswordHash): Promise<ChangePasswordOutcome> => {
      if (problem !== null) return { kind: 'invalidPassword', problem };
      if (newPasswordHash === null) return { kind: 'invalid' };
      await repos.accounts.update({
        ...account,
        passwordHash: newPasswordHash,
        temporaryPasswordHash: null,
        temporaryExpiresAt: null,
      });
      return { kind: 'changed' };
    },
  );
};
