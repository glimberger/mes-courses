import type { ServerStore } from '../../ports/store';

const at = (minute: number) =>
  new Date(
    Date.parse('2026-10-12T10:00:00.000Z') + minute * 60_000,
  ).toISOString();

export const authAttemptRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('AuthAttemptRepository contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('counts nothing in an empty store', async () => {
      await store.run(async ({ authAttempts }) => {
        expect(await authAttempts.countSince('signIn', 'k-1', at(0))).toBe(0);
        expect(
          await authAttempts.earliestSince('signIn', 'k-1', at(0)),
        ).toBeNull();
      });
    });

    it('counts the attempts at or after the bound, and gives the earliest', async () => {
      await store.run(async ({ authAttempts }) => {
        await authAttempts.add('signIn', 'k-1', at(0));
        await authAttempts.add('signIn', 'k-1', at(3));
        await authAttempts.add('signIn', 'k-1', at(5));

        expect(await authAttempts.countSince('signIn', 'k-1', at(0))).toBe(3);
        expect(await authAttempts.countSince('signIn', 'k-1', at(3))).toBe(2);
        expect(await authAttempts.countSince('signIn', 'k-1', at(6))).toBe(0);
        expect(await authAttempts.earliestSince('signIn', 'k-1', at(1))).toBe(
          at(3),
        );
      });
    });

    it('keeps kinds and keys apart', async () => {
      await store.run(async ({ authAttempts }) => {
        await authAttempts.add('signIn', 'k-1', at(0));
        await authAttempts.add('passwordReset', 'k-1', at(0));
        await authAttempts.add('passwordReset', 'k-1', at(1));
        await authAttempts.add('signIn', 'k-2', at(0));

        expect(await authAttempts.countSince('signIn', 'k-1', at(0))).toBe(1);
        expect(
          await authAttempts.countSince('passwordReset', 'k-1', at(0)),
        ).toBe(2);
        expect(await authAttempts.countSince('signIn', 'k-2', at(0))).toBe(1);
        expect(
          await authAttempts.countSince('passwordReset', 'k-2', at(0)),
        ).toBe(0);
      });
    });

    it('pruneBefore removes the rows older than the bound, of every kind and key', async () => {
      await store.run(async ({ authAttempts }) => {
        await authAttempts.add('signIn', 'k-1', at(0));
        await authAttempts.add('passwordReset', 'k-2', at(1));
        await authAttempts.add('signIn', 'k-1', at(10));
        await authAttempts.pruneBefore(at(5));

        expect(await authAttempts.countSince('signIn', 'k-1', at(0))).toBe(1);
        expect(
          await authAttempts.countSince('passwordReset', 'k-2', at(0)),
        ).toBe(0);
      });
    });

    it('deleteForKey removes both kinds for that key and nothing else', async () => {
      await store.run(async ({ authAttempts }) => {
        await authAttempts.add('signIn', 'k-1', at(0));
        await authAttempts.add('passwordReset', 'k-1', at(0));
        await authAttempts.add('signIn', 'k-2', at(0));
        await authAttempts.deleteForKey('k-1');

        expect(await authAttempts.countSince('signIn', 'k-1', at(0))).toBe(0);
        expect(
          await authAttempts.countSince('passwordReset', 'k-1', at(0)),
        ).toBe(0);
        expect(await authAttempts.countSince('signIn', 'k-2', at(0))).toBe(1);
      });
    });
  });
};
