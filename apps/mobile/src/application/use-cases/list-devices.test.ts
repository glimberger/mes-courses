import { err, ok } from '../../domain/result';
import { conn, pairedDevice } from '../testing/paired-device';
import { createListDevices } from './list-devices';

const summary = (id: string) => ({
  id,
  name: `Phone ${id}`,
  createdAt: '2026-09-01T10:00:00.000Z',
  lastSyncAt: null,
});

describe('listDevices', () => {
  it('003 US4-8 marks this device with isThisDevice', async () => {
    const { unitOfWork, credentials, syncServer, calls } = await pairedDevice({
      listDevices: async () => ok([summary('device-2'), summary('device-1')]),
    });

    const result = await createListDevices({
      unitOfWork,
      credentials,
      syncServer,
    })();

    expect(result).toEqual(
      ok([
        { ...summary('device-2'), isThisDevice: false },
        { ...summary('device-1'), isThisDevice: true },
      ]),
    );
    expect(calls).toEqual([]);
    void conn;
  });

  it('returns the failure as it is', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice({
      listDevices: async () => err({ type: 'ServerError' }),
    });

    expect(
      await createListDevices({ unitOfWork, credentials, syncServer })(),
    ).toEqual(err({ type: 'ServerError' }));
  });
});
