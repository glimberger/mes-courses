import { attemptKey } from '../../../domain/attempts';
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
      ['POST', '/v1/admin/accounts/x/suspend', undefined],
      ['POST', '/v1/admin/accounts/x/reactivate', undefined],
      ['POST', '/v1/admin/accounts/x/resend-credentials', undefined],
      ['DELETE', '/v1/admin/accounts/x', undefined],
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

const act = (
  h: Awaited<ReturnType<typeof harness>>,
  method: 'POST' | 'DELETE',
  url: string,
  as: string = h.admin.deviceCredential,
) =>
  h.app.inject({
    method,
    url,
    headers: h.as(as),
  });

const syncAs = (h: Awaited<ReturnType<typeof harness>>, credential: string) =>
  h.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: h.as(credential),
    payload: {
      lastSeq: 0,
      hlc: { wallMs: 1, counter: 0, deviceId: 'd' },
      changes: [],
    },
  });

describe('suspend and reactivate', () => {
  it('004 US5-2 suspends: 204, and the device is refused with 403 AccountSuspended on sync and devices', async () => {
    const h = await harness();

    const response = await act(
      h,
      'POST',
      `/v1/admin/accounts/${h.user.accountId}/suspend`,
    );

    expect(response.statusCode).toBe(204);
    for (const url of ['/v1/devices']) {
      const devices = await h.app.inject({
        method: 'GET',
        url,
        headers: h.as(h.user.deviceCredential),
      });
      expect(devices.statusCode).toBe(403);
      expect(devices.json().error).toBe('AccountSuspended');
    }
    expect((await syncAs(h, h.user.deviceCredential)).json().error).toBe(
      'AccountSuspended',
    );
    h.db.close();
  });

  it('004 US5-3 reactivates: the same credential syncs again, with its data kept', async () => {
    const h = await harness();
    await act(h, 'POST', `/v1/admin/accounts/${h.user.accountId}/suspend`);

    const response = await act(
      h,
      'POST',
      `/v1/admin/accounts/${h.user.accountId}/reactivate`,
    );

    expect(response.statusCode).toBe(204);
    expect((await syncAs(h, h.user.deviceCredential)).statusCode).toBe(200);
    h.db.close();
  });

  it('004 US5-2 is idempotent in both directions', async () => {
    const h = await harness();
    const url = `/v1/admin/accounts/${h.user.accountId}`;

    expect((await act(h, 'POST', `${url}/reactivate`)).statusCode).toBe(204);
    expect((await act(h, 'POST', `${url}/suspend`)).statusCode).toBe(204);
    expect((await act(h, 'POST', `${url}/suspend`)).statusCode).toBe(204);
    h.db.close();
  });

  it('004 US5-5 answers 409 LastAdministrator when the only administrator suspends themselves', async () => {
    const h = await harness();

    const response = await act(
      h,
      'POST',
      `/v1/admin/accounts/${h.admin.accountId}/suspend`,
    );

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('LastAdministrator');
    expect((await syncAs(h, h.admin.deviceCredential)).statusCode).toBe(200);
    h.db.close();
  });

  it('answers 404 NotFound for an unknown account', async () => {
    const h = await harness();

    for (const path of ['suspend', 'reactivate', 'resend-credentials']) {
      const response = await act(
        h,
        'POST',
        `/v1/admin/accounts/nobody/${path}`,
      );
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NotFound');
    }
    h.db.close();
  });
});

describe('resend credentials', () => {
  it('004 US5-6 answers 204, emails a new temporary password and invalidates the first', async () => {
    const h = await harness();
    const invited = await h.invite('new@example.org');

    const response = await act(
      h,
      'POST',
      `/v1/admin/accounts/${invited.accountId}/resend-credentials`,
    );

    expect(response.statusCode).toBe(204);
    expect(h.mailer.sent).toHaveLength(1);
    const mail = h.mailer.sent[0];
    expect(mail).toMatchObject({ kind: 'invitation', to: 'new@example.org' });
    expect((mail as { temporaryPassword: string }).temporaryPassword).not.toBe(
      invited.temporaryPassword,
    );
    h.db.close();
  });

  it('004 US5-6 answers 502 MailFailed and keeps the previous temporary password', async () => {
    const h = await harness();
    const invited = await h.invite('new@example.org');
    const before = await h.store.run(({ accounts }) =>
      accounts.get(invited.accountId),
    );
    h.mailer.failing = true;

    const response = await act(
      h,
      'POST',
      `/v1/admin/accounts/${invited.accountId}/resend-credentials`,
    );

    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe('MailFailed');
    expect(
      await h.store.run(({ accounts }) => accounts.get(invited.accountId)),
    ).toEqual(before);
    h.db.close();
  });

  it('answers 409 NotInvited for an active account and for a suspended invited one', async () => {
    const h = await harness();
    const invited = await h.invite('new@example.org');
    await h.suspend(invited.accountId);

    for (const id of [h.user.accountId, invited.accountId]) {
      const response = await act(
        h,
        'POST',
        `/v1/admin/accounts/${id}/resend-credentials`,
      );
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('NotInvited');
    }
    expect(h.mailer.sent).toEqual([]);
    h.db.close();
  });
});

describe('DELETE /v1/admin/accounts/:id', () => {
  it("004 US5-4 answers 204 and the deleted account's device gets 401 AccountDeleted", async () => {
    const h = await harness();

    const response = await act(
      h,
      'DELETE',
      `/v1/admin/accounts/${h.user.accountId}`,
    );

    expect(response.statusCode).toBe(204);
    const sync = await syncAs(h, h.user.deviceCredential);
    expect(sync.statusCode).toBe(401);
    expect(sync.json().error).toBe('AccountDeleted');
    h.db.close();
  });

  it('004 US5-4 gives a revoked device 401 DeviceNotAuthorized, not AccountDeleted', async () => {
    const h = await harness();
    const second = await h.signIn(
      'u@example.org',
      'a long enough password',
      'Second',
    );
    await h.app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: h.as(h.user.deviceCredential),
    });
    const devices = (
      await h.app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: h.as(h.user.deviceCredential),
      })
    ).json().devices as Array<{ id: string; name: string }>;
    const target = devices.find((d) => d.name === 'Second');
    await h.app.inject({
      method: 'DELETE',
      url: `/v1/devices/${target?.id}`,
      headers: h.as(h.user.deviceCredential),
    });

    const sync = await syncAs(h, second.deviceCredential);

    expect(sync.statusCode).toBe(401);
    expect(sync.json().error).toBe('DeviceNotAuthorized');
    h.db.close();
  });

  it('004 US5-5 answers 409 LastAdministrator for the only administrator', async () => {
    const h = await harness();

    const response = await act(
      h,
      'DELETE',
      `/v1/admin/accounts/${h.admin.accountId}`,
    );

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('LastAdministrator');
    expect((await syncAs(h, h.admin.deviceCredential)).statusCode).toBe(200);
    h.db.close();
  });

  it('answers 404 NotFound for an unknown account', async () => {
    const h = await harness();
    expect(
      (await act(h, 'DELETE', '/v1/admin/accounts/nobody')).statusCode,
    ).toBe(404);
    h.db.close();
  });

  it('004 SC-007 leaves no row of the account in any table but ended_credential', async () => {
    const h = await harness();
    const hlc = (n: number) => ({
      wallMs: 1000 + n,
      counter: n,
      deviceId: 'd',
    });
    const seed = await h.app.inject({
      method: 'POST',
      url: '/v1/sync',
      headers: h.as(h.user.deviceCredential),
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
            kind: 'article',
            id: 'art',
            fields: { name: 'Pain', categoryId: 'cat' },
          },
          {
            changeId: 'c3',
            hlc: hlc(3),
            kind: 'list',
            id: 'lst',
            fields: { name: 'Liste' },
          },
          {
            changeId: 'c4',
            hlc: hlc(4),
            kind: 'listItem',
            id: 'lst:art',
            fields: {
              listId: 'lst',
              articleId: 'art',
              present: true,
              inCart: false,
              quantity: null,
            },
          },
        ],
      },
    });
    expect(seed.statusCode).toBe(200);
    await h.signIn('u@example.org', 'a long enough password', 'Second');
    const key = attemptKey(h.deps.crypto.sha256Hex, 'u@example.org');
    await h.store.run(({ authAttempts }) =>
      authAttempts.add('signIn', key, new Date().toISOString()),
    );
    await h.store.run(({ authAttempts }) =>
      authAttempts.add('passwordReset', key, new Date().toISOString()),
    );

    const countRows = () => {
      const tables = h.db
        .all<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
        )
        .map((row) => row.name);
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const columns = h.db
          .all<{ name: string }>(`PRAGMA table_info(${table})`)
          .map((column) => column.name);
        const where =
          table === 'account'
            ? ['id = ?', h.user.accountId]
            : columns.includes('account_id')
              ? ['account_id = ?', h.user.accountId]
              : table === 'auth_attempt'
                ? ['key_hash = ?', key]
                : null;
        if (where === null) continue;
        counts[table] =
          h.db.get<{ n: number }>(
            `SELECT COUNT(*) AS n FROM ${table} WHERE ${where[0]}`,
            [where[1] as string],
          )?.n ?? -1;
      }
      return counts;
    };
    const before = countRows();
    expect(before).toMatchObject({
      account: 1,
      category: 1,
      article: 1,
      shopping_list: 1,
      list_item: 1,
    });
    expect(before.device).toBe(2);
    expect(before.auth_attempt).toBeGreaterThan(0);

    expect(
      (await act(h, 'DELETE', `/v1/admin/accounts/${h.user.accountId}`))
        .statusCode,
    ).toBe(204);

    // `ended_credential` is the only table allowed to keep a row: it holds no account data
    // (research R16) and is not keyed by the account, so it is not in this count.
    expect(Object.values(countRows()).every((n) => n === 0)).toBe(true);
    expect(Object.keys(countRows())).toEqual(Object.keys(before));
    const ended = h.db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM ended_credential',
    );
    expect(ended?.n).toBe(2);
    h.db.close();
  });
});
