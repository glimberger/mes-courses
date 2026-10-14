import type { Clock } from '../ports/clock';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import {
  account,
  appliedChange,
  category,
  device,
  list,
} from '../testing/contracts/entities';
import { InMemoryStore } from '../testing/in-memory-store';
import { attemptKey } from '../../domain/attempts';
import { deleteAccount } from './delete-account';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const setup = async () => {
  const store = new InMemoryStore();
  const crypto = createFakePairingCrypto();
  await store.run(async ({ accounts, devices, authAttempts }) => {
    await accounts.add(
      account('admin', 'admin@example.org', {
        role: 'administrator',
        passwordHash: 'h',
      }),
    );
    await accounts.add(account('user', 'u@example.org', { passwordHash: 'h' }));
    await accounts.add(
      account('other', 'o@example.org', { passwordHash: 'h' }),
    );
    await devices.add(device('d-1', 'cred-1', { accountId: 'user' }));
    await devices.add(
      device('d-2', 'cred-2', {
        accountId: 'user',
        revokedAt: '2026-10-02T10:00:00.000Z',
      }),
    );
    await devices.add(device('d-3', 'cred-3', { accountId: 'other' }));
    for (const email of ['u@example.org', 'o@example.org']) {
      const key = attemptKey(crypto.sha256Hex, email);
      await authAttempts.add('signIn', key, '2026-10-12T09:59:00.000Z');
      await authAttempts.add('passwordReset', key, '2026-10-12T09:59:00.000Z');
    }
  });
  return { store, crypto, deps: { store, crypto, clock: new FakeClock() } };
};

describe('deleteAccount', () => {
  it('004 US5-4 keeps each device credential in ended_credential and removes the account', async () => {
    const { store, deps } = await setup();

    expect(await deleteAccount(deps, 'user')).toEqual({ kind: 'deleted' });

    await store.run(async ({ accounts, devices, endedCredentials }) => {
      expect(await accounts.get('user')).toBeNull();
      expect(await devices.get('d-1')).toBeNull();
      expect(await endedCredentials.find('cred-1')).toEqual({
        reason: 'accountDeleted',
      });
      expect(await endedCredentials.find('cred-2')).toEqual({
        reason: 'accountDeleted',
      });
      expect(await endedCredentials.find('cred-3')).toBeNull();
    });
  });

  it('004 SC-007 deletes the attempt rows keyed by the address, of both kinds, and no other', async () => {
    const { store, crypto, deps } = await setup();

    await deleteAccount(deps, 'user');

    await store.run(async ({ authAttempts }) => {
      const since = '2026-10-01T00:00:00.000Z';
      const gone = attemptKey(crypto.sha256Hex, 'u@example.org');
      const kept = attemptKey(crypto.sha256Hex, 'o@example.org');
      for (const kind of ['signIn', 'passwordReset'] as const) {
        expect(await authAttempts.countSince(kind, gone, since)).toBe(0);
        expect(await authAttempts.countSince(kind, kept, since)).toBe(1);
      }
    });
  });

  it('004 US5-4 leaves other accounts alone', async () => {
    const { store, deps } = await setup();

    await deleteAccount(deps, 'user');

    await store.run(async ({ accounts, devices }) => {
      expect(await accounts.get('other')).not.toBeNull();
      expect(await devices.get('d-3')).not.toBeNull();
    });
  });

  it('004 US5-5 refuses to delete the only active administrator', async () => {
    const { store, deps } = await setup();

    expect(await deleteAccount(deps, 'admin')).toEqual({
      kind: 'lastAdministrator',
    });
    expect(
      await store.run(({ accounts }) => accounts.get('admin')),
    ).not.toBeNull();
  });

  it('004 SC-007 leaves no data of the account on the in-memory fake, and keeps the others', async () => {
    const { store, deps } = await setup();
    for (const id of ['user', 'other']) {
      await store.runForAccount(id, async (repos) => {
        await repos.categories.save(category('cat', 'Rayon'));
        await repos.lists.save(list('lst', 'Liste'));
        await repos.appliedChanges.add(appliedChange('c-1'));
      });
    }

    await deleteAccount(deps, 'user');

    const count = (id: string) =>
      store.runForAccount(id, async (repos) => ({
        categories: await repos.categories.changedSince(0, 100),
        lists: await repos.lists.changedSince(0, 100),
        applied: await repos.appliedChanges.has('c-1'),
      }));
    expect(await count('user')).toEqual({
      categories: [],
      lists: [],
      applied: false,
    });
    expect((await count('other')).categories).toHaveLength(1);
  });

  it('deletes a suspended account', async () => {
    const { store, deps } = await setup();
    await store.run(async ({ accounts }) => {
      const record = await accounts.get('user');
      if (record) {
        await accounts.update({
          ...record,
          suspendedAt: '2026-10-11T10:00:00.000Z',
        });
      }
    });

    expect(await deleteAccount(deps, 'user')).toEqual({ kind: 'deleted' });
  });

  it('answers notFound for an unknown id and changes nothing', async () => {
    const { store, deps } = await setup();

    expect(await deleteAccount(deps, 'nobody')).toEqual({ kind: 'notFound' });
    expect(await store.run(({ accounts }) => accounts.all())).toHaveLength(3);
  });
});
