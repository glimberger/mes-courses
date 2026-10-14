import type { Result } from '../../domain/result';
import type {
  AccountNotFound,
  AdminServer,
  Forbidden,
  MailFailed,
  NotInvited,
} from '../ports/admin-server';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

export type ResendCredentialsError =
  NotInvited | MailFailed | AccountNotFound | SyncFailure | Forbidden;

/** Sends a new temporary password to an account that never signed in; the old one stops working (US5-6). */
export const createResendCredentials =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    adminServer: AdminServer;
  }) =>
  async (id: string): Promise<Result<void, ResendCredentialsError>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.adminServer.resendCredentials(conn.value, id);
  };
