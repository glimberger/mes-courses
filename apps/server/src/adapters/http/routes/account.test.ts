import { attemptKey } from '../../../domain/attempts';
import {
  buildTestApp,
  TEST_PASSWORD,
} from '../../../testing/start-test-server';

describe('GET /v1/account', () => {
  it('004 US6-1 returns the id, the address and the role of the caller', async () => {
    const { app, db, createAccount } = buildTestApp();
    const admin = await createAccount({
      role: 'administrator',
      email: 'admin@example.org',
    });
    const other = await createAccount({ email: 'other@example.org' });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/account',
      headers: { authorization: `Bearer ${admin.deviceCredential}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().account).toEqual({
      id: admin.accountId,
      email: 'admin@example.org',
      role: 'administrator',
    });
    expect(response.json().accountId).toBe(admin.accountId);
    expect(other.accountId).not.toBe(admin.accountId);
    db.close();
  });

  it('004 requires a device credential', async () => {
    const { app, db } = buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/v1/account' });

    expect(response.statusCode).toBe(401);
    db.close();
  });

  it('004 the role is read on every call: a demoted account is no longer an administrator', async () => {
    const { app, db, store, createAccount } = buildTestApp();
    const { accountId, deviceCredential } = await createAccount({
      role: 'administrator',
    });
    await store.run(async ({ accounts }) => {
      const record = await accounts.get(accountId);
      if (record === null) throw new Error('missing');
      await accounts.update({ ...record, role: 'user' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/account',
      headers: { authorization: `Bearer ${deviceCredential}` },
    });

    expect(response.json().account.role).toBe('user');
    db.close();
  });
});

const authorize = (credential: string) => ({
  authorization: `Bearer ${credential}`,
});

describe('POST /v1/account/password', () => {
  it('004 US6-2 changes the password, keeps another device signed in and ends the old password', async () => {
    const { app, db, createAccount, signIn } = buildTestApp();
    const { accountId, deviceCredential } = await createAccount({
      email: 'marie@example.org',
    });
    const other = await signIn('marie@example.org', TEST_PASSWORD, 'Tablet');

    const response = await app.inject({
      method: 'POST',
      url: '/v1/account/password',
      headers: authorize(deviceCredential),
      payload: {
        currentPassword: TEST_PASSWORD,
        newPassword: 'a brand new password',
      },
    });

    expect(response.statusCode).toBe(204);
    const stillSignedIn = await app.inject({
      method: 'GET',
      url: '/v1/account',
      headers: authorize(other.deviceCredential),
    });
    expect(stillSignedIn.statusCode).toBe(200);
    await expect(signIn('marie@example.org', TEST_PASSWORD)).rejects.toThrow(
      'invalid',
    );
    expect(
      (await signIn('marie@example.org', 'a brand new password')).accountId,
    ).toBe(accountId);
    db.close();
  });

  it('004 US6-2 answers 400 InvalidPassword SameAsCurrent to someone who typed the current password right', async () => {
    const { app, db, createAccount } = buildTestApp();
    const { deviceCredential } = await createAccount();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/account/password',
      headers: authorize(deviceCredential),
      payload: { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'InvalidPassword',
      problem: 'SameAsCurrent',
    });
    db.close();
  });

  it('004 answers 400 InvalidPassword TooShort', async () => {
    const { app, db, createAccount } = buildTestApp();
    const { deviceCredential } = await createAccount();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/account/password',
      headers: authorize(deviceCredential),
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'short' },
    });

    expect(response.json()).toMatchObject({
      error: 'InvalidPassword',
      problem: 'TooShort',
    });
    db.close();
  });

  it('004 answers 401 InvalidCredentials for a wrong current password, and does not tell SameAsCurrent', async () => {
    const { app, db, createAccount } = buildTestApp();
    const { deviceCredential } = await createAccount();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/account/password',
      headers: authorize(deviceCredential),
      payload: {
        currentPassword: 'not my password',
        newPassword: 'not my password',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'InvalidCredentials' });
    db.close();
  });

  it('004 answers 429 TooManyAttempts with Retry-After after five wrong passwords', async () => {
    const { app, db, createAccount } = buildTestApp();
    const { deviceCredential } = await createAccount();
    const attempt = (currentPassword: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/account/password',
        headers: authorize(deviceCredential),
        payload: { currentPassword, newPassword: 'a brand new password' },
      });
    for (let i = 0; i < 5; i++) await attempt('wrong wrong wrong');

    const response = await attempt(TEST_PASSWORD);

    expect(response.statusCode).toBe(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    db.close();
  });

  it('004 requires a device credential and a well-formed body', async () => {
    const { app, db, createAccount } = buildTestApp();
    const { deviceCredential } = await createAccount();

    const anonymous = await app.inject({
      method: 'POST',
      url: '/v1/account/password',
      payload: { currentPassword: 'x', newPassword: 'y' },
    });
    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/account/password',
      headers: authorize(deviceCredential),
      payload: { currentPassword: 'x'.repeat(513), newPassword: 'y' },
    });

    expect(anonymous.statusCode).toBe(401);
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ error: 'BadRequest' });
    db.close();
  });
});

describe('DELETE /v1/account', () => {
  it('004 US6-6 deletes the account and its other devices learn AccountDeleted', async () => {
    const { app, db, store, createAccount, signIn } = buildTestApp();
    const { accountId, deviceCredential } = await createAccount({
      email: 'marie@example.org',
    });
    const other = await signIn('marie@example.org', TEST_PASSWORD, 'Tablet');

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: {
        ...authorize(deviceCredential),
        'content-type': 'application/json',
      },
      payload: { password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(204);
    expect(
      await store.run(({ accounts }) => accounts.get(accountId)),
    ).toBeNull();
    for (const credential of [deviceCredential, other.deviceCredential]) {
      const next = await app.inject({
        method: 'GET',
        url: '/v1/account',
        headers: authorize(credential),
      });
      expect(next.statusCode).toBe(401);
      expect(next.json()).toMatchObject({ error: 'AccountDeleted' });
    }
    db.close();
  });

  it('004 US6-6 answers 401 InvalidCredentials for a wrong password and keeps the account', async () => {
    const { app, db, store, createAccount } = buildTestApp();
    const { accountId, deviceCredential } = await createAccount();

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: authorize(deviceCredential),
      payload: { password: 'wrong wrong wrong' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'InvalidCredentials' });
    expect(
      await store.run(({ accounts }) => accounts.get(accountId)),
    ).not.toBeNull();
    db.close();
  });

  it('004 US6-7 answers 409 LastAdministrator for the only administrator', async () => {
    const { app, db, createAccount } = buildTestApp();
    const { deviceCredential } = await createAccount({ role: 'administrator' });

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: authorize(deviceCredential),
      payload: { password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'LastAdministrator' });
    db.close();
  });

  it('004 answers 429 after five wrong passwords', async () => {
    const { app, db, createAccount } = buildTestApp();
    const { deviceCredential } = await createAccount();
    const attempt = (password: string) =>
      app.inject({
        method: 'DELETE',
        url: '/v1/account',
        headers: authorize(deviceCredential),
        payload: { password },
      });
    for (let i = 0; i < 5; i++) await attempt('wrong wrong wrong');

    expect((await attempt(TEST_PASSWORD)).statusCode).toBe(429);
    db.close();
  });
  it('004 SC-007 leaves no row of the account in any table but ended_credential', async () => {
    const { app, db, deps, store, createAccount, signIn } = buildTestApp();
    const { accountId, deviceCredential } = await createAccount({
      email: 'marie@example.org',
    });
    await signIn('marie@example.org', TEST_PASSWORD, 'Second');
    const hlc = (n: number) => ({
      wallMs: 1000 + n,
      counter: n,
      deviceId: 'd',
    });
    const seed = await app.inject({
      method: 'POST',
      url: '/v1/sync',
      headers: authorize(deviceCredential),
      payload: {
        lastSeq: 0,
        hlc: hlc(0),
        changes: [
          {
            changeId: 'c1',
            hlc: hlc(1),
            kind: 'category',
            id: 'cat',
            fields: { name: 'Rayon', position: 0 },
          },
          {
            changeId: 'c2',
            hlc: hlc(2),
            kind: 'list',
            id: 'lst',
            fields: { name: 'Liste' },
          },
        ],
      },
    });
    expect(seed.statusCode).toBe(200);
    const key = attemptKey(deps.crypto.sha256Hex, 'marie@example.org');
    await store.run(({ authAttempts }) =>
      authAttempts.add('passwordReset', key, new Date().toISOString()),
    );

    const countRows = () => {
      const tables = db
        .all<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
        )
        .map((row) => row.name);
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const columns = db
          .all<{ name: string }>(`PRAGMA table_info(${table})`)
          .map((column) => column.name);
        const where =
          table === 'account'
            ? ['id = ?', accountId]
            : columns.includes('account_id')
              ? ['account_id = ?', accountId]
              : table === 'auth_attempt'
                ? ['key_hash = ?', key]
                : null;
        if (where === null) continue;
        counts[table] =
          db.get<{ n: number }>(
            `SELECT COUNT(*) AS n FROM ${table} WHERE ${where[0]}`,
            [where[1] as string],
          )?.n ?? -1;
      }
      return counts;
    };
    const before = countRows();
    expect(before).toMatchObject({ account: 1, category: 1, shopping_list: 1 });
    expect(before.device).toBe(2);
    expect(before.auth_attempt).toBeGreaterThan(0);

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: authorize(deviceCredential),
      payload: { password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(204);
    expect(Object.values(countRows()).every((n) => n === 0)).toBe(true);
    expect(Object.keys(countRows())).toEqual(Object.keys(before));
    expect(
      db.get<{ n: number }>('SELECT COUNT(*) AS n FROM ended_credential')?.n,
    ).toBe(2);
    db.close();
  });
});
