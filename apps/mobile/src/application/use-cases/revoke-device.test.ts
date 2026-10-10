import { err, ok } from '../../domain/result';
import { conn, pairedDevice } from '../testing/paired-device';
import { createRevokeDevice } from './revoke-device';

describe('revokeDevice', () => {
  it('003 US4-9 revokes the device on the server', async () => {
    const { unitOfWork, credentials, syncServer, calls } = await pairedDevice();

    const result = await createRevokeDevice({
      unitOfWork,
      credentials,
      syncServer,
    })('device-2');

    expect(result).toEqual(ok(undefined));
    expect(calls).toEqual([['revokeDevice', conn, 'device-2']]);
  });

  it('returns NotFound and Offline as they are', async () => {
    const notFound = await pairedDevice({
      revokeDevice: async () => err({ type: 'NotFound' }),
    });
    const offline = await pairedDevice({
      revokeDevice: async () => err({ type: 'Offline' }),
    });

    expect(await createRevokeDevice(notFound)('x')).toEqual(
      err({ type: 'NotFound' }),
    );
    expect(await createRevokeDevice(offline)('x')).toEqual(
      err({ type: 'Offline' }),
    );
  });
});
