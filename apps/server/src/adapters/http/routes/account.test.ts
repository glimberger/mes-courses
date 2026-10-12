import { buildTestApp } from '../../../testing/start-test-server';

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
