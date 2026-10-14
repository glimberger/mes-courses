import type { AccountSummary } from '@mes-courses/sync-core';

import { InMemoryAdminServer } from '../testing/in-memory-admin-server';
import { pairedDevice } from '../testing/paired-device';
import { createListAccounts } from './list-accounts';

const summary = (email: string): AccountSummary => ({
  id: `id-${email}`,
  email,
  role: 'user',
  state: 'active',
  lastSyncAt: null,
  invitationExpired: false,
});

describe('listAccounts', () => {
  it('004 US5-1 returns the accounts of the server', async () => {
    const { unitOfWork, credentials } = await pairedDevice();
    const adminServer = new InMemoryAdminServer([summary('a@example.org')]);

    const result = await createListAccounts({
      unitOfWork,
      credentials,
      adminServer,
    })();

    expect(result).toEqual({ ok: true, value: [summary('a@example.org')] });
  });

  it('004 returns the refusal of an ordinary user as it is', async () => {
    const { unitOfWork, credentials } = await pairedDevice();
    const adminServer = new InMemoryAdminServer();
    adminServer.forbidden = true;

    expect(
      await createListAccounts({ unitOfWork, credentials, adminServer })(),
    ).toEqual({ ok: false, error: { type: 'Forbidden' } });
  });

  it('004 FR-007 returns Offline without a connection to the server', async () => {
    const { unitOfWork, credentials } = await pairedDevice();
    const adminServer = new InMemoryAdminServer();
    adminServer.offline = true;

    expect(
      await createListAccounts({ unitOfWork, credentials, adminServer })(),
    ).toEqual({ ok: false, error: { type: 'Offline' } });
  });

  it('004 fails as a device the server no longer knows when it has no credential', async () => {
    const { unitOfWork, credentials } = await pairedDevice();
    await credentials.clear();

    expect(
      await createListAccounts({
        unitOfWork,
        credentials,
        adminServer: new InMemoryAdminServer(),
      })(),
    ).toEqual({ ok: false, error: { type: 'DeviceNotAuthorized' } });
  });
});
