import { ok, type Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type { SyncServer } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

/**
 * Disconnects this device (US4-11): it revokes itself on the server when it can (best effort),
 * clears the credential and the connection fields, and keeps the local data and the outbox.
 */
export const createDisconnect =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    syncServer: SyncServer;
  }) =>
  async (): Promise<Result<void, never>> => {
    const conn = await currentConnection(deps);
    if (conn.ok) {
      await deps.syncServer.revokeDevice(conn.value, conn.value.deviceId);
    }
    // The credential first: a connection with no credential already reads as disconnected.
    await deps.credentials.clear();
    await deps.unitOfWork.run(async (repos) => {
      const current = await repos.syncState.get();
      await repos.syncState.save({
        ...current,
        serverUrl: null,
        serverId: null,
        deviceId: null,
        lastSeq: 0,
        lastSyncAt: null,
        snapshotDone: false,
      });
    });
    return ok(undefined);
  };
