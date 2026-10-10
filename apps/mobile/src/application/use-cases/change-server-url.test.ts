import type { HealthInfo } from '@mes-courses/sync-core';

import { err, ok } from '../../domain/result';
import { createChangeServerUrl } from './change-server-url';
import { pairedDevice } from '../testing/paired-device';

const health = (serverId: string): HealthInfo => ({
  serverId,
  apiVersion: 1,
  minAppVersion: '1.0.0',
});

const setup = async (
  healthResult: Awaited<
    ReturnType<import('../ports/sync-server').SyncServer['health']>
  >,
  options: { allowInsecure?: boolean } = {},
) => {
  const device = await pairedDevice();
  const asked: unknown[][] = device.calls;
  device.syncServer.health = async (url) => {
    asked.push(['health', url]);
    return healthResult;
  };
  await device.unitOfWork.run((repos) =>
    repos.changes.record('list', 'l1', { name: 'Courses' }),
  );
  const change = (typed: string) =>
    createChangeServerUrl({
      unitOfWork: device.unitOfWork,
      syncServer: device.syncServer,
      ...options,
    })(typed);
  return { ...device, change };
};

describe('changeServerUrl', () => {
  it('keeps the credential, the outbox and lastSeq when the serverId matches', async () => {
    const { change, syncState, credentials, unitOfWork } = await setup(
      ok(health('server-1')),
    );

    const result = await change(' New.Example.fr/ ');

    expect(result).toEqual(ok(undefined));
    expect(await syncState()).toMatchObject({
      serverUrl: 'https://new.example.fr',
      serverId: 'server-1',
      deviceId: 'device-1',
      lastSeq: 7,
      snapshotDone: true,
    });
    expect(await credentials.read()).toBe('secret-credential');
    expect(await unitOfWork.run((repos) => repos.changes.count())).toBe(1);
  });

  it('refuses a server with another identity and changes nothing', async () => {
    const { change, syncState } = await setup(ok(health('server-2')));

    expect(await change('new.example.fr')).toEqual(
      err({ type: 'ServerMismatch' }),
    );
    expect((await syncState()).serverUrl).toBe('https://courses.example.fr');
  });

  it.each([
    [{ type: 'ServerUnreachable' as const }],
    [{ type: 'UntrustedServer' as const }],
  ])('returns %o as such and changes nothing', async (failure) => {
    const { change, syncState } = await setup(err(failure));

    expect(await change('new.example.fr')).toEqual(err(failure));
    expect((await syncState()).serverUrl).toBe('https://courses.example.fr');
  });

  it('refuses an unusable or http address before any request', async () => {
    const { change, calls } = await setup(ok(health('server-1')));

    expect(await change('http://new.example.fr')).toEqual(
      err({ type: 'InvalidUrl' }),
    );
    expect(await change('not a url')).toEqual(err({ type: 'InvalidUrl' }));
    expect(calls).toEqual([]);
  });

  it('accepts http only when the composition allows it', async () => {
    const { change, syncState } = await setup(ok(health('server-1')), {
      allowInsecure: true,
    });

    expect(await change('http://192.168.1.20:3000')).toEqual(ok(undefined));
    expect((await syncState()).serverUrl).toBe('http://192.168.1.20:3000');
  });
});
