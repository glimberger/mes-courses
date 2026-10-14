import { ok, type Result } from '../../domain/result';
import type {
  AccountServer,
  DeleteOwnAccountServerError,
} from '../ports/account-server';
import type { CredentialStore } from '../ports/credential-store';
import type { LocalDataEraser } from '../ports/local-data-eraser';
import type { DeviceNotAuthorized } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { currentConnection } from './connection';

export type DeleteMyAccountError =
  DeviceNotAuthorized | DeleteOwnAccountServerError;

/**
 * Deletes the signed-in account from the server after checking the password (US6-6), then leaves
 * as `signOut` does without revoking: the server already ended this device. Nothing changes on
 * the device unless the server deleted the account.
 */
export const createDeleteMyAccount =
  (deps: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
    accountServer: AccountServer;
    localDataEraser: LocalDataEraser;
  }) =>
  async (password: string): Promise<Result<void, DeleteMyAccountError>> => {
    const conn = await currentConnection(deps);
    if (!conn.ok) return conn;
    const deleted = await deps.accountServer.deleteAccount(
      conn.value,
      password,
    );
    if (!deleted.ok) return deleted;
    await deps.credentials.clear();
    await deps.localDataEraser.erase();
    return ok(undefined);
  };
