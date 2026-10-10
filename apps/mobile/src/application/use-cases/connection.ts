import type { CredentialStore } from '../ports/credential-store';
import type { Connection, DeviceNotAuthorized } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { err, ok, type Result } from '../../domain/result';

/**
 * What a request to the server needs, built from `sync_state` and the credential store. A device
 * with no address, no device id or no credential is not connected: the same failure as a server
 * that refuses it (FR-018b).
 */
export const currentConnection = async ({
  unitOfWork,
  credentials,
}: {
  unitOfWork: UnitOfWork;
  credentials: CredentialStore;
}): Promise<Result<Connection, DeviceNotAuthorized>> => {
  const { serverUrl, deviceId } = await unitOfWork.run((repos) =>
    repos.syncState.get(),
  );
  const credential = await credentials.read();
  if (serverUrl === null || deviceId === null || credential === null) {
    return err({ type: 'DeviceNotAuthorized' });
  }
  return ok({ url: serverUrl, deviceId, credential });
};
