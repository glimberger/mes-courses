import { createAccountServer } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const APP_VERSION = '1.1.0';
const PASSWORD = 'a long enough password';

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
