import {
  normalizeEmail,
  normalizeTemporaryPassword,
  validateNewPassword,
  type PasswordProblem,
} from '@mes-courses/sync-core';

import { isTemporaryExpired } from '../../domain/account';
import { cleanDeviceName } from '../../domain/device';
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
import {
  createSignedInDevice,
  type SignedIn,
  type SignInDeps,
} from './sign-in';

export type ChoosePasswordOutcome =
  | SignedIn
  | { kind: 'invalidEmail' }
  | { kind: 'invalidDeviceName' }
  | { kind: 'invalidPassword'; problem: PasswordProblem }
  /** Unknown address, wrong temporary password, or one replaced or used since (research R4). */
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'suspended' }
  | { kind: 'blocked'; retryAfterSeconds: number };

/**
 * Finishes a first sign-in or a reset: verifies the temporary password again, then in one
 * transaction sets the password, clears the temporary one and creates the device. The limits and
 * the recording of failures are those of `signIn`.
 */
export const choosePassword = async (
  deps: SignInDeps,
  request: {
    email: string;
    temporaryPassword: string;
    newPassword: string;
    deviceName: string;
    clientAddress: string;
  },
): Promise<ChoosePasswordOutcome> => {
  const { store, clock, crypto, hasher } = deps;
  const email = normalizeEmail(request.email);
  if (email === null) return { kind: 'invalidEmail' };
  const deviceName = cleanDeviceName(request.deviceName);
  if (deviceName === null) return { kind: 'invalidDeviceName' };
  const keys = attemptKeys(crypto.sha256Hex, email, request.clientAddress);
  const temporary = normalizeTemporaryPassword(request.temporaryPassword);

  for (let round = 0; round < MAX_HASHING_ROUNDS; round++) {
    // Short read, then the hashes outside the transaction (see hash-outside-transaction.ts).
    const read = await store.run(async (repos) => {
      await pruneAttempts(repos.authAttempts, clock.nowMs());
      return {
        wait: await retryAfterIfBlocked(
          repos.authAttempts,
          'signIn',
          keys,
          clock.nowMs(),
        ),
        account: await repos.accounts.findByEmail(email),
      };
    });
    if (read.wait !== null) {
      return { kind: 'blocked', retryAfterSeconds: read.wait };
    }

    const matches = await hasher.verify(
      temporary,
      read.account?.temporaryPasswordHash ?? null,
    );
    // Told only to whoever holds the temporary password.
    const problem = matches
      ? validateNewPassword(request.newPassword, {
          temporary: request.temporaryPassword,
        })
      : null;
    const newPasswordHash =
      matches && problem === null
        ? await hasher.hash(request.newPassword)
        : null;

    const outcome = await store.run(
      async (repos): Promise<ChoosePasswordOutcome | null> => {
        const nowMs = clock.nowMs();
        const wait = await retryAfterIfBlocked(
          repos.authAttempts,
          'signIn',
          keys,
          nowMs,
        );
        if (wait !== null) return { kind: 'blocked', retryAfterSeconds: wait };

        const account = await repos.accounts.findByEmail(email);
        if (!sameCredentials(read.account, account)) return null;

        if (!matches || account === null || account.email === null) {
          await recordAttempt(repos.authAttempts, 'signIn', keys, nowMs);
          return { kind: 'invalid' };
        }
        if (isTemporaryExpired(account, nowMs)) return { kind: 'expired' };
        if (account.suspendedAt !== null) return { kind: 'suspended' };
        if (problem !== null) return { kind: 'invalidPassword', problem };
        if (newPasswordHash === null) return null;

        await repos.accounts.update({
          ...account,
          passwordHash: newPasswordHash,
          temporaryPasswordHash: null,
          temporaryExpiresAt: null,
        });
        return createSignedInDevice(
          deps,
          repos,
          { ...account, email: account.email },
          deviceName,
        );
      },
    );
    if (outcome !== null) return outcome;
  }
  // The account kept changing under us: refuse without counting an attempt.
  reportExhaustedRounds(
    deps.errorReporter,
    'choosePassword',
    'POST /v1/auth/choose-password',
  );
  return { kind: 'invalid' };
};
