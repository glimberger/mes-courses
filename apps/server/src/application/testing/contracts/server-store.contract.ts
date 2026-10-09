import type { ServerStore } from '../../ports/store';
import {
  appliedChange,
  article,
  category,
  device,
  item,
  list,
} from './entities';

export const serverStoreContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('ServerStore contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('returns what the work returns', async () => {
      expect(await store.run(async () => 42)).toBe(42);
    });

    it('keeps the writes of a run that succeeds', async () => {
      await store.run(async ({ meta, categories }) => {
        await meta.nextSeq();
        await categories.save(category('c-1', 'Crèmerie', { seq: 1 }));
      });

      await store.run(async ({ meta, categories }) => {
        expect(await meta.currentSeq()).toBe(1);
        expect(await categories.get('c-1')).not.toBeNull();
      });
    });

    it('keeps no write of a run that throws, and rethrows its error', async () => {
      await store.run(async ({ categories }) => {
        await categories.save(category('c-1', 'Crèmerie'));
      });
      const failure = new Error('failed midway');

      await expect(
        store.run(async (repos) => {
          await repos.meta.nextSeq();
          await repos.categories.save(category('c-1', 'Renommée', { seq: 2 }));
          await repos.categories.save(category('c-2', 'Divers', { seq: 2 }));
          await repos.articles.save(article('a-1', 'Lait', 'c-1', { seq: 2 }));
          await repos.lists.save(list('l-1', 'Ma liste', { seq: 2 }));
          await repos.items.save(item('l-1', 'a-1', { seq: 2 }));
          await repos.appliedChanges.add(appliedChange('ch-1'));
          await repos.devices.add(device('d-1', 'h-1'));
          await repos.pairingFailures.add('2026-10-01T10:00:00.000Z');
          throw failure;
        }),
      ).rejects.toBe(failure);

      await store.run(async (repos) => {
        expect(await repos.meta.currentSeq()).toBe(0);
        expect((await repos.categories.get('c-1'))?.name).toBe('Crèmerie');
        expect(await repos.categories.get('c-2')).toBeNull();
        expect(await repos.articles.get('a-1')).toBeNull();
        expect(await repos.lists.get('l-1')).toBeNull();
        expect(await repos.items.get('l-1', 'a-1')).toBeNull();
        expect(await repos.appliedChanges.has('ch-1')).toBe(false);
        expect(await repos.devices.all()).toEqual([]);
        expect(
          await repos.pairingFailures.countSince('2000-01-01T00:00:00.000Z'),
        ).toBe(0);
      });
    });

    it('does not let two runs overlap', async () => {
      const order: string[] = [];
      const slow = store.run(async ({ meta }) => {
        order.push('slow start');
        await meta.nextSeq();
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push('slow end');
      });
      const fast = store.run(async ({ meta }) => {
        order.push('fast start');
        await meta.nextSeq();
        order.push('fast end');
      });
      await Promise.all([slow, fast]);

      expect(order).toEqual([
        'slow start',
        'slow end',
        'fast start',
        'fast end',
      ]);
      expect(await store.run(({ meta }) => meta.currentSeq())).toBe(2);
    });

    it('keeps running after a run that threw', async () => {
      await expect(
        store.run(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await store.run(async () => 'ok')).toBe('ok');
    });
  });
};
