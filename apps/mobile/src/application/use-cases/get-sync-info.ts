import type { CredentialStore } from '../ports/credential-store';
import type { UnitOfWork } from '../ports/unit-of-work';

/** What the status bar and Settings show about the server. */
export type SyncInfo = {
  serverUrl: string | null;
  lastSyncAt: string | null;
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
    const { serverUrl, lastSyncAt } = await unitOfWork.run((repos) =>
      repos.syncState.get(),
    );
    if (serverUrl === null) {
      return { serverUrl, lastSyncAt, connection: 'notConnected' };
    }
    const credential = await credentials.read();
    return {
      serverUrl,
      lastSyncAt,
      connection: credential === null ? 'disconnectedByServer' : 'connected',
    };
  };
