import type { AccountInfo } from '@mes-courses/sync-core';

import { err, ok, type Result } from '../../domain/result';
import type {
  AccountPairing,
  AccountServer,
  ChoosePasswordServerError,
  PasswordResetServerError,
  SignInOutcome,
  SignInServerError,
} from '../ports/account-server';

const PAIRING: AccountPairing = {
  deviceId: 'device-signed-in',
  credential: 'credential-signed-in',
  serverId: 'server-1',
  apiVersion: 1,
  minAppVersion: '1.1.0',
  accountId: 'account-1',
};

/**
 * The caller's own account in memory, for use case tests, screen tests and stories. The answer to
 * each call is set by the test; every call is recorded.
 */
export class InMemoryAccountServer implements AccountServer {
  /** Every call fails as if the phone had no network. */
  offline = false;
  account: AccountInfo;
  /** What `signIn` answers. */
  signInResult: Result<SignInOutcome, SignInServerError>;
  /** What `choosePassword` answers. */
  choosePasswordResult: Result<AccountPairing, ChoosePasswordServerError> =
    ok(PAIRING);
  /** What `requestPasswordReset` answers. */
  passwordResetResult: Result<void, PasswordResetServerError> = ok(undefined);
  readonly passwordResetCalls: { url: string; email: string }[] = [];
  readonly signInCalls: {
    url: string;
    email: string;
    password: string;
    deviceName: string;
  }[] = [];
  readonly choosePasswordCalls: {
    url: string;
    email: string;
    temporaryPassword: string;
    newPassword: string;
    deviceName: string;
  }[] = [];

  constructor(
    account: AccountInfo = {
      id: 'account-1',
      email: 'marie@example.org',
      role: 'user',
    },
  ) {
    this.account = account;
    this.signInResult = ok({
      type: 'signedIn',
      pairing: PAIRING,
      account,
    });
  }

  signIn: AccountServer['signIn'] = async (
    url,
    email,
    password,
    deviceName,
  ) => {
    this.signInCalls.push({ url, email, password, deviceName });
    return this.offline
      ? err({ type: 'ServerUnreachable' })
      : this.signInResult;
  };

  choosePassword: AccountServer['choosePassword'] = async (
    url,
    email,
    temporaryPassword,
    newPassword,
    deviceName,
  ) => {
    this.choosePasswordCalls.push({
      url,
      email,
      temporaryPassword,
      newPassword,
      deviceName,
    });
    return this.offline
      ? err({ type: 'ServerUnreachable' })
      : this.choosePasswordResult;
  };

  requestPasswordReset: AccountServer['requestPasswordReset'] = async (
    url,
    email,
  ) => {
    this.passwordResetCalls.push({ url, email });
    return this.offline
      ? err({ type: 'ServerUnreachable' })
      : this.passwordResetResult;
  };

  getAccount: AccountServer['getAccount'] = async () =>
    this.offline ? err({ type: 'Offline' }) : ok({ ...this.account });
}
