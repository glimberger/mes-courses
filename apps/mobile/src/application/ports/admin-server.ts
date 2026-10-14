import type { AccountSummary } from '@mes-courses/sync-core';

import type { Result } from '../../domain/result';
import type { Connection, DeviceNotFound, SyncFailure } from './sync-server';

/** 403: the caller is not an administrator. */
export type Forbidden = { type: 'Forbidden' };
export type InvalidEmail = { type: 'InvalidEmail' };
export type AccountExists = { type: 'AccountExists' };
/** 502: the invitation email could not be sent; nothing was created. */
export type MailFailed = { type: 'MailFailed' };

/** 409: the only active administrator cannot be suspended or deleted. */
export type LastAdministrator = { type: 'LastAdministrator' };
/** 409: only an account that never signed in has credentials to resend. */
export type NotInvited = { type: 'NotInvited' };
/** 404: the account does not exist (any more). */
export type AccountNotFound = DeviceNotFound;

/** The administrator's side of the same adapter family; used only by the administrator screens. */
export interface AdminServer {
  listAccounts(
    conn: Connection,
  ): Promise<Result<AccountSummary[], SyncFailure | Forbidden>>;
  invite(
    conn: Connection,
    email: string,
  ): Promise<
    Result<
      AccountSummary,
      InvalidEmail | AccountExists | MailFailed | SyncFailure | Forbidden
    >
  >;
  suspend(
    conn: Connection,
    id: string,
  ): Promise<
    Result<void, LastAdministrator | AccountNotFound | SyncFailure | Forbidden>
  >;
  reactivate(
    conn: Connection,
    id: string,
  ): Promise<Result<void, AccountNotFound | SyncFailure | Forbidden>>;
  resendCredentials(
    conn: Connection,
    id: string,
  ): Promise<
    Result<
      void,
      NotInvited | MailFailed | AccountNotFound | SyncFailure | Forbidden
    >
  >;
  delete(
    conn: Connection,
    id: string,
  ): Promise<
    Result<void, LastAdministrator | AccountNotFound | SyncFailure | Forbidden>
  >;
}
