import type { ScopedStore } from './scoped-store';

export const pairingFailureRepositoryContract = (
  createStore: () => Promise<ScopedStore>,
) => {
  describe('PairingFailureRepository contract', () => {
    let store: ScopedStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('counts nothing in an empty store', async () => {
      await store.run(async ({ pairingFailures }) => {
        expect(
          await pairingFailures.countSince('2026-10-01T00:00:00.000Z'),
        ).toBe(0);
        expect(
          await pairingFailures.earliestSince('2026-10-01T00:00:00.000Z'),
        ).toBeNull();
      });
    });

    it('pruneBefore forgets the older failures only', async () => {
      await store.run(async ({ pairingFailures }) => {
        await pairingFailures.add('2026-10-01T10:00:00.000Z');
        await pairingFailures.add('2026-10-01T10:05:00.000Z');
        await pairingFailures.pruneBefore('2026-10-01T10:05:00.000Z');

        expect(
          await pairingFailures.countSince('2026-10-01T00:00:00.000Z'),
        ).toBe(1);
      });
    });

    it('countSince counts the failures at or after the instant', async () => {
      await store.run(async ({ pairingFailures }) => {
        await pairingFailures.add('2026-10-01T10:00:00.000Z');
        await pairingFailures.add('2026-10-01T10:05:00.000Z');
        await pairingFailures.add('2026-10-01T10:05:00.000Z');

        expect(
          await pairingFailures.countSince('2026-10-01T09:00:00.000Z'),
        ).toBe(3);
        expect(
          await pairingFailures.countSince('2026-10-01T10:00:00.000Z'),
        ).toBe(3);
        expect(
          await pairingFailures.countSince('2026-10-01T10:00:00.001Z'),
        ).toBe(2);
        expect(
          await pairingFailures.countSince('2026-10-01T10:06:00.000Z'),
        ).toBe(0);
      });
    });

    it('earliestSince returns the first failure at or after the instant', async () => {
      await store.run(async ({ pairingFailures }) => {
        await pairingFailures.add('2026-10-01T10:05:00.000Z');
        await pairingFailures.add('2026-10-01T10:00:00.000Z');

        expect(
          await pairingFailures.earliestSince('2026-10-01T09:00:00.000Z'),
        ).toBe('2026-10-01T10:00:00.000Z');
        expect(
          await pairingFailures.earliestSince('2026-10-01T10:01:00.000Z'),
        ).toBe('2026-10-01T10:05:00.000Z');
      });
    });

    it('keeps the failures across runs, so a restart does not reset the count', async () => {
      await store.run(({ pairingFailures }) =>
        pairingFailures.add('2026-10-01T10:00:00.000Z'),
      );

      expect(
        await store.run(({ pairingFailures }) =>
          pairingFailures.countSince('2026-10-01T09:00:00.000Z'),
        ),
      ).toBe(1);
    });
  });
};
