import type { PairingCode } from '@mes-courses/sync-core';

import type { Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncFailure, SyncServer } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

/** "Ajouter un appareil": a one-time code for another device (US4-3). */
export const createCreatePairingCode =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    syncServer: SyncServer;
  }) =>
  async (): Promise<Result<PairingCode, SyncFailure>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.syncServer.createPairingCode(conn.value);
  };
