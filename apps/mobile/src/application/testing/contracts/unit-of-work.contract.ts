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
        await repos.lists.add(list('l-1', 'Ma liste'));
        await repos.items.save(item('l-1', 'a-1'));
      });
      const failure = new Error('failed midway');

      await expect(
        unitOfWork.run(async (repos) => {
          await repos.categories.add(category('c-2', 'Divers', 1));
          await repos.articles.add(article('a-2', 'Farine', 'c-2'));
          await repos.lists.add(list('l-2', 'Barbecue'));
          await repos.items.save(item('l-1', 'a-1', { inCart: true }));
          await repos.items.save(item('l-2', 'a-2'));
          await repos.appState.setCurrentListId(listId('l-2'));
          throw failure;
        }),
      ).rejects.toBe(failure);

      await unitOfWork.run(async (repos) => {
        expect(await repos.categories.all()).toEqual([
          category('c-1', 'Crèmerie', 0),
        ]);
        expect(await repos.articles.all()).toEqual([
          article('a-1', 'Lait', 'c-1'),
        ]);
        expect(await repos.lists.all()).toEqual([list('l-1', 'Ma liste')]);
        expect(await repos.items.find(listId('l-1'), articleId('a-1'))).toEqual(
          item('l-1', 'a-1'),
        );
        expect(await repos.appState.currentListId()).toBeNull();
      });
    });
  });
};
