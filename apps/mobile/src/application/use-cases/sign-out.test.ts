import { err, ok } from '../../domain/result';
import type { LocalDataEraser } from '../ports/local-data-eraser';
import { conn, pairedDevice } from '../testing/paired-device';
import { createSignOut } from './sign-out';

const setup = async (overrides: Parameters<typeof pairedDevice>[0] = {}) => {
  const device = await pairedDevice(overrides);
  const erased: string[] = [];
  const localDataEraser: LocalDataEraser = {
    erase: async () => {
      // The credential was already cleared when the copy goes.
      erased.push((await device.credentials.read()) ?? 'no credential');
    },
  };
  return {
    ...device,
    erased,
    signOut: createSignOut({ ...device, localDataEraser }),
  };
};

describe('signOut', () => {
  it('004 US6-4 revokes this device, clears the credential and then erases the copy', async () => {
    const { signOut, calls, credentials, erased } = await setup();

    expect(await signOut()).toEqual(ok(undefined));

    expect(calls).toEqual([['revokeDevice', conn, 'device-1']]);
    expect(await credentials.read()).toBeNull();
    expect(erased).toEqual(['no credential']);
  });

  it('004 US6-4 works offline: it only clears locally', async () => {
    const { signOut, credentials, erased } = await setup({
      revokeDevice: async () => err({ type: 'Offline' }),
    });

    expect(await signOut()).toEqual(ok(undefined));

    expect(await credentials.read()).toBeNull();
    expect(erased).toHaveLength(1);
  });

  it('004 signs out even when the server refuses the revocation', async () => {
    const { signOut, credentials, erased } = await setup({
      revokeDevice: async () => err({ type: 'DeviceNotAuthorized' }),
    });

    expect(await signOut()).toEqual(ok(undefined));

    expect(await credentials.read()).toBeNull();
    expect(erased).toHaveLength(1);
  });

  it('004 makes no request for a device with no credential', async () => {
    const { signOut, calls, credentials, erased } = await setup();
    await credentials.clear();

    await signOut();

    expect(calls).toEqual([]);
    expect(erased).toHaveLength(1);
  });
});
