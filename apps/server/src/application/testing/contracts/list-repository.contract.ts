import type { ScopedStore } from './scoped-store';
import { hlc, list } from './entities';
import { entityRepositoryContract } from './entity-repository.contract';

export const listRepositoryContract = (
  createStore: () => Promise<ScopedStore>,
) => {
  entityRepositoryContract('List', createStore, (repos) => repos.lists, list);

  describe('List repository contract, deleted lists (012)', () => {
    let store: ScopedStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('keeps a deleted list, sends it in changedSince, and frees its name', async () => {
      const deleted = list('l-1', 'Barbecue', {
        deletedHlc: hlc(5),
        mergedInto: null,
        seq: 2,
      });
      await store.run(({ lists }) => lists.save(deleted));

      await store.run(async ({ lists }) => {
        expect(await lists.get('l-1')).toEqual(deleted);
        expect(await lists.changedSince(0, 10)).toEqual([deleted]);
        expect(await lists.findLiveByNormalizedName('barbecue')).toBeNull();

        const again = list('l-2', 'Barbecue', { seq: 3 });
        await lists.save(again);
        expect(await lists.findLiveByNormalizedName('barbecue')).toEqual(again);
      });
    });
  });
};
