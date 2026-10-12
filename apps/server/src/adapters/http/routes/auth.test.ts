import type { Clock } from '../../../application/ports/clock';
import { buildTestApp } from '../../../testing/start-test-server';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const setup = () => {
  const clock = new FakeClock();
  const harness = buildTestApp({ clock });
  const post = (
    url: string,
    payload: unknown,
    headers: Record<string, string> = {},
  ) =>
    harness.app.inject({
      method: 'POST',
      url,
      payload: payload as object,
      headers: { 'x-app-version': '1.1.0', ...headers },
    });
  return { ...harness, clock, post };
};

const signInBody = (password: string, email = 'marie@example.org') => ({
  email,
  password,
  deviceName: 'Pixel 8',
});

describe('POST /v1/auth/sign-in', () => {
  it('004 US2-1 signs in with the current password and returns the device, the account and the identity', async () => {
    const { post, db, createAccount } = setup();
    const { accountId } = await createAccount({ email: 'marie@example.org' });

    const response = await post('/v1/auth/sign-in', {
      ...signInBody('a long enough password'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: 'signedIn',
      deviceId: expect.any(String),
      credential: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      account: { id: accountId, email: 'marie@example.org', role: 'user' },
      accountId,
      serverId: expect.any(String),
      apiVersion: 1,
      minAppVersion: '1.1.0',
    });
    db.close();
  });

  it('004 US2-1 answers passwordChangeRequired to the temporary password and creates no device', async () => {
    const { post, db, store, invite } = setup();
    const { accountId, temporaryPassword } = await invite('marie@example.org');

    const response = await post(
      '/v1/auth/sign-in',
      signInBody(temporaryPassword),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      outcome: 'passwordChangeRequired',
    });
    expect(response.json().credential).toBeUndefined();
    expect(
      await store.run(({ devices }) => devices.forAccount(accountId)),
    ).toEqual([]);
    db.close();
  });

  it('004 US2-4 answers an unknown address and a wrong password with the same 401 body', async () => {
    const { post, db, createAccount } = setup();
    await createAccount({ email: 'marie@example.org' });

    const wrong = await post('/v1/auth/sign-in', signInBody('wrong password!'));
    const unknown = await post(
      '/v1/auth/sign-in',
      signInBody('wrong password!', 'nobody@example.org'),
    );

    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error).toBe('InvalidCredentials');
    expect(unknown.statusCode).toBe(401);
    expect(unknown.body).toBe(wrong.body);
    db.close();
  });

  it('004 US2-5 answers 401 TemporaryPasswordExpired to an expired temporary password', async () => {
    const { post, db, clock, invite } = setup();
    const { temporaryPassword } = await invite('marie@example.org');
    clock.ms += 7 * 24 * 60 * 60 * 1000;

    const response = await post(
      '/v1/auth/sign-in',
      signInBody(temporaryPassword),
    );

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('TemporaryPasswordExpired');
    db.close();
  });

  it('004 FR-013 answers 403 AccountSuspended to a suspended account with the right password', async () => {
    const { post, db, store, createAccount } = setup();
    const { accountId } = await createAccount({ email: 'marie@example.org' });
    await store.run(async ({ accounts }) => {
      const record = await accounts.get(accountId);
      if (record === null) throw new Error('missing');
      await accounts.update({ ...record, suspendedAt: '2026-10-11T10:00:00Z' });
    });

    const response = await post(
      '/v1/auth/sign-in',
      signInBody('a long enough password'),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('AccountSuspended');
    db.close();
  });

  it('004 FR-006 answers 429 with Retry-After once the limit is hit, even with the right password', async () => {
    const { post, db, createAccount } = setup();
    await createAccount({ email: 'marie@example.org' });
    for (let i = 0; i < 5; i++) {
      await post('/v1/auth/sign-in', signInBody('wrong password!'));
    }

    const response = await post(
      '/v1/auth/sign-in',
      signInBody('a long enough password'),
    );

    expect(response.statusCode).toBe(429);
    expect(response.json().error).toBe('TooManyAttempts');
    expect(response.headers['retry-after']).toBe('600');
    db.close();
  });

  it('004 FR-006 counts the client address from X-Forwarded-For when it comes through the local proxy', async () => {
    const { post, db } = setup();
    for (let i = 0; i < 20; i++) {
      await post(
        '/v1/auth/sign-in',
        signInBody('wrong password!', `user${i}@example.org`),
        { 'x-forwarded-for': '203.0.113.7' },
      );
    }

    const sameClient = await post(
      '/v1/auth/sign-in',
      signInBody('wrong password!'),
      { 'x-forwarded-for': '203.0.113.7' },
    );
    const otherClient = await post(
      '/v1/auth/sign-in',
      signInBody('wrong password!'),
      { 'x-forwarded-for': '203.0.113.8' },
    );

    expect(sameClient.statusCode).toBe(429);
    expect(otherClient.statusCode).toBe(401);
    db.close();
  });

  it('004 FR-006 counts the local proxy itself when the header is absent', async () => {
    const { post, db } = setup();
    for (let i = 0; i < 20; i++) {
      await post(
        '/v1/auth/sign-in',
        signInBody('wrong password!', `user${i}@example.org`),
      );
    }

    const response = await post(
      '/v1/auth/sign-in',
      signInBody('wrong password!'),
    );

    expect(response.statusCode).toBe(429);
    db.close();
  });

  it('004 FR-006 deletes attempts older than 60 minutes at the next auth request', async () => {
    const { post, db, clock, store, deps } = setup();
    await post('/v1/auth/sign-in', signInBody('wrong password!'));
    const key = deps.crypto.sha256Hex('marie@example.org');
    const count = () =>
      store.run(({ authAttempts }) =>
        authAttempts.countSince('signIn', key, '2000-01-01T00:00:00.000Z'),
      );
    expect(await count()).toBe(1);

    clock.ms += 61 * 60 * 1000;
    await post('/v1/auth/sign-in', signInBody('x', 'other@example.org'));

    expect(await count()).toBe(0);
    db.close();
  });

  it('004 FR-006 rejects a malformed address, a blank device name and an oversized password', async () => {
    const { post, db } = setup();

    const email = await post('/v1/auth/sign-in', signInBody('x', 'nope'));
    const device = await post('/v1/auth/sign-in', {
      ...signInBody('x'),
      deviceName: '   ',
    });
    const big = await post('/v1/auth/sign-in', signInBody('x'.repeat(513)));
    const missing = await post('/v1/auth/sign-in', { email: 'a@b.co' });

    expect(email.json().error).toBe('InvalidEmail');
    expect(device.json().error).toBe('InvalidDeviceName');
    expect(big.statusCode).toBe(400);
    expect(big.json().error).toBe('BadRequest');
    expect(missing.json().error).toBe('BadRequest');
    db.close();
  });

  it('004 FR-006 accepts a password of 512 UTF-16 units and refuses 513, counting units not code points', async () => {
    const { post, db } = setup();

    const ok = await post('/v1/auth/sign-in', signInBody('x'.repeat(512)));
    // 257 emoji are 514 UTF-16 units but only 257 code points.
    const tooBig = await post('/v1/auth/sign-in', signInBody('😀'.repeat(257)));

    expect(ok.statusCode).toBe(401);
    expect(tooBig.statusCode).toBe(400);
    db.close();
  });

  it('004 FR-006 never puts a password or an address in the body of a failure', async () => {
    const { post, db } = setup();

    const response = await post(
      '/v1/auth/sign-in',
      signInBody('secret-password-123'),
    );

    expect(response.body).not.toContain('secret-password-123');
    expect(response.body).not.toContain('marie@example.org');
    db.close();
  });

  it('004 R5 refuses an app that still shows pairing with 426, and serves 1.1.0', async () => {
    const { app, db } = setup();
    const send = (version: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/sign-in',
        payload: signInBody('x'),
        headers: { 'x-app-version': version },
      });

    expect((await send('1.0.0')).statusCode).toBe(426);
    expect((await send('1.1.0')).statusCode).toBe(401);
    db.close();
  });
});

describe('POST /v1/auth/choose-password', () => {
  const choose = (
    temporaryPassword: string,
    newPassword = 'a brand new password',
    email = 'marie@example.org',
  ) => ({ email, temporaryPassword, newPassword, deviceName: 'Pixel 8' });

  it('004 US2-2 sets the password, signs the device in, and the temporary password is single use', async () => {
    const { post, db, invite } = setup();
    const { accountId, temporaryPassword } = await invite('marie@example.org');

    const first = await post(
      '/v1/auth/choose-password',
      choose(temporaryPassword),
    );
    const second = await post(
      '/v1/auth/choose-password',
      choose(temporaryPassword),
    );
    const again = await post(
      '/v1/auth/sign-in',
      signInBody('a brand new password'),
    );

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      outcome: 'signedIn',
      accountId,
      account: { id: accountId, email: 'marie@example.org', role: 'user' },
      serverId: expect.any(String),
    });
    expect(second.statusCode).toBe(401);
    expect(second.json().error).toBe('InvalidCredentials');
    expect(again.json().outcome).toBe('signedIn');
    db.close();
  });

  it.each([
    ['short', 'TooShort'],
    ['x'.repeat(129), 'TooLong'],
  ])(
    '004 US2-3 answers 400 InvalidPassword with the problem for %s',
    async (newPassword, problem) => {
      const { post, db, invite } = setup();
      const { temporaryPassword } = await invite('marie@example.org');

      const response = await post(
        '/v1/auth/choose-password',
        choose(temporaryPassword, newPassword),
      );

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: 'InvalidPassword',
        problem,
      });
      db.close();
    },
  );

  it('004 US2-3 refuses the temporary password as the new one, whatever its case', async () => {
    const { post, db, invite } = setup();
    const { temporaryPassword } = await invite('marie@example.org');

    const response = await post(
      '/v1/auth/choose-password',
      choose(temporaryPassword, temporaryPassword.toLowerCase()),
    );

    expect(response.json()).toMatchObject({
      error: 'InvalidPassword',
      problem: 'SameAsTemporary',
    });
    db.close();
  });

  it('004 US2-5 answers 401 TemporaryPasswordExpired once expired', async () => {
    const { post, db, clock, invite } = setup();
    const { temporaryPassword } = await invite('marie@example.org');
    clock.ms += 7 * 24 * 60 * 60 * 1000;

    const response = await post(
      '/v1/auth/choose-password',
      choose(temporaryPassword),
    );

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('TemporaryPasswordExpired');
    db.close();
  });

  it('004 FR-006 answers 429 after repeated wrong temporary passwords', async () => {
    const { post, db, invite } = setup();
    await invite('marie@example.org');
    for (let i = 0; i < 5; i++) {
      await post('/v1/auth/choose-password', choose('WRONG-WRONG'));
    }

    const response = await post(
      '/v1/auth/choose-password',
      choose('WRONG-WRONG'),
    );

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
    db.close();
  });

  it('004 FR-013 answers 403 to a suspended account', async () => {
    const { post, db, store, invite } = setup();
    const { accountId, temporaryPassword } = await invite('marie@example.org');
    await store.run(async ({ accounts }) => {
      const record = await accounts.get(accountId);
      if (record === null) throw new Error('missing');
      await accounts.update({ ...record, suspendedAt: '2026-10-11T10:00:00Z' });
    });

    const response = await post(
      '/v1/auth/choose-password',
      choose(temporaryPassword),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('AccountSuspended');
    db.close();
  });
});

describe('removed pairing routes (004 T046)', () => {
  it.each(['/v1/pairing/claim', '/v1/pairing-codes'])(
    '004 answers 404 on %s',
    async (url) => {
      const { app, db, createAccount } = buildTestApp();
      const { deviceCredential } = await createAccount();

      const response = await app.inject({
        method: 'POST',
        url,
        payload: {},
        headers: {
          'x-app-version': '1.1.0',
          authorization: `Bearer ${deviceCredential}`,
        },
      });

      expect(response.statusCode).toBe(404);
      db.close();
    },
  );
});
