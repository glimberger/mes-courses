import type { Result } from '../../domain/result';
import type {
  AccountNotFound,
  AdminServer,
  Forbidden,
} from '../ports/admin-server';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

export type ReactivateAccountError = AccountNotFound | SyncFailure | Forbidden;

/** Lifts a suspension: its devices sync again with no new sign-in (US5-3). */
export const createReactivateAccount =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    adminServer: AdminServer;
  }) =>
  async (id: string): Promise<Result<void, ReactivateAccountError>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.adminServer.reactivate(conn.value, id);
  };
