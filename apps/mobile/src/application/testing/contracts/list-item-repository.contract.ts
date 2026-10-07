import type { Repositories } from '../../ports/unit-of-work';
import { article, articleId, category, item, list, listId } from './entities';

export const listItemRepositoryContract = (
  createRepositories: () => Promise<Repositories>,
) => {
  describe('ListItemRepository contract', () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
      await repos.categories.add(category('c-1', 'Crèmerie', 0));
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));
      await repos.articles.add(article('a-2', 'Farine', 'c-1'));
      await repos.lists.add(list('l-1', 'Ma liste'));
      await repos.lists.add(list('l-2', 'Barbecue'));
    });

    it('has no item on a new list', async () => {
      expect(await repos.items.forList(listId('l-1'))).toEqual([]);
    });

    it('inserts an item, with or without a quantity', async () => {
      await repos.items.save(
        item('l-1', 'a-1', { quantity: { amount: 2, unit: 'L' } }),
      );
      await repos.items.save(item('l-1', 'a-2'));

      const items = await repos.items.forList(listId('l-1'));
      expect(items).toHaveLength(2);
      expect(items).toEqual(
        expect.arrayContaining([
          item('l-1', 'a-1', { quantity: { amount: 2, unit: 'L' } }),
          item('l-1', 'a-2'),
        ]),
      );
    });

    it('keeps an amount with decimals and no unit unchanged', async () => {
      await repos.items.save(
        item('l-1', 'a-2', { quantity: { amount: 0.125, unit: null } }),
      );

      expect(await repos.items.find(listId('l-1'), articleId('a-2'))).toEqual(
        item('l-1', 'a-2', { quantity: { amount: 0.125, unit: null } }),
      );
    });

    it('updates the item when the list already holds the article', async () => {
      await repos.items.save(
        item('l-1', 'a-1', { quantity: { amount: 2, unit: 'L' } }),
      );
      await repos.items.save(
        item('l-1', 'a-1', {
          inCart: true,
          quantity: { amount: 1.5, unit: 'kg' },
        }),
      );

      expect(await repos.items.forList(listId('l-1'))).toEqual([
        item('l-1', 'a-1', {
          inCart: true,
          quantity: { amount: 1.5, unit: 'kg' },
        }),
      ]);
    });

    it('returns only the items of the list asked for', async () => {
      await repos.items.save(item('l-1', 'a-1'));
      await repos.items.save(item('l-2', 'a-2'));

      expect(await repos.items.forList(listId('l-2'))).toEqual([
        item('l-2', 'a-2'),
      ]);
    });

    it('finds an item by list and article, or null', async () => {
      await repos.items.save(item('l-1', 'a-1', { inCart: true }));

      expect(await repos.items.find(listId('l-1'), articleId('a-1'))).toEqual(
        item('l-1', 'a-1', { inCart: true }),
      );
      expect(
        await repos.items.find(listId('l-2'), articleId('a-1')),
      ).toBeNull();
    });

    it('removes an item from its list only', async () => {
      await repos.items.save(item('l-1', 'a-1'));
      await repos.items.save(item('l-2', 'a-1'));

      await repos.items.remove(listId('l-1'), articleId('a-1'));

      expect(
        await repos.items.find(listId('l-1'), articleId('a-1')),
      ).toBeNull();
      expect(await repos.items.find(listId('l-2'), articleId('a-1'))).toEqual(
        item('l-2', 'a-1'),
      );
    });

    it('takes every item of the list out of the cart, keeping items and quantities', async () => {
      await repos.items.save(
        item('l-1', 'a-1', {
          inCart: true,
          quantity: { amount: 2, unit: 'L' },
        }),
      );
      await repos.items.save(item('l-1', 'a-2'));
      await repos.items.save(item('l-2', 'a-1', { inCart: true }));

      await repos.items.takeAllOutOfCart(listId('l-1'));

      const items = await repos.items.forList(listId('l-1'));
      expect(items).toHaveLength(2);
      expect(items).toEqual(
        expect.arrayContaining([
          item('l-1', 'a-1', { quantity: { amount: 2, unit: 'L' } }),
          item('l-1', 'a-2'),
        ]),
      );
      expect(await repos.items.find(listId('l-2'), articleId('a-1'))).toEqual(
        item('l-2', 'a-1', { inCart: true }),
      );
    });

    it('returns copies: changing a returned item changes nothing stored', async () => {
      await repos.items.save(
        item('l-1', 'a-1', { quantity: { amount: 2, unit: 'L' } }),
      );

      const found = await repos.items.find(listId('l-1'), articleId('a-1'));
      if (found?.quantity) {
        found.inCart = true;
        found.quantity.amount = 9;
      }

      expect(await repos.items.find(listId('l-1'), articleId('a-1'))).toEqual(
        item('l-1', 'a-1', { quantity: { amount: 2, unit: 'L' } }),
      );
    });
  });
};
