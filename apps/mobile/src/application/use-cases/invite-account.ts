import { normalizeEmail, type AccountSummary } from '@mes-courses/sync-core';

import { err, type Result } from '../../domain/result';
import type {
  AccountExists,
  AdminServer,
  Forbidden,
  InvalidEmail,
  MailFailed,
} from '../ports/admin-server';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

export type InviteAccountError =
  InvalidEmail | AccountExists | MailFailed | SyncFailure | Forbidden;

/** Invites an address (US1-1 to US1-4): a malformed one is refused here, without a request. */
export const createInviteAccount =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    adminServer: AdminServer;
  }) =>
  async (
    rawEmail: string,
  ): Promise<Result<AccountSummary, InviteAccountError>> => {
    const email = normalizeEmail(rawEmail);
    if (email === null) return err({ type: 'InvalidEmail' });
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.adminServer.invite(conn.value, email);
  };
