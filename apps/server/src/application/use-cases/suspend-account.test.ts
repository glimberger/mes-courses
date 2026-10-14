import type { Clock } from '../ports/clock';
import { account } from '../testing/contracts/entities';
import { InMemoryStore } from '../testing/in-memory-store';
import { suspendAccount } from './suspend-account';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const setup = async () => {
  const store = new InMemoryStore();
  await store.run(async ({ accounts }) => {
    await accounts.add(
      account('admin', 'admin@example.org', {
        role: 'administrator',
        passwordHash: 'h',
      }),
    );
    await accounts.add(account('user', 'u@example.org', { passwordHash: 'h' }));
    await accounts.add(account('invited', 'i@example.org'));
  });
  return { store, deps: { store, clock: new FakeClock() } };
};

const get = (store: InMemoryStore, id: string) =>
  store.run(({ accounts }) => accounts.get(id));

describe('suspendAccount', () => {
  it('004 US5-2 sets suspended_at and changes nothing else', async () => {
    const { store, deps } = await setup();
    const before = await get(store, 'user');

    expect(await suspendAccount(deps, 'user')).toEqual({ kind: 'suspended' });

    expect(await get(store, 'user')).toEqual({
      ...before,
      suspendedAt: '2026-10-12T10:00:00.000Z',
    });
  });

  it('004 US5-2 is a no-op on a suspended account: the first instant stays', async () => {
    const { store, deps } = await setup();
    await suspendAccount(deps, 'user');
    deps.clock.ms += 60_000;

    expect(await suspendAccount(deps, 'user')).toEqual({ kind: 'suspended' });

    expect((await get(store, 'user'))?.suspendedAt).toBe(
      '2026-10-12T10:00:00.000Z',
    );
  });

  it('004 US5-5 refuses to suspend the only active administrator', async () => {
    const { store, deps } = await setup();

    expect(await suspendAccount(deps, 'admin')).toEqual({
      kind: 'lastAdministrator',
    });
    expect((await get(store, 'admin'))?.suspendedAt).toBeNull();
  });

  it('004 US5-5 suspends an administrator while another active one remains', async () => {
    const { store, deps } = await setup();
    await store.run(({ accounts }) =>
      accounts.add(
        account('admin2', 'admin2@example.org', {
          role: 'administrator',
          passwordHash: 'h',
        }),
      ),
    );

    expect(await suspendAccount(deps, 'admin')).toEqual({ kind: 'suspended' });
  });

  it('answers notFound for an unknown id', async () => {
    const { deps } = await setup();
    expect(await suspendAccount(deps, 'nobody')).toEqual({ kind: 'notFound' });
  });
});
