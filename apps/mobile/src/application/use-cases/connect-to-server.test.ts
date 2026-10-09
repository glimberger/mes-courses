import type { HealthInfo, Pairing } from '@mes-courses/sync-core';
import { err, ok } from '../../domain/result';
import type { SyncServer } from '../ports/sync-server';
import { initialSyncState } from '../ports/sync-state';
import type { UnitOfWork } from '../ports/unit-of-work';
import { InMemoryCredentialStore } from '../testing/in-memory-credential-store';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createConnectToServer } from './connect-to-server';

const health: HealthInfo = {
  serverId: 'server-1',
  apiVersion: 1,
  minAppVersion: '1.0.0',
};
const pairing: Pairing = {
  ...health,
  deviceId: 'device-1',
  credential: 'secret-credential',
};

describe('connectToServer', () => {
  let unitOfWork: UnitOfWork;
  let credentials: InMemoryCredentialStore;
  let calls: string[];
  let syncServer: SyncServer;
  let healthResult: Awaited<ReturnType<SyncServer['health']>>;
  let claimResult: Awaited<ReturnType<SyncServer['claim']>>;

  const connect = (
    url: string,
    code = 'ABCD-EF23',
    options: { allowInsecure?: boolean } = {},
  ) =>
    createConnectToServer({
      unitOfWork,
      syncServer,
      credentials,
      ...options,
    })(url, code, 'Pixel de Léa');
  const syncState = () => unitOfWork.run((repos) => repos.syncState.get());

  beforeEach(() => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    credentials = new InMemoryCredentialStore();
    calls = [];
    healthResult = ok(health);
    claimResult = ok(pairing);
    syncServer = {
      health: async (url) => {
        calls.push(`health ${url}`);
        return healthResult;
      },
      claim: async (url, code, deviceName) => {
        calls.push(`claim ${url} ${code} ${deviceName}`);
        return claimResult;
      },
    } as SyncServer;
  });

  it('US4-4 adds https:// to "courses.example.fr"', async () => {
    const outcome = await connect('courses.example.fr');

    expect(outcome).toEqual(ok(undefined));
    expect(calls).toEqual([
      'health https://courses.example.fr',
      'claim https://courses.example.fr ABCD-EF23 Pixel de Léa',
    ]);
  });

  it.each([
    ['  courses.example.fr/  ', 'https://courses.example.fr'],
    ['https://courses.example.fr///', 'https://courses.example.fr'],
    ['HTTPS://Courses.Example.fr:8443', 'https://courses.example.fr:8443'],
  ])('normalizes "%s" to %s', async (typed, normalized) => {
    await connect(typed);

    expect(calls[0]).toBe(`health ${normalized}`);
  });

  it.each(['', '   ', 'ftp://courses.example.fr', 'not a url', 'https://'])(
    'rejects "%s" as InvalidUrl, without calling the server',
    async (typed) => {
      const outcome = await connect(typed);

      expect(outcome).toEqual(err({ type: 'InvalidUrl' }));
      expect(calls).toEqual([]);
      expect(await syncState()).toEqual(initialSyncState());
    },
  );

  it('FR-019 rejects http:// as InvalidUrl', async () => {
    const outcome = await connect('http://courses.example.fr');

    expect(outcome).toEqual(err({ type: 'InvalidUrl' }));
    expect(calls).toEqual([]);
  });

  it('accepts a plain-http address in development builds', async () => {
    const outcome = await connect('http://10.0.2.2:3000', 'ABCD-EF23', {
      allowInsecure: true,
    });

    expect(outcome).toEqual(ok(undefined));
    expect(calls[0]).toBe('health http://10.0.2.2:3000');
  });

  it('calls health before claim', async () => {
    await connect('courses.example.fr');

    expect(calls.map((call) => call.split(' ')[0])).toEqual([
      'health',
      'claim',
    ]);
  });

  it.each([
    ['ServerUnreachable', { type: 'ServerUnreachable' }],
    ['UntrustedServer', { type: 'UntrustedServer' }],
  ] as const)(
    'US4-6 %s from health changes nothing and never claims',
    async (_name, failure) => {
      healthResult = err(failure);

      const outcome = await connect('courses.example.fr');

      expect(outcome).toEqual(err(failure));
      expect(calls).toEqual(['health https://courses.example.fr']);
      expect(await credentials.read()).toBeNull();
      expect(await syncState()).toEqual(initialSyncState());
    },
  );

  it.each([
    ['InvalidCode', { type: 'InvalidCode' }],
    ['TooManyAttempts', { type: 'TooManyAttempts', minutesToWait: 10 }],
    ['ServerUnreachable', { type: 'ServerUnreachable' }],
    ['UntrustedServer', { type: 'UntrustedServer' }],
  ] as const)('%s from claim changes nothing', async (_name, failure) => {
    claimResult = err(failure);

    const outcome = await connect('courses.example.fr');

    expect(outcome).toEqual(err(failure));
    expect(await credentials.read()).toBeNull();
    expect(await syncState()).toEqual(initialSyncState());
  });

  it('stores the credential in the CredentialStore only', async () => {
    await connect('courses.example.fr');

    expect(await credentials.read()).toBe('secret-credential');
    expect(JSON.stringify(await syncState())).not.toContain(
      'secret-credential',
    );
  });

  it('saves serverUrl, serverId and deviceId with lastSeq = 0 and snapshotDone = false', async () => {
    await unitOfWork.run((repos) =>
      repos.syncState.save({
        ...initialSyncState(),
        lastSeq: 42,
        snapshotDone: true,
      }),
    );

    await connect('courses.example.fr');

    expect(await syncState()).toEqual({
      ...initialSyncState(),
      serverUrl: 'https://courses.example.fr',
      serverId: 'server-1',
      deviceId: 'device-1',
      lastSeq: 0,
      snapshotDone: false,
    });
  });

  it('keeps the HLC state, which never moves backwards', async () => {
    const before = await syncState();

    await connect('courses.example.fr');

    expect((await syncState()).maxHlc).toEqual(before.maxHlc);
  });

  it('forgets the last sync of the previous server', async () => {
    await unitOfWork.run((repos) =>
      repos.syncState.save({
        ...initialSyncState(),
        lastSyncAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    await connect('courses.example.fr');

    expect((await syncState()).lastSyncAt).toBeNull();
  });

  it('returns StorageFailed when the credential cannot be written', async () => {
    credentials.write = async () => {
      throw new Error('keychain unavailable');
    };

    const outcome = await connect('courses.example.fr');

    expect(outcome).toEqual(err({ type: 'StorageFailed' }));
    expect((await syncState()).serverUrl).toBeNull();
  });
});
