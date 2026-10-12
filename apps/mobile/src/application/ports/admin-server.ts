import type { AccountSummary } from '@mes-courses/sync-core';

import type { Result } from '../../domain/result';
import type { Connection, SyncFailure } from './sync-server';

/** 403: the caller is not an administrator. */
export type Forbidden = { type: 'Forbidden' };
export type InvalidEmail = { type: 'InvalidEmail' };
export type AccountExists = { type: 'AccountExists' };
/** 502: the invitation email could not be sent; nothing was created. */
export type MailFailed = { type: 'MailFailed' };

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
}
