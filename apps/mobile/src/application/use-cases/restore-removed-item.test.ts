import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import type { RemovedItem } from '../../domain/list-item';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createRemoveItemFromList } from './remove-item-from-list';
import { createRestoreRemovedItem } from './restore-removed-item';

const maListe = 'l-1' as ListId;
const cremerie = 'c-1' as CategoryId;
const beurre = 'a-1' as ArticleId;

const removedBeurre: Omit<RemovedItem, 'undoId'> = {
  listId: maListe,
  articleId: beurre,
  inCart: true,
  quantity: { amount: 2, unit: 'kg' },
};

describe('restoreRemovedItem', () => {
  let unitOfWork: UnitOfWork;
  const stored = () =>
    unitOfWork.run((repos) => repos.items.find(maListe, beurre));

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
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.items.save(removedBeurre);
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US2-16 puts the removed item back, ticked, with "2 kg"', async () => {
    const removed = await createRemoveItemFromList({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    })(maListe, beurre);
    if (!removed.ok) throw new Error('not removed');

    const outcome = await createRestoreRemovedItem({ unitOfWork })(
      removed.value,
    );

    expect(outcome).toEqual(ok(undefined));
    expect(await stored()).toEqual(removedBeurre);
  });

  it('returns AlreadyOnList when the list holds the article again, and changes nothing', async () => {
    await unitOfWork.run((repos) =>
      repos.items.save({ ...removedBeurre, inCart: false, quantity: null }),
    );

    const outcome = await createRestoreRemovedItem({ unitOfWork })({
      ...removedBeurre,
      undoId: 'undo-1',
    });

    expect(outcome).toEqual(err({ type: 'AlreadyOnList', quantity: null }));
    expect(await stored()).toEqual({
      ...removedBeurre,
      inCart: false,
      quantity: null,
    });
  });

  it('returns ListNotFound when the list is gone', async () => {
    const outcome = await createRestoreRemovedItem({ unitOfWork })({
      ...removedBeurre,
      undoId: 'undo-1',
      listId: 'l-gone' as ListId,
    });

    expect(outcome).toEqual(err({ type: 'ListNotFound' }));
  });

  it('returns ArticleNotFound when the article is gone', async () => {
    await unitOfWork.run((repos) => repos.items.remove(maListe, beurre));

    const outcome = await createRestoreRemovedItem({ unitOfWork })({
      ...removedBeurre,
      undoId: 'undo-1',
      articleId: 'a-gone' as ArticleId,
    });

    expect(outcome).toEqual(err({ type: 'ArticleNotFound' }));
  });

  describe('recorded changes (US1)', () => {
    const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));
    const count = () => unitOfWork.run((repos) => repos.changes.count());

    it('discards the held removal, so the server never sees it, and records nothing', async () => {
      const removed = await createRemoveItemFromList({
        unitOfWork,
        ids: new SequentialIdGenerator(),
      })(maListe, beurre);
      if (!removed.ok) throw new Error('not removed');

      await createRestoreRemovedItem({ unitOfWork })(removed.value);
      await unitOfWork.run((repos) =>
        repos.changes.release(removed.value.undoId),
      );

      expect(await pending()).toEqual([]);
      expect(await count()).toBe(0);
    });

    it('leaves the held removal alone when nothing is restored', async () => {
      await createRestoreRemovedItem({ unitOfWork })({
        ...removedBeurre,
        undoId: 'undo-9',
        listId: 'l-gone' as ListId,
      });

      expect(await pending()).toEqual([]);
    });
  });
});
