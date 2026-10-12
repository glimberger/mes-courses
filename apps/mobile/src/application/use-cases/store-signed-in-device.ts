import { decideLocalCopy } from '../../domain/local-copy-rule';
import { err, ok, type Result } from '../../domain/result';
import type { AccountPairing } from '../ports/account-server';
import type { CredentialStore } from '../ports/credential-store';
import type { LocalDataEraser } from '../ports/local-data-eraser';
import type { UnitOfWork } from '../ports/unit-of-work';

/** The address typed is not a usable server address. */
export type InvalidUrl = { type: 'InvalidUrl' };

/** The credential or the connection could not be saved on this device. */
export type StorageFailed = { type: 'StorageFailed' };

export type SignedInDeviceDeps = {
  unitOfWork: UnitOfWork;
  credentials: CredentialStore;
  localDataEraser: LocalDataEraser;
};

/**
 * Keeps the device the server just authorized: applies the local copy rule (the data of another
 * account is erased before the credential is stored), then stores the credential and the
 * connection fields, resetting `lastSeq` and `snapshotDone`. The credential comes first: a
 * connection with no credential reads as disconnected (FR-018b), while a credential with no
 * connection is simply unused.
 */
export const storeSignedInDevice = async (
  { unitOfWork, credentials, localDataEraser }: SignedInDeviceDeps,
  url: string,
  pairing: AccountPairing,
): Promise<Result<void, StorageFailed>> => {
  try {
    const copy = await unitOfWork.run((repos) => repos.syncState.get());
    if (
      decideLocalCopy(copy.accountId, copy.serverUrl, pairing.accountId) ===
      'erase'
    ) {
      await localDataEraser.erase();
    }
    await credentials.write(pairing.credential);
    await unitOfWork.run(async (repos) => {
      const current = await repos.syncState.get();
      await repos.syncState.save({
        ...current,
        serverUrl: url,
        serverId: pairing.serverId,
        deviceId: pairing.deviceId,
        accountId: pairing.accountId,
        lastSeq: 0,
        lastSyncAt: null,
        // The first sync re-stamps the snapshot with the new device id (research R13).
        snapshotDone: false,
      });
    });
  } catch {
    return err({ type: 'StorageFailed' });
  }
  return ok(undefined);
};
