import type { CredentialStore } from '../ports/credential-store';
import type { UnitOfWork } from '../ports/unit-of-work';

/** What the status bar and Settings show about the server. */
export type SyncInfo = {
  lastSyncAt: string | null;
  /** The changes waiting to be sent, held ones excluded. */
  pendingCount: number;
  connection: 'notConnected' | 'connected' | 'signedOut';
};

/**
 * A device is connected once paired (it has a device id; the stored address is never read, 013).
 * A pairing with no stored credential is a phone restored from a backup: the connection is lost,
 * though its data is kept (FR-018b).
 */
export const createGetSyncInfo =
  ({
    unitOfWork,
    credentials,
  }: {
    unitOfWork: UnitOfWork;
    credentials: CredentialStore;
  }) =>
  async (): Promise<SyncInfo> => {
    const { deviceId, lastSyncAt, pendingCount } = await unitOfWork.run(
      async (repos) => ({
        ...(await repos.syncState.get()),
        pendingCount: await repos.changes.count(),
      }),
    );
    if (deviceId === null) {
      return { lastSyncAt, pendingCount, connection: 'notConnected' };
    }
    const credential = await credentials.read();
    return {
      lastSyncAt,
      pendingCount,
      connection: credential === null ? 'signedOut' : 'connected',
    };
  };
