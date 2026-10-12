import {
  createAccountServer,
  createAdminServer,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const APP_VERSION = '1.0.0';

describe('AdminServer and AccountServer HTTP adapters', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  const connection = (credential: string) => ({
    url: server.url,
    deviceId: 'device-1',
    credential,
  });

  it('004 US5-1 lists the accounts for an administrator', async () => {
    const admin = await server.createAccount({
      role: 'administrator',
      email: 'admin@example.org',
    });
    const adminServer = createAdminServer({ appVersion: APP_VERSION });

    const result = await adminServer.listAccounts(
      connection(admin.deviceCredential),
    );

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: admin.accountId,
          email: 'admin@example.org',
          role: 'administrator',
          state: 'active',
          lastSyncAt: null,
          invitationExpired: false,
        },
      ],
    });
  });

  it('004 US1-1 invites an address and the server sends the email', async () => {
    const admin = await server.createAccount({ role: 'administrator' });
    const adminServer = createAdminServer({ appVersion: APP_VERSION });

    const result = await adminServer.invite(
      connection(admin.deviceCredential),
      'marie@example.org',
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        email: 'marie@example.org',
        state: 'invited',
      }),
    });
    expect(server.mails()).toEqual([
      expect.objectContaining({ kind: 'invitation', to: 'marie@example.org' }),
    ]);
  });

  it('004 US1-2 reports an address that already has an account', async () => {
    const admin = await server.createAccount({ role: 'administrator' });
    await server.createAccount({ email: 'marie@example.org' });
    const adminServer = createAdminServer({ appVersion: APP_VERSION });

    expect(
      await adminServer.invite(
        connection(admin.deviceCredential),
        'marie@example.org',
      ),
    ).toEqual({ ok: false, error: { type: 'AccountExists' } });
    expect(server.mails()).toEqual([]);
  });

  it('004 US1-3 reports an address that is not valid', async () => {
    const admin = await server.createAccount({ role: 'administrator' });
    const adminServer = createAdminServer({ appVersion: APP_VERSION });

    expect(
      await adminServer.invite(connection(admin.deviceCredential), 'nope'),
    ).toEqual({ ok: false, error: { type: 'InvalidEmail' } });
  });

  it('004 US1-5 reports Forbidden to an ordinary user on both routes', async () => {
    const user = await server.createAccount({ role: 'user' });
    const adminServer = createAdminServer({ appVersion: APP_VERSION });

    expect(
      await adminServer.listAccounts(connection(user.deviceCredential)),
    ).toEqual({
      ok: false,
      error: { type: 'Forbidden' },
    });
    expect(
      await adminServer.invite(connection(user.deviceCredential), 'a@b.fr'),
    ).toEqual({ ok: false, error: { type: 'Forbidden' } });
  });

  it('004 reports DeviceNotAuthorized for a credential the server does not know', async () => {
    const adminServer = createAdminServer({ appVersion: APP_VERSION });

    expect(await adminServer.listAccounts(connection('unknown'))).toEqual({
      ok: false,
      error: { type: 'DeviceNotAuthorized' },
    });
  });

  it('004 reports Offline when the server cannot be reached', async () => {
    const adminServer = createAdminServer({ appVersion: APP_VERSION });

    expect(
      await adminServer.listAccounts({
        url: 'http://127.0.0.1:9',
        deviceId: 'd',
        credential: 'c',
      }),
    ).toEqual({ ok: false, error: { type: 'Offline' } });
  });

  it('004 US6-1 getAccount returns the id, the address and the role', async () => {
    const user = await server.createAccount({ email: 'marie@example.org' });
    const accountServer = createAccountServer({ appVersion: APP_VERSION });

    expect(
      await accountServer.getAccount(connection(user.deviceCredential)),
    ).toEqual({
      ok: true,
      value: { id: user.accountId, email: 'marie@example.org', role: 'user' },
    });
  });

  it('004 getAccount reports DeviceNotAuthorized for an unknown credential', async () => {
    const accountServer = createAccountServer({ appVersion: APP_VERSION });

    expect(await accountServer.getAccount(connection('unknown'))).toEqual({
      ok: false,
      error: { type: 'DeviceNotAuthorized' },
    });
  });
});
