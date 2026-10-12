import type { AccountSummary } from '@mes-courses/sync-core';

import type { Result } from '../../domain/result';
import type { AdminServer, Forbidden } from '../ports/admin-server';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

/** The accounts of the server, for an administrator (US5-1). */
export const createListAccounts =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    adminServer: AdminServer;
  }) =>
  async (): Promise<Result<AccountSummary[], SyncFailure | Forbidden>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.adminServer.listAccounts(conn.value);
  };
