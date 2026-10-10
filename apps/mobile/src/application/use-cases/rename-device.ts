import { validateName, type NameError } from '../../domain/name';
import { err, type Result } from '../../domain/result';
import type { CredentialStore } from '../ports/credential-store';
import type {
  DeviceNotFound,
  SyncFailure,
  SyncServer,
} from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

/** Renames a device; the name follows the same rules as every other name (FR-019c). */
export const createRenameDevice =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    syncServer: SyncServer;
  }) =>
  async (
    id: string,
    name: string,
  ): Promise<Result<void, NameError | SyncFailure | DeviceNotFound>> => {
    const valid = validateName(name);
    if (!valid.ok) return err(valid.error);
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    return deps.syncServer.renameDevice(conn.value, id, valid.value);
  };
