import type { Result } from '../../domain/result';
import type {
  AccountNotFound,
  AdminServer,
  Forbidden,
  LastAdministrator,
} from '../ports/admin-server';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

export type SuspendAccountError =
  LastAdministrator | AccountNotFound | SyncFailure | Forbidden;

/** Suspends an account: it can no longer sign in or sync, its data is kept (US5-2, US5-5). */
export const createSuspendAccount =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    adminServer: AdminServer;
  }) =>
  async (id: string): Promise<Result<void, SuspendAccountError>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.adminServer.suspend(conn.value, id);
  };
