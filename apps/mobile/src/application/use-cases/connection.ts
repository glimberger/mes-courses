import type { CredentialStore } from '../ports/credential-store';
import type { Connection, DeviceNotAuthorized } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { err, ok, type Result } from '../../domain/result';

/**
 * What a request to the server needs: the fixed server address, the device id from `sync_state`
 * and the credential. A device with no device id or no credential is not connected: the same
 * failure as a server that refuses it (FR-018b). The stored address is never read (013).
 */
export const currentConnection = async ({
  unitOfWork,
  credentials,
  serverUrl,
}: {
  unitOfWork: UnitOfWork;
  credentials: CredentialStore;
  /** The sync server address fixed at build time. */
  serverUrl: string;
}): Promise<Result<Connection, DeviceNotAuthorized>> => {
  const { deviceId } = await unitOfWork.run((repos) => repos.syncState.get());
  const credential = await credentials.read();
  if (deviceId === null || credential === null) {
    return err({ type: 'DeviceNotAuthorized' });
  }
  return ok({ url: serverUrl, deviceId, credential });
};
