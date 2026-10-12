import { InMemoryAccountServer } from '../testing/in-memory-account-server';
import { pairedDevice } from '../testing/paired-device';
import { ok } from '../../domain/result';
import { createGetAccountSettings } from './get-account-settings';

const device = {
  id: 'device-1',
  name: 'Pixel',
  createdAt: '2026-09-01T10:00:00.000Z',
  lastSyncAt: null,
};

describe('getAccountSettings', () => {
  it('004 US6-1 returns the sync info, the account and the devices of a signed-in device', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice({
      listDevices: async () => ok([device]),
    });
    const accountServer = new InMemoryAccountServer({
      id: 'account-1',
      email: 'admin@example.org',
      role: 'administrator',
    });

    const settings = await createGetAccountSettings({
      unitOfWork,
      credentials,
      syncServer,
      accountServer,
    })();

    expect(settings.sync.connection).toBe('connected');
    expect(settings.account).toEqual(
      ok({
        id: 'account-1',
        email: 'admin@example.org',
        role: 'administrator',
      }),
    );
    expect(settings.devices).toEqual(ok([{ ...device, isThisDevice: true }]));
  });

  it('004 US6-1 asks the server for the role on every call', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice();
    const accountServer = new InMemoryAccountServer();
    const getAccountSettings = createGetAccountSettings({
      unitOfWork,
      credentials,
      syncServer,
      accountServer,
    });

    accountServer.account = { ...accountServer.account, role: 'administrator' };
    const first = await getAccountSettings();
    accountServer.account = { ...accountServer.account, role: 'user' };
    const second = await getAccountSettings();

    expect(first.account).toMatchObject({ value: { role: 'administrator' } });
    expect(second.account).toMatchObject({ value: { role: 'user' } });
  });

  it('004 US6-1 offline, the address is not available and the devices have their error state', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice({
      listDevices: async () => ({ ok: false, error: { type: 'Offline' } }),
    });
    const accountServer = new InMemoryAccountServer();
    accountServer.offline = true;

    const settings = await createGetAccountSettings({
      unitOfWork,
      credentials,
      syncServer,
      accountServer,
    })();

    expect(settings.account).toEqual({ ok: false, error: { type: 'Offline' } });
    expect(settings.devices).toEqual({ ok: false, error: { type: 'Offline' } });
  });

  it('004 returns nothing about an account for a device that never signed in', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice();
    await unitOfWork.run(async (repos) => {
      await repos.syncState.save({
        ...(await repos.syncState.get()),
        serverUrl: null,
        deviceId: null,
      });
    });

    const settings = await createGetAccountSettings({
      unitOfWork,
      credentials,
      syncServer,
      accountServer: new InMemoryAccountServer(),
    })();

    expect(settings.sync.connection).toBe('notConnected');
    expect(settings.account).toBeNull();
    expect(settings.devices).toBeNull();
  });
});
