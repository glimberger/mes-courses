import { validateNewPassword } from '@mes-courses/sync-core';

import { err, type Result } from '../../domain/result';
import type {
  AccountServer,
  ChangePasswordServerError,
} from '../ports/account-server';
import type { CredentialStore } from '../ports/credential-store';
import type { DeviceNotAuthorized } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import type {
  PasswordRejected,
  PasswordsDiffer,
} from './choose-initial-password';
import { currentConnection } from './connection';

export type ChangePasswordError =
  | PasswordsDiffer
  | PasswordRejected
  | DeviceNotAuthorized
  | ChangePasswordServerError;

/**
 * Changes the password of the signed-in account (US6-2). The checks that need no server are made
 * here, `SameAsCurrent` included, so no request is made for a password the server would refuse.
 * The other devices stay signed in.
 */
export const createChangePassword =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    accountServer: AccountServer;
  }) =>
  async (
    current: string,
    next: string,
    confirmation: string,
  ): Promise<Result<void, ChangePasswordError>> => {
    if (next.normalize('NFC') !== confirmation.normalize('NFC')) {
      return err({ type: 'PasswordsDiffer' });
    }
    const problem = validateNewPassword(next, { current });
    if (problem !== null) return err({ type: 'PasswordRejected', problem });

    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.accountServer.changePassword(conn.value, current, next);
  };
