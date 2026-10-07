import { normalizedName } from '../../../domain/name';
import type { Repositories } from '../../ports/unit-of-work';
import { article, category, item, list, listId } from './entities';

export const shoppingListRepositoryContract = (
  createRepositories: () => Promise<Repositories>,
) => {
  describe('ShoppingListRepository contract', () => {
    let repos: Repositories;

    beforeEach(async () => {
      repos = await createRepositories();
    });

    it('has no list at first', async () => {
      expect(await repos.lists.all()).toEqual([]);
      expect(await repos.lists.count()).toBe(0);
    });

    it('returns and counts every list added, in the order they were added', async () => {
      await repos.lists.add(list('l-2', 'Ma liste'));
      await repos.lists.add(list('l-1', 'Barbecue'));

      expect(await repos.lists.all()).toEqual([
        list('l-2', 'Ma liste'),
        list('l-1', 'Barbecue'),
      ]);
      expect(await repos.lists.count()).toBe(2);
    });

    it('finds a list by id, or null', async () => {
      await repos.lists.add(list('l-1', 'Ma liste'));

      expect(await repos.lists.findById(listId('l-1'))).toEqual(
        list('l-1', 'Ma liste'),
      );
      expect(await repos.lists.findById(listId('unknown'))).toBeNull();
    });

    it('finds a list by its normalized name, or null', async () => {
      await repos.lists.add(list('l-1', 'Pâte d’amande'));

      expect(
        await repos.lists.findByNormalizedName(normalizedName("pâte d'amande")),
      ).toEqual(list('l-1', 'Pâte d’amande'));
      expect(
        await repos.lists.findByNormalizedName(normalizedName('Pâté d’amande')),
      ).toBeNull();
    });

    it('rejects a list whose id or normalized name is taken, keeping the first', async () => {
      await repos.lists.add(list('l-1', 'Ma liste'));

      await expect(repos.lists.add(list('l-1', 'Barbecue'))).rejects.toThrow();
      await expect(
        repos.lists.add(list('l-2', '  ma   LISTE ')),
      ).rejects.toThrow();

      expect(await repos.lists.all()).toEqual([list('l-1', 'Ma liste')]);
    });

    it('keeps copies: changing an added or returned list changes nothing stored', async () => {
      const added = list('l-1', 'Ma liste');
      await repos.lists.add(added);
      added.name = 'Changed';

      const [found] = await repos.lists.all();
      if (found) found.name = 'Changed again';

      expect(await repos.lists.findById(listId('l-1'))).toEqual(
        list('l-1', 'Ma liste'),
      );
    });

    it('counts the items of every list, 0 included', async () => {
      await repos.categories.add(category('c-1', 'Crèmerie', 0));
      await repos.articles.add(article('a-1', 'Lait', 'c-1'));
      await repos.articles.add(article('a-2', 'Beurre', 'c-1'));
      await repos.lists.add(list('l-1', 'Ma liste'));
      await repos.lists.add(list('l-2', 'Barbecue'));
      await repos.lists.add(list('l-3', 'Vide'));
      await repos.items.save(item('l-1', 'a-1'));
      await repos.items.save(item('l-1', 'a-2', { inCart: true }));
      await repos.items.save(item('l-2', 'a-1'));

      expect(await repos.lists.itemCounts()).toEqual(
        new Map([
          [listId('l-1'), 2],
          [listId('l-2'), 1],
          [listId('l-3'), 0],
        ]),
      );
    });
  });
};
