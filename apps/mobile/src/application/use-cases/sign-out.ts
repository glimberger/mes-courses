import { ok, type Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type { LocalDataEraser } from '../ports/local-data-eraser';
import type { SyncServer } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

/**
 * Signs this device out (US6-4, research R11): it revokes itself on the server when it can (best
 * effort; offline, the unused device is left for its owner to revoke), clears the credential, then
 * erases the local copy. The credential goes first: if the erasure fails, the address with no
 * credential still reads as signed out and the copy is erased by the notice that follows.
 */
export const createSignOut =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    syncServer: SyncServer;
    localDataEraser: LocalDataEraser;
  }) =>
  async (): Promise<Result<void, never>> => {
    const conn = await currentConnection(deps);
    if (conn.ok) {
      await deps.syncServer.revokeDevice(conn.value, conn.value.deviceId);
    }
    await deps.credentials.clear();
    await deps.localDataEraser.erase();
    return ok(undefined);
  };
