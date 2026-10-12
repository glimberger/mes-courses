import { buildTestApp } from '../../../testing/start-test-server';

const harness = async () => {
  const test = buildTestApp();
  const admin = await test.createAccount({
    role: 'administrator',
    email: 'admin@example.org',
  });
  const user = await test.createAccount({
    role: 'user',
    email: 'u@example.org',
  });
  const as = (credential: string) => ({
    authorization: `Bearer ${credential}`,
  });
  // Migration 2 leaves the setup account, which has no address: only the others are of interest.
  const accountRows = () =>
    test.store.run(async ({ accounts }) =>
      (await accounts.all()).filter((account) => account.email !== null),
    );
  return { ...test, admin, user, as, accountRows };
};

describe('GET /v1/admin/accounts', () => {
  it('004 US5-1 lists the accounts for an administrator', async () => {
    const { app, db, admin, as } = await harness();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/accounts',
      headers: as(admin.deviceCredential),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      accounts: Array<{ email: string; state: string; role: string }>;
    };
    expect(
      body.accounts
        .map((a) => [a.email, a.role, a.state])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ['admin@example.org', 'administrator', 'active'],
      ['u@example.org', 'user', 'active'],
    ]);
    expect(response.json()).toHaveProperty('serverId');
    expect(response.json().accountId).toBe(admin.accountId);
    db.close();
  });
});

describe('POST /v1/admin/accounts', () => {
  it('004 US1-1 invites an address: 201, an invited account, one email', async () => {
    const { app, db, admin, as, mailer, accountRows } = await harness();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/accounts',
      headers: as(admin.deviceCredential),
      payload: { email: ' New@Example.org' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().account).toMatchObject({
      email: 'new@example.org',
      role: 'user',
      state: 'invited',
      lastSyncAt: null,
      invitationExpired: false,
    });
    expect(await accountRows()).toHaveLength(3);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({
      kind: 'invitation',
      to: 'new@example.org',
      serverUrl: 'https://courses.test',
    });
    db.close();
  });

  it('004 US1-2 answers 409 AccountExists and sends nothing', async () => {
    const { app, db, admin, as, mailer, accountRows } = await harness();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/accounts',
      headers: as(admin.deviceCredential),
      payload: { email: 'U@example.org' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('AccountExists');
    expect(mailer.sent).toEqual([]);
    expect(await accountRows()).toHaveLength(2);
    db.close();
  });

  it('004 US1-3 answers 400 InvalidEmail and creates nothing', async () => {
    const { app, db, admin, as, mailer, accountRows } = await harness();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/accounts',
      headers: as(admin.deviceCredential),
      payload: { email: 'nope' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('InvalidEmail');
    expect(mailer.sent).toEqual([]);
    expect(await accountRows()).toHaveLength(2);
    db.close();
  });

  it('004 US1-4 answers 502 MailFailed and leaves nothing behind', async () => {
    const { app, db, admin, as, mailer, accountRows } = await harness();
    mailer.failing = true;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/accounts',
      headers: as(admin.deviceCredential),
      payload: { email: 'new@example.org' },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe('MailFailed');
    expect(await accountRows()).toHaveLength(2);
    db.close();
  });

  it('004 answers 400 BadRequest to a body without an address or with an extra field', async () => {
    const { app, db, admin, as } = await harness();

    for (const payload of [
      {},
      { email: 3 },
      { email: 'a@b.fr', role: 'administrator' },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/accounts',
        headers: as(admin.deviceCredential),
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('BadRequest');
    }
    db.close();
  });
});

describe('administration routes and an ordinary user', () => {
  it('004 US1-5 answer 403 Forbidden to an ordinary user and leave the store untouched', async () => {
    const { app, db, user, as, mailer, accountRows } = await harness();
    const before = await accountRows();

    for (const [method, url, payload] of [
      ['GET', '/v1/admin/accounts', undefined],
      ['POST', '/v1/admin/accounts', { email: 'new@example.org' }],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: as(user.deviceCredential),
        payload,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('Forbidden');
    }

    expect(await accountRows()).toEqual(before);
    expect(mailer.sent).toEqual([]);
    db.close();
  });

  it('004 answer 401 DeviceNotAuthorized without a credential', async () => {
    const { app, db } = await harness();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/accounts',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('DeviceNotAuthorized');
    db.close();
  });
});
