import { InMemoryCredentialStore } from '../testing/in-memory-credential-store';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetSyncInfo } from './get-sync-info';

describe('getSyncInfo', () => {
  let unitOfWork: InMemoryUnitOfWork;
  let credentials: InMemoryCredentialStore;
  const getSyncInfo = () => createGetSyncInfo({ unitOfWork, credentials })();
  const connect = (lastSyncAt: string | null = null) =>
    unitOfWork.run(async (repos) => {
      await repos.syncState.save({
        ...(await repos.syncState.get()),
        deviceId: 'device-1',
        lastSyncAt,
      });
    });

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    credentials = new InMemoryCredentialStore();
  });

  it('reports notConnected when the device was never paired', async () => {
    expect(await getSyncInfo()).toEqual({
      lastSyncAt: null,
      pendingCount: 0,
      connection: 'notConnected',
    });
  });

  it('013 reports notConnected without a device id, whatever address is stored', async () => {
    await unitOfWork.run(async (repos) => {
      await repos.syncState.save({
        ...(await repos.syncState.get()),
        serverUrl: 'https://courses.example.fr',
      });
    });
    await credentials.write('secret');

    expect((await getSyncInfo()).connection).toBe('notConnected');
  });

  it('reports connected with the last sync, and no address', async () => {
    await connect('2026-10-01T10:00:00.000Z');
    await credentials.write('secret');

    expect(await getSyncInfo()).toEqual({
      lastSyncAt: '2026-10-01T10:00:00.000Z',
      pendingCount: 0,
      connection: 'connected',
    });
  });

  it('FR-018b reports signedOut when the credential is gone', async () => {
    await connect();

    expect(await getSyncInfo()).toEqual({
      lastSyncAt: null,
      pendingCount: 0,
      connection: 'signedOut',
    });
  });
});
