import type { CredentialStore } from '../ports/credential-store';
import type { UnitOfWork } from '../ports/unit-of-work';

/** What the status bar and Settings show about the server. */
export type SyncInfo = {
  serverUrl: string | null;
  lastSyncAt: string | null;
  /** The changes waiting to be sent, held ones excluded. */
  pendingCount: number;
  connection: 'notConnected' | 'connected' | 'disconnectedByServer';
};

/**
 * A server address with no stored credential is a phone restored from a backup: the connection is
 * lost, though its data is kept (FR-018b).
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
    const { serverUrl, lastSyncAt, pendingCount } = await unitOfWork.run(
      async (repos) => ({
        ...(await repos.syncState.get()),
        pendingCount: await repos.changes.count(),
      }),
    );
    if (serverUrl === null) {
      return {
        serverUrl,
        lastSyncAt,
        pendingCount,
        connection: 'notConnected',
      };
    }
    const credential = await credentials.read();
    return {
      serverUrl,
      lastSyncAt,
      pendingCount,
      connection: credential === null ? 'disconnectedByServer' : 'connected',
    };
  };
