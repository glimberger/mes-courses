import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetLists } from './get-lists';

const liste10 = 'l-1' as ListId;
const maListe = 'l-2' as ListId;
const liste2 = 'l-3' as ListId;
const barbecue = 'l-4' as ListId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;

describe('getLists', () => {
  let unitOfWork: UnitOfWork;

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      const cremerie = 'c-1' as CategoryId;
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
      await repos.articles.add({
        id: beurre,
        name: 'Beurre',
        categoryId: cremerie,
      });
      await repos.lists.add({ id: liste10, name: 'Liste 10' });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: liste2, name: 'Liste 2' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      await repos.items.save({
        listId: maListe,
        articleId: lait,
        inCart: false,
        quantity: null,
      });
      await repos.items.save({
        listId: maListe,
        articleId: beurre,
        inCart: true,
        quantity: { amount: 2, unit: 'kg' },
      });
      await repos.items.save({
        listId: liste2,
        articleId: lait,
        inCart: true,
        quantity: null,
      });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US3-8 returns every list sorted by name, numbers by value, each with its item count and current mark', async () => {
    expect(await createGetLists({ unitOfWork })()).toEqual([
      { id: barbecue, name: 'Barbecue', itemCount: 0, isCurrent: false },
      { id: liste2, name: 'Liste 2', itemCount: 1, isCurrent: false },
      { id: liste10, name: 'Liste 10', itemCount: 0, isCurrent: false },
      { id: maListe, name: 'Ma liste', itemCount: 2, isCurrent: true },
    ]);
  });

  it('US3-8 counts ticked and unticked items alike', async () => {
    const lists = await createGetLists({ unitOfWork })();

    expect(lists.find((list) => list.id === maListe)?.itemCount).toBe(2);
    expect(lists.find((list) => list.id === liste2)?.itemCount).toBe(1);
  });
});
