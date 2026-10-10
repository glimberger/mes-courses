import { err, ok } from '../../domain/result';
import { createCreatePairingCode } from './create-pairing-code';
import { conn, pairedDevice } from '../testing/paired-device';

describe('createPairingCode', () => {
  it('003 US4-3 asks the server for a code with this device connection', async () => {
    const { unitOfWork, credentials, syncServer, calls } = await pairedDevice();

    const result = await createCreatePairingCode({
      unitOfWork,
      credentials,
      syncServer,
    })();

    expect(result).toEqual(
      ok({ code: 'ABCD-EF23', expiresAt: '2026-10-01T10:10:00.000Z' }),
    );
    expect(calls).toEqual([['createPairingCode', conn]]);
  });

  it('returns the Offline failure as it is', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice({
      createPairingCode: async () => err({ type: 'Offline' }),
    });

    expect(
      await createCreatePairingCode({ unitOfWork, credentials, syncServer })(),
    ).toEqual(err({ type: 'Offline' }));
  });

  it('reports DeviceNotAuthorized, with no request, when there is no connection', async () => {
    const { unitOfWork, credentials, syncServer, calls } = await pairedDevice();
    await credentials.clear();

    const result = await createCreatePairingCode({
      unitOfWork,
      credentials,
      syncServer,
    })();

    expect(result).toEqual(err({ type: 'DeviceNotAuthorized' }));
    expect(calls).toEqual([]);
  });
});
