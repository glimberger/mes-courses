import { normalizeEmail, validateNewPassword } from '@mes-courses/sync-core';
import type { PasswordProblem } from '@mes-courses/sync-core';

import { err, ok, type Result } from '../../domain/result';
import type {
  AccountServer,
  AccountSuspended,
  TemporaryPasswordExpired,
} from '../ports/account-server';
import type {
  ServerUnreachable,
  TooManyAttempts,
  UntrustedServer,
  UpdateRequired,
} from '../ports/sync-server';
import { normalizeUrl } from './normalize-url';
import type { InvalidEmail } from './sign-in';
import {
  storeSignedInDevice,
  type InvalidUrl,
  type SignedInDeviceDeps,
  type StorageFailed,
} from './store-signed-in-device';

/** The two entries of the new password differ. */
export type PasswordsDiffer = { type: 'PasswordsDiffer' };
/** The new password breaks a rule, told before any request (US2-3) or by the server. */
export type PasswordRejected = {
  type: 'PasswordRejected';
  problem: PasswordProblem;
};
/** The temporary password was replaced, or used elsewhere, since the sign-in (research R4). */
export type TemporaryPasswordInvalid = { type: 'TemporaryPasswordInvalid' };

export type ChooseInitialPasswordError =
  | InvalidUrl
  | InvalidEmail
  | PasswordsDiffer
  | PasswordRejected
  | TemporaryPasswordInvalid
  | TemporaryPasswordExpired
  | AccountSuspended
  | TooManyAttempts
  | ServerUnreachable
  | UntrustedServer
  | UpdateRequired
  | StorageFailed;

/**
 * Finishes the first sign-in (US2-2): checks the two entries and the password rules here, so no
 * request is made for a password the server would refuse (US2-3), then asks the server to set it
 * and keeps the device as `signIn` does. The temporary password lives in memory only.
 */
export const createChooseInitialPassword =
  ({
    accountServer,
    allowInsecure = false,
    ...device
  }: SignedInDeviceDeps & {
    accountServer: AccountServer;
    allowInsecure?: boolean;
  }) =>
  async (
    typedUrl: string,
    typedEmail: string,
    temporaryPassword: string,
    newPassword: string,
    confirmation: string,
    deviceName: string,
  ): Promise<Result<void, ChooseInitialPasswordError>> => {
    const url = normalizeUrl(typedUrl, allowInsecure);
    if (url === null) return err({ type: 'InvalidUrl' });
    const email = normalizeEmail(typedEmail);
    if (email === null) return err({ type: 'InvalidEmail' });
    if (newPassword.normalize('NFC') !== confirmation.normalize('NFC')) {
      return err({ type: 'PasswordsDiffer' });
    }
    const problem = validateNewPassword(newPassword, {
      temporary: temporaryPassword,
    });
    if (problem !== null) return err({ type: 'PasswordRejected', problem });

    const chosen = await accountServer.choosePassword(
      url,
      email,
      temporaryPassword,
      newPassword,
      deviceName,
    );
    if (!chosen.ok) {
      const { error } = chosen;
      return err(
        error.type === 'InvalidCredentials'
          ? { type: 'TemporaryPasswordInvalid' }
          : error,
      );
    }
    const stored = await storeSignedInDevice(device, url, chosen.value);
    return stored.ok ? ok(undefined) : stored;
  };
