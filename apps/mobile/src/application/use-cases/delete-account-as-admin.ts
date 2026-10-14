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

export type DeleteAccountAsAdminError =
  LastAdministrator | AccountNotFound | SyncFailure | Forbidden;

/** Deletes an account and everything it owns from the server, without return (US5-4, US5-5). */
export const createDeleteAccountAsAdmin =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    adminServer: AdminServer;
  }) =>
  async (id: string): Promise<Result<void, DeleteAccountAsAdminError>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.adminServer.delete(conn.value, id);
  };
