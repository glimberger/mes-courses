import type { ServerStore } from '../../ports/store';
import { device, pairingCode } from './entities';

export const pairingCodeRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('PairingCodeRepository contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('finds nothing in an empty store', async () => {
      expect(
        await store.run(({ pairingCodes }) => pairingCodes.findByHash('c-1')),
      ).toBeNull();
    });

    it('returns a code by its hash', async () => {
      const record = pairingCode('c-1');
      await store.run(({ pairingCodes }) => pairingCodes.add(record));

      await store.run(async ({ pairingCodes }) => {
        expect(await pairingCodes.findByHash('c-1')).toEqual(record);
        expect(await pairingCodes.findByHash('c-2')).toBeNull();
      });
    });

    it('keeps the device that created a code', async () => {
      await store.run(async ({ devices, pairingCodes }) => {
        await devices.add(device('d-1', 'h-1'));
        await pairingCodes.add(pairingCode('c-1', { createdBy: 'd-1' }));
      });

      const found = await store.run(({ pairingCodes }) =>
        pairingCodes.findByHash('c-1'),
      );
      expect(found?.createdBy).toBe('d-1');
    });

    it('markUsed records when the code was used', async () => {
      await store.run(({ pairingCodes }) =>
        pairingCodes.add(pairingCode('c-1')),
      );
      await store.run(({ pairingCodes }) =>
        pairingCodes.markUsed('c-1', '2026-10-01T10:05:00.000Z'),
      );

      const found = await store.run(({ pairingCodes }) =>
        pairingCodes.findByHash('c-1'),
      );
      expect(found?.usedAt).toBe('2026-10-01T10:05:00.000Z');
    });
  });
};
