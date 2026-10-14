import { InMemoryAdminServer } from '../testing/in-memory-admin-server';
import { pairedDevice } from '../testing/paired-device';
import { createDeleteAccountAsAdmin } from './delete-account-as-admin';
import { createReactivateAccount } from './reactivate-account';
import { createResendCredentials } from './resend-credentials';
import { createSuspendAccount } from './suspend-account';

const account = (
  id: string,
  state: 'invited' | 'active' | 'suspended',
  role: 'user' | 'administrator' = 'user',
) => ({
  id,
  email: `${id}@example.org`,
  role,
  state,
  lastSyncAt: null,
  invitationExpired: false,
});

const setup = async () => {
  const { unitOfWork, credentials } = await pairedDevice();
  const adminServer = new InMemoryAdminServer([
    account('admin', 'active', 'administrator'),
    account('marie', 'active'),
    account('paul', 'invited'),
  ]);
  const deps = { unitOfWork, credentials, adminServer };
  return {
    adminServer,
    suspend: createSuspendAccount(deps),
    reactivate: createReactivateAccount(deps),
    resend: createResendCredentials(deps),
    remove: createDeleteAccountAsAdmin(deps),
  };
};

const stateOf = (server: InMemoryAdminServer, id: string) =>
  server.accounts.find((account) => account.id === id)?.state;

describe('administering accounts', () => {
  it('004 US5-2 suspends an account, then US5-3 reactivates it', async () => {
    const { adminServer, suspend, reactivate } = await setup();

    expect(await suspend('marie')).toEqual({ ok: true, value: undefined });
    expect(stateOf(adminServer, 'marie')).toBe('suspended');
    expect(await reactivate('marie')).toEqual({ ok: true, value: undefined });
    expect(stateOf(adminServer, 'marie')).toBe('active');
  });

  it('004 US5-5 refuses to suspend or delete the only administrator', async () => {
    const { suspend, remove } = await setup();

    expect(await suspend('admin')).toEqual({
      ok: false,
      error: { type: 'LastAdministrator' },
    });
    expect(await remove('admin')).toEqual({
      ok: false,
      error: { type: 'LastAdministrator' },
    });
  });

  it('004 US5-4 deletes an account', async () => {
    const { adminServer, remove } = await setup();

    expect(await remove('marie')).toEqual({ ok: true, value: undefined });
    expect(adminServer.accounts.map(({ id }) => id)).toEqual(['admin', 'paul']);
  });

  it('004 US5-6 resends credentials to an invited account only', async () => {
    const { adminServer, resend } = await setup();

    expect(await resend('paul')).toEqual({ ok: true, value: undefined });
    expect(adminServer.resent).toEqual(['paul']);
    expect(await resend('marie')).toEqual({
      ok: false,
      error: { type: 'NotInvited' },
    });
  });

  it('004 US5-6 reports a resend whose email failed', async () => {
    const { adminServer, resend } = await setup();
    adminServer.resendMailFails = true;

    expect(await resend('paul')).toEqual({
      ok: false,
      error: { type: 'MailFailed' },
    });
  });

  it("reports an unknown account and an ordinary user's refusal", async () => {
    const { adminServer, suspend } = await setup();

    expect(await suspend('nobody')).toEqual({
      ok: false,
      error: { type: 'NotFound' },
    });
    adminServer.forbidden = true;
    expect(await suspend('marie')).toEqual({
      ok: false,
      error: { type: 'Forbidden' },
    });
  });

  it('reports DeviceNotAuthorized, with no request, when the device has no credential', async () => {
    const { unitOfWork, credentials } = await pairedDevice();
    await credentials.clear();
    const adminServer = new InMemoryAdminServer([account('marie', 'active')]);
    const suspend = createSuspendAccount({
      unitOfWork,
      credentials,
      adminServer,
    });

    expect(await suspend('marie')).toEqual({
      ok: false,
      error: { type: 'DeviceNotAuthorized' },
    });
    expect(adminServer.suspended).toEqual([]);
  });
});
