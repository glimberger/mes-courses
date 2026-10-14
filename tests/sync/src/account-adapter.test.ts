import { createAccountServer } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const APP_VERSION = '1.1.0';
const PASSWORD = 'a long enough password';

/** The reset email is sent after the answer: waits until the server has sent `count` of them. */
const waitForMails = async (server: TestServer, count: number) => {
  for (let i = 0; i < 100 && server.mails().length < count; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(server.mails()).toHaveLength(count);
};

describe('AccountServer HTTP adapter: sign-in', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  const accountServer = (appVersion = APP_VERSION) =>
    createAccountServer({ appVersion });

  it('004 US2-1 signs in with the current password and returns the device and the account', async () => {
    const { accountId } = await server.createAccount({
      email: 'marie@example.org',
    });

    const result = await accountServer().signIn(
      server.url,
      'marie@example.org',
      PASSWORD,
      'Pixel 8',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        type: 'signedIn',
        pairing: {
          deviceId: expect.any(String),
          credential: expect.any(String),
          serverId: expect.any(String),
          apiVersion: 1,
          minAppVersion: '1.1.0',
          accountId,
        },
        account: { id: accountId, email: 'marie@example.org', role: 'user' },
      },
    });
  });

  it('004 US2-1 reports that a new password is required for the temporary one', async () => {
    const { temporaryPassword } = await server.invite('marie@example.org');

    expect(
      await accountServer().signIn(
        server.url,
        'marie@example.org',
        temporaryPassword,
        'Pixel 8',
      ),
    ).toEqual({ ok: true, value: { type: 'passwordChangeRequired' } });
  });

  it('004 US2-4 reports wrong credentials without telling which part is wrong', async () => {
    await server.createAccount({ email: 'marie@example.org' });

    const wrong = await accountServer().signIn(
      server.url,
      'marie@example.org',
      'not the password',
      'Pixel 8',
    );
    const unknown = await accountServer().signIn(
      server.url,
      'nobody@example.org',
      'not the password',
      'Pixel 8',
    );

    expect(wrong).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
    expect(unknown).toEqual(wrong);
  });

  it('004 FR-006 reports the wait after too many failures', async () => {
    await server.createAccount({ email: 'marie@example.org' });
    for (let i = 0; i < 5; i++) {
      await accountServer().signIn(server.url, 'marie@example.org', 'x', 'P');
    }

    expect(
      await accountServer().signIn(
        server.url,
        'marie@example.org',
        PASSWORD,
        'Pixel 8',
      ),
    ).toEqual({
      ok: false,
      error: { type: 'TooManyAttempts', minutesToWait: 10 },
    });
  });

  it('004 R5 reports that an update is required for an old app', async () => {
    expect(
      await accountServer('1.0.0').signIn(
        server.url,
        'marie@example.org',
        PASSWORD,
        'Pixel 8',
      ),
    ).toEqual({ ok: false, error: { type: 'UpdateRequired' } });
  });

  it('004 US2-1 reports an unreachable server', async () => {
    expect(
      await accountServer().signIn(
        'http://127.0.0.1:9',
        'marie@example.org',
        PASSWORD,
        'Pixel 8',
      ),
    ).toEqual({ ok: false, error: { type: 'ServerUnreachable' } });
  });

  it('004 FR-013 reports a suspended account', async () => {
    const { accountId } = await server.createAccount({
      email: 'marie@example.org',
    });
    const admin = await server.createAccount({ role: 'administrator' });
    expect(admin.accountId).not.toBe(accountId);
    // A suspension straight in the store: the admin routes come with US5.
    await server.suspend(accountId);

    expect(
      await accountServer().signIn(
        server.url,
        'marie@example.org',
        PASSWORD,
        'Pixel 8',
      ),
    ).toEqual({ ok: false, error: { type: 'AccountSuspended' } });
  });
});

describe('AccountServer HTTP adapter: choosePassword', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  const accountServer = () => createAccountServer({ appVersion: APP_VERSION });

  it('004 US2-2 sets the password and returns the device', async () => {
    const { accountId, temporaryPassword } =
      await server.invite('marie@example.org');

    const result = await accountServer().choosePassword(
      server.url,
      'marie@example.org',
      temporaryPassword,
      'a brand new password',
      'Pixel 8',
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        deviceId: expect.any(String),
        credential: expect.any(String),
        accountId,
      }),
    });
    expect(
      await accountServer().signIn(
        server.url,
        'marie@example.org',
        'a brand new password',
        'Tablet',
      ),
    ).toMatchObject({ ok: true, value: { type: 'signedIn' } });
  });

  it('004 US2-3 reports the rule a new password breaks', async () => {
    const { temporaryPassword } = await server.invite('marie@example.org');

    expect(
      await accountServer().choosePassword(
        server.url,
        'marie@example.org',
        temporaryPassword,
        'short',
        'Pixel 8',
      ),
    ).toEqual({
      ok: false,
      error: { type: 'PasswordRejected', problem: 'TooShort' },
    });
  });

  it('004 R4 reports a temporary password that is no longer valid', async () => {
    const { temporaryPassword } = await server.invite('marie@example.org');
    const choose = () =>
      accountServer().choosePassword(
        server.url,
        'marie@example.org',
        temporaryPassword,
        'a brand new password',
        'Pixel 8',
      );
    await choose();

    expect(await choose()).toEqual({
      ok: false,
      error: { type: 'InvalidCredentials' },
    });
  });

  it('004 FR-006 never carries a password or a credential in a failure', async () => {
    const { temporaryPassword } = await server.invite('marie@example.org');
    const result = await accountServer().choosePassword(
      server.url,
      'marie@example.org',
      temporaryPassword,
      'short',
      'Pixel 8',
    );

    const text = JSON.stringify(result);
    expect(text).not.toContain(temporaryPassword);
    expect(text).not.toContain('short"');
  });
});

describe('AccountServer HTTP adapter: password reset', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  const accountServer = (appVersion = APP_VERSION) =>
    createAccountServer({ appVersion });

  it('004 US4-1 answers success for a known address and mails it', async () => {
    await server.createAccount({ email: 'marie@example.org' });

    expect(
      await accountServer().requestPasswordReset(
        server.url,
        'marie@example.org',
      ),
    ).toEqual({ ok: true, value: undefined });
    await waitForMails(server, 1);
  });

  it('004 US4-3 answers the same success for an unknown address, and mails nothing', async () => {
    const known = await accountServer().requestPasswordReset(
      server.url,
      'nobody@example.org',
    );

    expect(known).toEqual({ ok: true, value: undefined });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.mails()).toEqual([]);
  });

  it('004 US4-3 reports a malformed address the server refused', async () => {
    expect(
      await accountServer().requestPasswordReset(server.url, 'not an address'),
    ).toEqual({ ok: false, error: { type: 'InvalidEmail' } });
  });

  it('004 US4-4 reports the minutes to wait on the 4th request in an hour', async () => {
    for (let i = 0; i < 3; i++) {
      await accountServer().requestPasswordReset(server.url, 'a@example.org');
    }

    expect(
      await accountServer().requestPasswordReset(server.url, 'a@example.org'),
    ).toEqual({
      ok: false,
      error: { type: 'TooManyAttempts', minutesToWait: 60 },
    });
  });

  it('004 R5 reports that an update is required for an old app', async () => {
    expect(
      await accountServer('1.0.0').requestPasswordReset(
        server.url,
        'a@example.org',
      ),
    ).toEqual({ ok: false, error: { type: 'UpdateRequired' } });
  });

  it('004 US4-1 reports an unreachable server', async () => {
    expect(
      await accountServer().requestPasswordReset(
        'http://127.0.0.1:9',
        'a@example.org',
      ),
    ).toEqual({ ok: false, error: { type: 'ServerUnreachable' } });
  });
});

describe('AccountServer HTTP adapter: the account itself', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  const accountServer = (appVersion = APP_VERSION) =>
    createAccountServer({ appVersion });
  const connectionOf = (deviceCredential: string) => ({
    url: server.url,
    deviceId: 'device',
    credential: deviceCredential,
  });

  it('004 US6-2 changes the password; the new one signs in and the old one does not', async () => {
    const { deviceCredential } = await server.createAccount({
      email: 'marie@example.org',
    });

    const result = await accountServer().changePassword(
      connectionOf(deviceCredential),
      PASSWORD,
      'a brand new password',
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(
      (
        await accountServer().signIn(
          server.url,
          'marie@example.org',
          'a brand new password',
          'Pixel',
        )
      ).ok,
    ).toBe(true);
    expect(
      await accountServer().signIn(
        server.url,
        'marie@example.org',
        PASSWORD,
        'Pixel',
      ),
    ).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
  });

  it('004 US6-2 reports a wrong current password', async () => {
    const { deviceCredential } = await server.createAccount();

    expect(
      await accountServer().changePassword(
        connectionOf(deviceCredential),
        'not my password',
        'a brand new password',
      ),
    ).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
  });

  it('004 US6-2 reports the rule a new password breaks, SameAsCurrent included', async () => {
    const { deviceCredential } = await server.createAccount();
    const conn = connectionOf(deviceCredential);

    expect(
      await accountServer().changePassword(conn, PASSWORD, PASSWORD),
    ).toEqual({
      ok: false,
      error: { type: 'PasswordRejected', problem: 'SameAsCurrent' },
    });
    expect(
      await accountServer().changePassword(conn, PASSWORD, 'short'),
    ).toEqual({
      ok: false,
      error: { type: 'PasswordRejected', problem: 'TooShort' },
    });
  });

  it('004 FR-006 reports the wait after five wrong passwords', async () => {
    const { deviceCredential } = await server.createAccount();
    const conn = connectionOf(deviceCredential);
    for (let i = 0; i < 5; i++) {
      await accountServer().changePassword(conn, 'wrong wrong wrong', 'x');
    }

    const result = await accountServer().changePassword(
      conn,
      PASSWORD,
      'a brand new password',
    );

    expect(result).toMatchObject({
      ok: false,
      error: { type: 'TooManyAttempts', minutesToWait: expect.any(Number) },
    });
  });

  it('004 US6-2 reports a device the server no longer knows as not authorized, not as a wrong password', async () => {
    expect(
      await accountServer().changePassword(
        connectionOf('unknown-credential'),
        PASSWORD,
        'a brand new password',
      ),
    ).toEqual({ ok: false, error: { type: 'DeviceNotAuthorized' } });
  });

  it('004 US6-2 reports an unreachable server as offline', async () => {
    const { deviceCredential } = await server.createAccount();
    const conn = connectionOf(deviceCredential);
    await server.close();

    expect(
      await accountServer().changePassword(conn, PASSWORD, 'x'.repeat(14)),
    ).toEqual({ ok: false, error: { type: 'Offline' } });
    server = await startTestServer();
  });

  it('004 US6-6 deletes the account: it can no longer sign in', async () => {
    const { deviceCredential } = await server.createAccount({
      email: 'marie@example.org',
    });

    const result = await accountServer().deleteAccount(
      connectionOf(deviceCredential),
      PASSWORD,
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(
      await accountServer().signIn(
        server.url,
        'marie@example.org',
        PASSWORD,
        'Pixel',
      ),
    ).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
    expect(
      await accountServer().getAccount(connectionOf(deviceCredential)),
    ).toEqual({ ok: false, error: { type: 'AccountDeleted' } });
  });

  it('004 US6-6 reports a wrong password and keeps the account', async () => {
    const { deviceCredential } = await server.createAccount();
    const conn = connectionOf(deviceCredential);

    expect(
      await accountServer().deleteAccount(conn, 'not my password'),
    ).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
    expect((await accountServer().getAccount(conn)).ok).toBe(true);
  });

  it('004 US6-7 reports the only administrator', async () => {
    const { deviceCredential } = await server.createAccount({
      role: 'administrator',
    });

    expect(
      await accountServer().deleteAccount(
        connectionOf(deviceCredential),
        PASSWORD,
      ),
    ).toEqual({ ok: false, error: { type: 'LastAdministrator' } });
  });

  it('004 FR-006 reports the wait after five wrong passwords on deletion', async () => {
    const { deviceCredential } = await server.createAccount();
    const conn = connectionOf(deviceCredential);
    for (let i = 0; i < 5; i++) {
      await accountServer().deleteAccount(conn, 'wrong wrong wrong');
    }

    expect(await accountServer().deleteAccount(conn, PASSWORD)).toMatchObject({
      ok: false,
      error: { type: 'TooManyAttempts' },
    });
  });
});
