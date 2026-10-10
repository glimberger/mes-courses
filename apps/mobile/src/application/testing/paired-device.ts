import { ok } from '../../domain/result';
import type { SyncServer } from '../ports/sync-server';
import type { UnitOfWork } from '../ports/unit-of-work';
import { InMemoryCredentialStore } from './in-memory-credential-store';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from './in-memory-repositories';

/** A paired device with a fake `SyncServer` that records its calls (device use case tests). */
export const pairedDevice = async (overrides: Partial<SyncServer> = {}) => {
  const unitOfWork: UnitOfWork = new InMemoryUnitOfWork(
    new InMemoryRepositories(),
  );
  const credentials = new InMemoryCredentialStore('secret-credential');
  await unitOfWork.run(async (repos) => {
    await repos.syncState.save({
      ...(await repos.syncState.get()),
      serverUrl: 'https://courses.example.fr',
      serverId: 'server-1',
      deviceId: 'device-1',
      lastSeq: 7,
      lastSyncAt: '2026-10-01T10:00:00.000Z',
      snapshotDone: true,
    });
  });
  const calls: unknown[][] = [];
  const record =
    <A extends unknown[]>(name: string, result: unknown) =>
    async (...args: A) => {
      calls.push([name, ...args]);
      return result;
    };
  const syncServer = {
    createPairingCode: record(
      'createPairingCode',
      ok({ code: 'ABCD-EF23', expiresAt: '2026-10-01T10:10:00.000Z' }),
    ),
    listDevices: record('listDevices', ok([])),
    renameDevice: record('renameDevice', ok(undefined)),
    revokeDevice: record('revokeDevice', ok(undefined)),
    health: record('health', ok({})),
    ...overrides,
  } as unknown as SyncServer;
  const syncState = () => unitOfWork.run((repos) => repos.syncState.get());
  return { unitOfWork, credentials, syncServer, calls, syncState };
};

export const conn = {
  url: 'https://courses.example.fr',
  deviceId: 'device-1',
  credential: 'secret-credential',
};
