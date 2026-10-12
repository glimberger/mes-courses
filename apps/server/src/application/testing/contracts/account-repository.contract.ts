import type { ServerStore } from '../../ports/store';
import { account, device } from './entities';

export const accountRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('AccountRepository contract', () => {
    let store: ServerStore;
    /** Accounts a fresh store already holds (SQLite's setup account), which the suite ignores. */
    let baseline: Set<string>;

    const mine = async () =>
      (await store.run(({ accounts }) => accounts.all())).filter(
        (record) => !baseline.has(record.id),
      );

    beforeEach(async () => {
      store = await createStore();
      baseline = new Set(
        (await store.run(({ accounts }) => accounts.all())).map((a) => a.id),
      );
    });

    it('finds nothing for an unknown id or address', async () => {
      await store.run(async ({ accounts }) => {
        expect(await accounts.get('a-1')).toBeNull();
        expect(await accounts.findByEmail('marie@example.org')).toBeNull();
      });
    });

    it('returns an account by id and by normalized email', async () => {
      const record = account('a-1', 'marie@example.org', {
        passwordHash: 'scrypt$x',
        temporaryPasswordHash: 'scrypt$t',
        temporaryExpiresAt: '2026-10-08T10:00:00.000Z',
      });
      await store.run(({ accounts }) => accounts.add(record));

      await store.run(async ({ accounts }) => {
        expect(await accounts.get('a-1')).toEqual(record);
        expect(await accounts.findByEmail('marie@example.org')).toEqual(record);
        expect(await accounts.findByEmail('MARIE@example.org')).toBeNull();
      });
    });

    it('rejects a second account with the same email', async () => {
      await store.run(({ accounts }) =>
        accounts.add(account('a-1', 'marie@example.org')),
      );

      await expect(
        store.run(({ accounts }) =>
          accounts.add(account('a-2', 'marie@example.org')),
        ),
      ).rejects.toThrow();
    });

    it('update replaces the account with the same id', async () => {
      await store.run(({ accounts }) =>
        accounts.add(account('a-1', 'marie@example.org')),
      );
      const changed = account('a-1', 'marie@example.org', {
        passwordHash: 'scrypt$y',
        suspendedAt: '2026-10-03T10:00:00.000Z',
      });
      await store.run(({ accounts }) => accounts.update(changed));

      expect(await store.run(({ accounts }) => accounts.get('a-1'))).toEqual(
        changed,
      );
    });

    it('lists the accounts by creation time, then id', async () => {
      await store.run(async ({ accounts }) => {
        await accounts.add(
          account('a-2', 'b@example.org', {
            createdAt: '2026-10-02T10:00:00.000Z',
          }),
        );
        await accounts.add(account('a-3', 'c@example.org'));
        await accounts.add(account('a-1', 'a@example.org'));
      });

      expect((await mine()).map((a) => a.id)).toEqual(['a-1', 'a-3', 'a-2']);
    });

    it('delete removes the account, and leaves the others', async () => {
      await store.run(async ({ accounts }) => {
        await accounts.add(account('a-1', 'a@example.org'));
        await accounts.add(account('a-2', 'b@example.org'));
      });
      await store.run(({ accounts }) => accounts.delete('a-1'));

      expect((await mine()).map((a) => a.id)).toEqual(['a-2']);
    });

    it('counts the other active administrators only', async () => {
      await store.run(async ({ accounts }) => {
        const admin = (id: string, overrides = {}) =>
          account(id, `${id}@example.org`, {
            role: 'administrator',
            passwordHash: 'h',
            ...overrides,
          });
        await accounts.add(admin('adm-1'));
        await accounts.add(admin('adm-2'));
        await accounts.add(
          admin('adm-suspended', { suspendedAt: '2026-10-02T10:00:00.000Z' }),
        );
        await accounts.add(admin('adm-invited', { passwordHash: null }));
        await accounts.add(
          account('u-1', 'u1@example.org', { passwordHash: 'h' }),
        );
      });

      await store.run(async ({ accounts }) => {
        expect(await accounts.countOtherActiveAdministrators('adm-1')).toBe(1);
        expect(await accounts.countOtherActiveAdministrators('u-1')).toBe(2);
        expect(
          await accounts.countOtherActiveAdministrators('adm-suspended'),
        ).toBe(2);
      });
    });

    it('lastSyncAt is the latest of the account devices, null without a sync', async () => {
      await store.run(async ({ accounts, devices }) => {
        await accounts.add(account('a-1', 'a@example.org'));
        await accounts.add(account('a-2', 'b@example.org'));
        await devices.add(
          device('d-1', 'h-1', {
            accountId: 'a-1',
            lastSyncAt: '2026-10-02T08:00:00.000Z',
          }),
        );
        await devices.add(
          device('d-2', 'h-2', {
            accountId: 'a-1',
            lastSyncAt: '2026-10-04T08:00:00.000Z',
          }),
        );
        await devices.add(device('d-3', 'h-3', { accountId: 'a-1' }));
        await devices.add(
          device('d-4', 'h-4', {
            accountId: 'a-2',
            lastSyncAt: '2026-10-09T08:00:00.000Z',
          }),
        );
        await accounts.add(account('a-3', 'c@example.org'));

        expect(await accounts.lastSyncAt('a-1')).toBe(
          '2026-10-04T08:00:00.000Z',
        );
        expect(await accounts.lastSyncAt('a-3')).toBeNull();
      });
    });

    it('deleting an account removes its devices', async () => {
      await store.run(async ({ accounts, devices }) => {
        await accounts.add(account('a-1', 'a@example.org'));
        await devices.add(device('d-1', 'h-1', { accountId: 'a-1' }));
      });
      await store.run(({ accounts }) => accounts.delete('a-1'));

      expect(await store.run(({ devices }) => devices.get('d-1'))).toBeNull();
    });
  });
};
