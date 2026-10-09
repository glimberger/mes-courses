import type { Repositories, ServerStore } from '../../ports/store';
import { article, category, hlc, item, list } from './entities';

const prepare = async ({ categories, articles, lists }: Repositories) => {
  await categories.save(category('c-1', 'Crèmerie'));
  await articles.save(article('a-1', 'Lait', 'c-1'));
  await articles.save(article('a-2', 'Beurre', 'c-1'));
  await lists.save(list('l-1', 'Ma liste'));
};

export const listItemRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('ListItemRepository contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('finds nothing in an empty store', async () => {
      await store.run(async ({ items }) => {
        expect(await items.get('l-1', 'a-1')).toBeNull();
        expect(await items.changedSince(0, 10)).toEqual([]);
      });
    });

    it('returns what was saved, by list and article', async () => {
      const record = item('l-1', 'a-1', {
        inCart: true,
        quantity: { amount: 2, unit: 'L' },
        seq: 4,
      });
      await store.run(async (repos) => {
        await prepare(repos);
        await repos.items.save(record);
      });

      await store.run(async ({ items }) => {
        expect(await items.get('l-1', 'a-1')).toEqual(record);
        expect(await items.get('l-1', 'a-2')).toBeNull();
      });
    });

    it('keeps a quantity without unit, and no quantity', async () => {
      await store.run(async (repos) => {
        await prepare(repos);
        await repos.items.save(
          item('l-1', 'a-1', { quantity: { amount: 3, unit: null } }),
        );
        await repos.items.save(item('l-1', 'a-2', { quantity: null }));
      });

      await store.run(async ({ items }) => {
        expect((await items.get('l-1', 'a-1'))?.quantity).toEqual({
          amount: 3,
          unit: null,
        });
        expect((await items.get('l-1', 'a-2'))?.quantity).toBeNull();
      });
    });

    it('save replaces the row with the same list and article', async () => {
      const removed = item('l-1', 'a-1', {
        present: false,
        presentHlc: hlc(9),
        seq: 2,
      });
      await store.run(async (repos) => {
        await prepare(repos);
        await repos.items.save(item('l-1', 'a-1'));
        await repos.items.save(removed);
      });

      await store.run(async ({ items }) => {
        expect(await items.get('l-1', 'a-1')).toEqual(removed);
        expect(await items.changedSince(0, 10)).toEqual([removed]);
      });
    });

    it('lists the rows changed since a seq, by increasing seq, up to the limit', async () => {
      await store.run(async (repos) => {
        await prepare(repos);
        await repos.items.save(item('l-1', 'a-2', { seq: 2 }));
        await repos.items.save(item('l-1', 'a-1', { seq: 1 }));
      });

      await store.run(async ({ items }) => {
        const ids = async (since: number, limit: number) =>
          (await items.changedSince(since, limit)).map((r) => r.articleId);
        expect(await ids(0, 10)).toEqual(['a-1', 'a-2']);
        expect(await ids(1, 10)).toEqual(['a-2']);
        expect(await ids(0, 1)).toEqual(['a-1']);
        expect(await ids(2, 10)).toEqual([]);
      });
    });

    it('does not split the rows sharing a seq across pages', async () => {
      await store.run(async (repos) => {
        await prepare(repos);
        await repos.articles.save(article('a-3', 'Oeufs', 'c-1'));
        await repos.articles.save(article('a-4', 'Pain', 'c-1'));
        await repos.items.save(item('l-1', 'a-1', { seq: 1 }));
        await repos.items.save(item('l-1', 'a-2', { seq: 2 }));
        await repos.items.save(item('l-1', 'a-3', { seq: 2 }));
        await repos.items.save(item('l-1', 'a-4', { seq: 2 }));
      });

      await store.run(async ({ items }) => {
        const page = await items.changedSince(0, 2);
        expect(page.map((r) => r.articleId)).toEqual([
          'a-1',
          'a-2',
          'a-3',
          'a-4',
        ]);
      });
    });
  });
};
