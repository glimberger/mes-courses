import { normalizeEmail } from '@mes-courses/sync-core';

import { err, ok, type Result } from '../../domain/result';
import type {
  AccountServer,
  AccountSuspended,
  InvalidCredentials,
  TemporaryPasswordExpired,
} from '../ports/account-server';
import type {
  ServerUnreachable,
  SyncServer,
  TooManyAttempts,
  UntrustedServer,
  UpdateRequired,
} from '../ports/sync-server';
import {
  storeSignedInDevice,
  type SignedInDeviceDeps,
  type StorageFailed,
} from './store-signed-in-device';

export type InvalidEmail = { type: 'InvalidEmail' };

export type SignInError =
  | InvalidEmail
  | InvalidCredentials
  | TemporaryPasswordExpired
  | AccountSuspended
  | TooManyAttempts
  | ServerUnreachable
  | UntrustedServer
  | UpdateRequired
  | StorageFailed;

export type SignInResult =
  { type: 'signedIn' } | { type: 'passwordChangeRequired' };

/**
 * Signs this device in (US2-1) at the fixed server address (013): checks the server answers, asks it to sign in, and on success keeps
 * the credential and the connection (see `storeSignedInDevice`). When the temporary password
 * matched, nothing is stored: the person must choose a password first. Any failure changes
 * nothing, the data on the device included.
 */
export const createSignIn =
  ({
    syncServer,
    accountServer,
    serverUrl: url,
    ...device
  }: SignedInDeviceDeps & {
    syncServer: SyncServer;
    accountServer: AccountServer;
    /** The sync server address fixed at build time, already validated (013). */
    serverUrl: string;
  }) =>
  async (
    typedEmail: string,
    password: string,
    deviceName: string,
  ): Promise<Result<SignInResult, SignInError>> => {
    const email = normalizeEmail(typedEmail);
    if (email === null) return err({ type: 'InvalidEmail' });

    const health = await syncServer.health(url);
    if (!health.ok) return health;

    const outcome = await accountServer.signIn(
      url,
      email,
      password,
      deviceName,
    );
    if (!outcome.ok) return outcome;
    if (outcome.value.type === 'passwordChangeRequired') {
      return ok({ type: 'passwordChangeRequired' });
    }

    const stored = await storeSignedInDevice(device, outcome.value.pairing);
    return stored.ok ? ok({ type: 'signedIn' }) : stored;
  };
