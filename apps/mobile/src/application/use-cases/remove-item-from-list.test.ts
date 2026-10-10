import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createRemoveItemFromList } from './remove-item-from-list';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const cremerie = 'c-1' as CategoryId;
const beurre = 'a-1' as ArticleId;
const lait = 'a-2' as ArticleId;

describe('removeItemFromList', () => {
  let unitOfWork: UnitOfWork;

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 0,
      });
      await repos.articles.add({
        id: beurre,
        name: 'Beurre',
        categoryId: cremerie,
      });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: cremerie,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      for (const listId of [maListe, barbecue]) {
        await repos.items.save({
          listId,
          articleId: beurre,
          inCart: true,
          quantity: { amount: 2, unit: 'kg' },
        });
      }
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US2-6 FR-010 removes the item, keeps the article in the catalog, and returns the item as it was', async () => {
    const outcome = await createRemoveItemFromList({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    })(maListe, beurre);

    expect(outcome).toEqual(
      ok({
        listId: maListe,
        articleId: beurre,
        inCart: true,
        quantity: { amount: 2, unit: 'kg' },
        undoId: expect.any(String),
      }),
    );
    expect(
      await unitOfWork.run((repos) => repos.items.forList(maListe)),
    ).toEqual([]);
    expect(
      await unitOfWork.run((repos) => repos.articles.findById(beurre)),
    ).not.toBeNull();
    expect(
      await unitOfWork.run((repos) => repos.items.find(barbecue, beurre)),
    ).not.toBeNull();
  });

  it('returns ItemNotOnList for an article not on the list', async () => {
    const outcome = await createRemoveItemFromList({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    })(maListe, lait);

    expect(outcome).toEqual(err({ type: 'ItemNotOnList' }));
  });

  describe('recorded changes (US1)', () => {
    const entries = (limit = 100) =>
      unitOfWork.run((repos) => repos.changes.pending(limit));

    it('records listItem.present = false held by a new undoId returned in RemovedItem', async () => {
      const outcome = await createRemoveItemFromList({
        unitOfWork,
        ids: new SequentialIdGenerator(),
      })(maListe, beurre);
      if (!outcome.ok) throw new Error('not removed');

      expect(outcome.value.undoId).toEqual(expect.any(String));
      expect(await entries()).toEqual([]);

      await unitOfWork.run((repos) =>
        repos.changes.release(outcome.value.undoId),
      );
      expect(
        (await entries()).map(({ kind, id, fields }) => ({ kind, id, fields })),
      ).toEqual([
        { kind: 'listItem', id: 'l-1:a-1', fields: { present: false } },
      ]);
    });

    it('gives each removal its own undoId', async () => {
      const remove = createRemoveItemFromList({
        unitOfWork,
        ids: new SequentialIdGenerator(),
      });
      const first = await remove(maListe, beurre);
      const second = await remove(barbecue, beurre);
      if (!first.ok || !second.ok) throw new Error('not removed');

      expect(first.value.undoId).not.toBe(second.value.undoId);
    });

    it('records nothing when the item is not on the list', async () => {
      await createRemoveItemFromList({
        unitOfWork,
        ids: new SequentialIdGenerator(),
      })(maListe, 'a-gone' as ArticleId);
      await unitOfWork.run((repos) => repos.changes.releaseAll());

      expect(await entries()).toEqual([]);
    });
  });
});
