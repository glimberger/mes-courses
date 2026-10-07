import type { UnitOfWork } from '../../ports/unit-of-work';
import { article, articleId, category, item, list, listId } from './entities';

export const unitOfWorkContract = (
  createUnitOfWork: () => Promise<UnitOfWork>,
) => {
  describe('UnitOfWork contract', () => {
    let unitOfWork: UnitOfWork;

    beforeEach(async () => {
      unitOfWork = await createUnitOfWork();
    });

    it('returns what the work returns', async () => {
      expect(await unitOfWork.run(async () => 42)).toBe(42);
    });

    it('keeps the writes of a run that succeeds', async () => {
      await unitOfWork.run(async (repos) => {
        await repos.lists.add(list('l-1', 'Ma liste'));
        await repos.appState.setCurrentListId(listId('l-1'));
      });

      await unitOfWork.run(async (repos) => {
        expect(await repos.lists.all()).toEqual([list('l-1', 'Ma liste')]);
        expect(await repos.appState.currentListId()).toBe('l-1');
      });
    });

    it('FR-028 keeps no write of a run that throws, and rethrows its error', async () => {
      await unitOfWork.run(async (repos) => {
        await repos.categories.add(category('c-1', 'Crèmerie', 0));
        await repos.articles.add(article('a-1', 'Lait', 'c-1'));
        await repos.articles.add(article('a-2', 'Beurre', 'c-1'));
        await repos.lists.add(list('l-1', 'Ma liste'));
        await repos.items.save(
          item('l-1', 'a-1', {
            inCart: true,
            quantity: { amount: 2, unit: 'L' },
          }),
        );
        await repos.items.save(item('l-1', 'a-2'));
      });
      const failure = new Error('failed midway');

      await expect(
        unitOfWork.run(async (repos) => {
          await repos.categories.add(category('c-2', 'Divers', 1));
          await repos.articles.add(article('a-3', 'Farine', 'c-2'));
          await repos.lists.add(list('l-2', 'Barbecue'));
          await repos.items.save(item('l-2', 'a-3'));
          await repos.items.save(item('l-1', 'a-2', { inCart: true }));
          await repos.items.takeAllOutOfCart(listId('l-1'));
          await repos.items.remove(listId('l-1'), articleId('a-2'));
          await repos.appState.setCurrentListId(listId('l-2'));
          throw failure;
        }),
      ).rejects.toBe(failure);

      await unitOfWork.run(async (repos) => {
        expect(await repos.categories.all()).toEqual([
          category('c-1', 'Crèmerie', 0),
        ]);
        const articles = await repos.articles.all();
        expect(articles).toHaveLength(2);
        expect(articles).toEqual(
          expect.arrayContaining([
            article('a-1', 'Lait', 'c-1'),
            article('a-2', 'Beurre', 'c-1'),
          ]),
        );
        expect(await repos.lists.all()).toEqual([list('l-1', 'Ma liste')]);
        const items = await repos.items.forList(listId('l-1'));
        expect(items).toHaveLength(2);
        expect(items).toEqual(
          expect.arrayContaining([
            item('l-1', 'a-1', {
              inCart: true,
              quantity: { amount: 2, unit: 'L' },
            }),
            item('l-1', 'a-2'),
          ]),
        );
        expect(await repos.appState.currentListId()).toBeNull();
      });
    });

    it('rejects a run started inside another, and lets the outer run finish', async () => {
      const result = await unitOfWork.run(async (repos) => {
        await repos.lists.add(list('l-1', 'Ma liste'));
        await expect(unitOfWork.run(async () => 'inner')).rejects.toThrow();
        return 'outer';
      });

      expect(result).toBe('outer');
      await unitOfWork.run(async (repos) => {
        expect(await repos.lists.all()).toEqual([list('l-1', 'Ma liste')]);
      });
    });
  });
};
