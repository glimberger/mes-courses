import { err, ok } from '../../domain/result';
import { conn, pairedDevice } from '../testing/paired-device';
import { createDisconnect } from './disconnect';

describe('disconnect', () => {
  it('003 US4-11 revokes itself, clears the credential and the connection', async () => {
    const { unitOfWork, credentials, syncServer, calls, syncState } =
      await pairedDevice();

    const result = await createDisconnect({
      unitOfWork,
      credentials,
      syncServer,
    })();

    expect(result).toEqual(ok(undefined));
    expect(calls).toEqual([['revokeDevice', conn, 'device-1']]);
    expect(await credentials.read()).toBeNull();
    expect(await syncState()).toMatchObject({
      serverUrl: null,
      serverId: null,
      deviceId: null,
      lastSeq: 0,
      lastSyncAt: null,
      snapshotDone: false,
    });
  });

  it('is best effort: an unreachable server does not stop it', async () => {
    const { unitOfWork, credentials, syncServer, syncState } =
      await pairedDevice({
        revokeDevice: async () => err({ type: 'Offline' }),
      });

    const result = await createDisconnect({
      unitOfWork,
      credentials,
      syncServer,
    })();

    expect(result).toEqual(ok(undefined));
    expect(await credentials.read()).toBeNull();
    expect((await syncState()).serverUrl).toBeNull();
  });

  it('keeps the local data and the outbox', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice();
    await unitOfWork.run((repos) =>
      repos.changes.record('list', 'l1', { name: 'Courses' }),
    );

    await createDisconnect({ unitOfWork, credentials, syncServer })();

    expect(await unitOfWork.run((repos) => repos.changes.count())).toBe(1);
  });

  it('works without a stored credential (a restored phone): no request', async () => {
    const { unitOfWork, credentials, syncServer, calls, syncState } =
      await pairedDevice();
    await credentials.clear();

    await createDisconnect({ unitOfWork, credentials, syncServer })();

    expect(calls).toEqual([]);
    expect((await syncState()).serverUrl).toBeNull();
  });
});
