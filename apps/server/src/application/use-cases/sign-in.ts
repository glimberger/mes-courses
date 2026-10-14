import {
  normalizeEmail,
  normalizeTemporaryPassword,
  type AccountInfo,
} from '@mes-courses/sync-core';

import { isTemporaryExpired, type AccountRecord } from '../../domain/account';
import { cleanDeviceName } from '../../domain/device';
import type { Clock } from '../ports/clock';
import type { ErrorReporter } from '../ports/error-reporter';
import type { IdGenerator } from '../ports/id-generator';
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

export type SignInDeps = {
  store: ServerStore;
  clock: Clock;
  crypto: Pick<PairingCrypto, 'generateCredential' | 'sha256Hex'>;
  hasher: PasswordHasher;
  ids: IdGenerator;
  /** Told when the hashing rounds ran out; optional so a caller without one still works. */
  errorReporter?: ErrorReporter;
};

/** The device a successful sign-in created. */
export type SignedIn = {
  kind: 'signedIn';
  deviceId: string;
  /** Returned once; only its SHA-256 is stored. */
  credential: string;
  account: AccountInfo;
};

export type SignInOutcome =
  | SignedIn
  | { kind: 'passwordChangeRequired' }
  | { kind: 'invalidEmail' }
  | { kind: 'invalidDeviceName' }
  /** Unknown address or wrong password: the same for both (FR-006). */
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'suspended' }
  | { kind: 'blocked'; retryAfterSeconds: number };

/** Creates the device of a successful sign-in with a random 256-bit credential. */
export const createSignedInDevice = async (
  { clock, crypto, ids }: Pick<SignInDeps, 'clock' | 'crypto' | 'ids'>,
  { devices }: Pick<DirectoryRepositories, 'devices'>,
  account: AccountRecord & { email: string },
  deviceName: string,
): Promise<SignedIn> => {
  const credential = crypto.generateCredential();
  const deviceId = ids.next();
  await devices.add({
    id: deviceId,
    accountId: account.id,
    name: deviceName,
    credentialHash: crypto.sha256Hex(credential),
    createdAt: new Date(clock.nowMs()).toISOString(),
    lastSyncAt: null,
    revokedAt: null,
  });
  return {
    kind: 'signedIn',
    deviceId,
    credential,
    account: { id: account.id, email: account.email, role: account.role },
  };
};

/**
 * Signs a device in with the current password, or starts the first sign-in when the temporary
 * password matches (contracts/auth-api.md). A failure is recorded in the transaction that decides
 * it and returned as an outcome, never thrown: a throw would roll the record back.
 */
export const signIn = async (
  deps: SignInDeps,
  request: {
    email: string;
    password: string;
    deviceName: string;
    /** The caller's network address, only ever stored hashed. */
    clientAddress: string;
  },
): Promise<SignInOutcome> => {
  const { store, clock, crypto, hasher } = deps;
  const email = normalizeEmail(request.email);
  if (email === null) return { kind: 'invalidEmail' };
  const deviceName = cleanDeviceName(request.deviceName);
  if (deviceName === null) return { kind: 'invalidDeviceName' };
  const keys = attemptKeys(crypto.sha256Hex, email, request.clientAddress);

  for (let round = 0; round < MAX_HASHING_ROUNDS; round++) {
    // Short read: the limit and the account. Nothing slow runs while the store is held.
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

    // Both checks always run, against a dummy hash when there is nothing to compare, so an
    // unknown address costs what a known one does.
    const currentMatches = await hasher.verify(
      request.password,
      read.account?.passwordHash ?? null,
    );
    const temporaryMatches = await hasher.verify(
      normalizeTemporaryPassword(request.password),
      read.account?.temporaryPasswordHash ?? null,
    );

    const outcome = await store.run(
      async (repos): Promise<SignInOutcome | null> => {
        const nowMs = clock.nowMs();
        const wait = await retryAfterIfBlocked(
          repos.authAttempts,
          'signIn',
          keys,
          nowMs,
        );
        if (wait !== null) return { kind: 'blocked', retryAfterSeconds: wait };

        const account = await repos.accounts.findByEmail(email);
        // Changed while hashing: the answers above may be stale, so read again.
        if (!sameCredentials(read.account, account)) return null;

        if (account === null || account.email === null) {
          await recordAttempt(repos.authAttempts, 'signIn', keys, nowMs);
          return { kind: 'invalid' };
        }
        const known = { ...account, email: account.email };

        if (currentMatches) {
          if (account.suspendedAt !== null) return { kind: 'suspended' };
          return createSignedInDevice(deps, repos, known, deviceName);
        }
        if (temporaryMatches) {
          if (isTemporaryExpired(account, nowMs)) return { kind: 'expired' };
          if (account.suspendedAt !== null) return { kind: 'suspended' };
          return { kind: 'passwordChangeRequired' };
        }
        await recordAttempt(repos.authAttempts, 'signIn', keys, nowMs);
        return { kind: 'invalid' };
      },
    );
    if (outcome !== null) return outcome;
  }
  // The account kept changing under us: refuse without counting an attempt.
  reportExhaustedRounds(deps.errorReporter, 'signIn', 'POST /v1/auth/sign-in');
  return { kind: 'invalid' };
};
