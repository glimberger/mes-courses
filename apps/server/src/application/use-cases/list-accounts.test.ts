import type { Clock } from '../ports/clock';
import { account, device } from '../testing/contracts/entities';
import { InMemoryStore } from '../testing/in-memory-store';
import { listAccounts } from './list-accounts';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const FUTURE = '2026-10-15T10:00:00.000Z';
const PAST = '2026-10-10T10:00:00.000Z';

const setup = () => {
  const store = new InMemoryStore();
  return { store, deps: { store, clock: new FakeClock() } };
};

describe('listAccounts', () => {
  it('004 US5-1 lists invited, active and suspended accounts with their state, by creation time', async () => {
    const { store, deps } = setup();
    await store.run(async ({ accounts }) => {
      await accounts.add(
        account('a-1', 'admin@example.org', {
          role: 'administrator',
          passwordHash: 'h',
          createdAt: '2026-09-01T10:00:00.000Z',
        }),
      );
      await accounts.add(
        account('a-2', 'invited@example.org', {
          temporaryPasswordHash: 't',
          temporaryExpiresAt: FUTURE,
          createdAt: '2026-09-02T10:00:00.000Z',
        }),
      );
      await accounts.add(
        account('a-3', 'suspended@example.org', {
          passwordHash: 'h',
          suspendedAt: '2026-10-01T10:00:00.000Z',
          createdAt: '2026-09-03T10:00:00.000Z',
        }),
      );
    });

    expect(await listAccounts(deps)).toEqual([
      {
        id: 'a-1',
        email: 'admin@example.org',
        role: 'administrator',
        state: 'active',
        lastSyncAt: null,
        invitationExpired: false,
      },
      {
        id: 'a-2',
        email: 'invited@example.org',
        role: 'user',
        state: 'invited',
        lastSyncAt: null,
        invitationExpired: false,
      },
      {
        id: 'a-3',
        email: 'suspended@example.org',
        role: 'user',
        state: 'suspended',
        lastSyncAt: null,
        invitationExpired: false,
      },
    ]);
  });

  it('004 US5-1 shows the last sync of the newest device, null when there is none', async () => {
    const { store, deps } = setup();
    await store.run(async ({ accounts, devices }) => {
      await accounts.add(
        account('a-1', 'a@example.org', { passwordHash: 'h' }),
      );
      await accounts.add(
        account('a-2', 'b@example.org', { passwordHash: 'h' }),
      );
      await devices.add(
        device('d-1', 'h1', {
          accountId: 'a-1',
          lastSyncAt: '2026-10-01T10:00:00.000Z',
        }),
      );
      await devices.add(
        device('d-2', 'h2', {
          accountId: 'a-1',
          lastSyncAt: '2026-10-05T10:00:00.000Z',
        }),
      );
    });

    const list = await listAccounts(deps);

    expect(list.map((a) => a.lastSyncAt)).toEqual([
      '2026-10-05T10:00:00.000Z',
      null,
    ]);
  });

  it('004 flags an invited account whose temporary password expired, not an active one', async () => {
    const { store, deps } = setup();
    await store.run(async ({ accounts }) => {
      await accounts.add(
        account('a-1', 'a@example.org', {
          temporaryPasswordHash: 't',
          temporaryExpiresAt: PAST,
          createdAt: '2026-09-01T10:00:00.000Z',
        }),
      );
      await accounts.add(
        account('a-2', 'b@example.org', {
          passwordHash: 'h',
          temporaryPasswordHash: 't',
          temporaryExpiresAt: PAST,
          createdAt: '2026-09-02T10:00:00.000Z',
        }),
      );
    });

    const list = await listAccounts(deps);

    expect(list.map((a) => [a.state, a.invitationExpired])).toEqual([
      ['invited', true],
      ['active', false],
    ]);
  });

  it('004 omits the setup account until create-admin completed it', async () => {
    const { store, deps } = setup();
    await store.run(({ accounts }) =>
      accounts.add(account('setup', null, { role: 'administrator' })),
    );
    expect(await listAccounts(deps)).toEqual([]);

    await store.run(async ({ accounts }) => {
      const setupAccount = await accounts.get('setup');
      if (setupAccount === null) throw new Error('missing');
      await accounts.update({
        ...setupAccount,
        email: 'admin@example.org',
        passwordHash: 'h',
      });
    });

    expect((await listAccounts(deps)).map((a) => a.email)).toEqual([
      'admin@example.org',
    ]);
  });
});
