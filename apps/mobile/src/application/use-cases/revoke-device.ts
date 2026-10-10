import type { Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type {
  DeviceNotFound,
  SyncFailure,
  SyncServer,
} from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

/** Revokes another device (US4-9). Revoking this one goes through `disconnect`. */
export const createRevokeDevice =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    syncServer: SyncServer;
  }) =>
  async (id: string): Promise<Result<void, SyncFailure | DeviceNotFound>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.syncServer.revokeDevice(conn.value, id);
  };
