import type { Clock } from '../ports/clock';
import { account } from '../testing/contracts/entities';
import { InMemoryStore } from '../testing/in-memory-store';
import { reactivateAccount } from './reactivate-account';
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

describe('reactivateAccount', () => {
  it('004 US5-3 clears the suspension: an active account is active again', async () => {
    const { store, deps } = await setup();
    const before = await get(store, 'user');
    await suspendAccount(deps, 'user');

    expect(await reactivateAccount(deps, 'user')).toEqual({
      kind: 'reactivated',
    });

    expect(await get(store, 'user')).toEqual(before);
  });

  it('004 US5-3 returns an invited account to invited', async () => {
    const { store, deps } = await setup();
    await suspendAccount(deps, 'invited');
    await reactivateAccount(deps, 'invited');

    const record = await get(store, 'invited');
    expect(record?.suspendedAt).toBeNull();
    expect(record?.passwordHash).toBeNull();
  });

  it('is a no-op on an account that is not suspended', async () => {
    const { store, deps } = await setup();
    const before = await get(store, 'user');

    expect(await reactivateAccount(deps, 'user')).toEqual({
      kind: 'reactivated',
    });
    expect(await get(store, 'user')).toEqual(before);
  });

  it('answers notFound for an unknown id', async () => {
    const { deps } = await setup();
    expect(await reactivateAccount(deps, 'nobody')).toEqual({
      kind: 'notFound',
    });
  });
});
