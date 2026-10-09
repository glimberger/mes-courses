import type { ServerStore } from '../../ports/store';

export const metaRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('MetaRepository contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('starts with a server id and no change', async () => {
      await store.run(async ({ meta }) => {
        expect(await meta.serverId()).not.toBe('');
        expect(await meta.currentSeq()).toBe(0);
      });
    });

    it('keeps the same server id from one run to the next', async () => {
      const first = await store.run(({ meta }) => meta.serverId());
      const second = await store.run(({ meta }) => meta.serverId());

      expect(second).toBe(first);
    });

    it('nextSeq increments and returns the new value', async () => {
      await store.run(async ({ meta }) => {
        expect(await meta.nextSeq()).toBe(1);
        expect(await meta.nextSeq()).toBe(2);
        expect(await meta.currentSeq()).toBe(2);
      });
    });

    it('keeps the counter across runs', async () => {
      await store.run(({ meta }) => meta.nextSeq());

      expect(await store.run(({ meta }) => meta.nextSeq())).toBe(2);
    });
  });
};
