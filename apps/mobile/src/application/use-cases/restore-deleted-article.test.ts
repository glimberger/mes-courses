import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createDeleteArticle } from './delete-article';
import { createRestoreDeletedArticle } from './restore-deleted-article';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const cremerie = 'c-1' as CategoryId;
const lait = 'a-1' as ArticleId;

describe('restoreDeletedArticle', () => {
  let unitOfWork: UnitOfWork;
  const articles = () => unitOfWork.run((repos) => repos.articles.all());
  const itemsOf = (listId: ListId) =>
    unitOfWork.run((repos) => repos.items.forList(listId));

  /** Deletes "Lait" and returns what the deletion offered to undo. */
  const deleteLait = async () => {
    const deleted = await createDeleteArticle({ unitOfWork })(lait);
    if (!deleted.ok) throw new Error('not deleted');
    return deleted.value;
  };

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 0,
      });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: cremerie,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      await repos.items.save({
        listId: maListe,
        articleId: lait,
        inCart: true,
        quantity: { amount: 2, unit: 'L' },
      });
      await repos.items.save({
        listId: barbecue,
        articleId: lait,
        inCart: false,
        quantity: null,
      });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US2-5 SC-006 brings the article back with the same id, name and category, and on both lists as they were', async () => {
    const deleted = await deleteLait();
    expect(await articles()).toEqual([]);

    await createRestoreDeletedArticle({ unitOfWork })(deleted);

    expect(await articles()).toEqual([
      { id: lait, name: 'Lait', categoryId: cremerie },
    ]);
    expect(await itemsOf(maListe)).toEqual([
      {
        listId: maListe,
        articleId: lait,
        inCart: true,
        quantity: { amount: 2, unit: 'L' },
      },
    ]);
    expect(await itemsOf(barbecue)).toEqual([
      { listId: barbecue, articleId: lait, inCart: false, quantity: null },
    ]);
  });

  it('runs in one transaction: nothing is kept when restoring an item fails', async () => {
    const deleted = await deleteLait();
    const failing: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repos) =>
          work({
            ...repos,
            items: {
              ...repos.items,
              save: () => Promise.reject(new Error('disk failed')),
            },
          }),
        ),
    };

    await expect(
      createRestoreDeletedArticle({ unitOfWork: failing })(deleted),
    ).rejects.toThrow('disk failed');

    expect(await articles()).toEqual([]);
    expect(await itemsOf(maListe)).toEqual([]);
  });

  it('throws on a storage failure', async () => {
    const deleted = await deleteLait();
    const failing: UnitOfWork = {
      run: () => Promise.reject(new Error('disk failed')),
    };

    await expect(
      createRestoreDeletedArticle({ unitOfWork: failing })(deleted),
    ).rejects.toThrow('disk failed');
  });
});
