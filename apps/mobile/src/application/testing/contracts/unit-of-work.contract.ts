import type { Repositories, UnitOfWork } from '../../ports/unit-of-work';
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

    it('runs a run started while another is going after it ends, in the order they were started', async () => {
      const steps: string[] = [];
      let release = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });

      const first = unitOfWork.run(async (repos) => {
        steps.push('first started');
        await repos.lists.add(list('l-1', 'Ma liste'));
        await held;
        steps.push('first ended');
      });
      const second = unitOfWork.run(async (repos) => {
        steps.push('second started');
        return repos.lists.all();
      });
      await new Promise(setImmediate);

      expect(steps).toEqual(['first started']);

      release();
      await first;

      expect(await second).toEqual([list('l-1', 'Ma liste')]);
      expect(steps).toEqual(['first started', 'first ended', 'second started']);
    });

    it('runs the next run when the one before it throws', async () => {
      const failure = new Error('failed midway');

      const first = unitOfWork.run(async () => {
        throw failure;
      });
      const second = unitOfWork.run(async () => 'second');

      await expect(first).rejects.toBe(failure);
      expect(await second).toBe('second');
    });

    it('rejects the use of the repositories given to a run once it has ended', async () => {
      let kept: Repositories | undefined;
      await unitOfWork.run(async (repos) => {
        kept = repos;
      });

      await expect(kept?.lists.add(list('l-1', 'Ma liste'))).rejects.toThrow();
      await unitOfWork.run(async (repos) => {
        expect(await repos.lists.all()).toEqual([]);
      });
    });
  });
};
