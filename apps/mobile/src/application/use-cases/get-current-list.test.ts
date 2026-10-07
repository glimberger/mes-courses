import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetCurrentList } from './get-current-list';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const fruits = 'c-1' as CategoryId;
const cremerie = 'c-2' as CategoryId;
const lait = 'a-1' as ArticleId;
const pommes = 'a-2' as ArticleId;
const beurre = 'a-3' as ArticleId;

describe('getCurrentList', () => {
  let unitOfWork: UnitOfWork;

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: fruits,
        name: 'Fruits et légumes',
        position: 0,
      });
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 1,
      });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: cremerie,
      });
      await repos.articles.add({
        id: pommes,
        name: 'Pommes',
        categoryId: fruits,
      });
      await repos.articles.add({
        id: beurre,
        name: 'Beurre',
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
        listId: maListe,
        articleId: pommes,
        inCart: false,
        quantity: null,
      });
      await repos.items.save({
        listId: barbecue,
        articleId: beurre,
        inCart: false,
        quantity: null,
      });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US1-1 returns the view of the current list, its items grouped by category with their quantities', async () => {
    const view = await createGetCurrentList({ unitOfWork })();

    expect(view).toEqual({
      list: { id: maListe, name: 'Ma liste' },
      remainingCount: 1,
      totalCount: 2,
      hasItemsInCart: true,
      sections: [
        {
          category: { id: fruits, name: 'Fruits et légumes' },
          items: [
            {
              articleId: pommes,
              name: 'Pommes',
              inCart: false,
              quantity: null,
            },
          ],
        },
        {
          category: { id: cremerie, name: 'Crèmerie' },
          items: [
            {
              articleId: lait,
              name: 'Lait',
              inCart: true,
              quantity: { amount: 2, unit: 'L' },
            },
          ],
        },
      ],
    });
  });

  it('FR-001 shows the list that is current, not another one', async () => {
    await unitOfWork.run((repos) => repos.appState.setCurrentListId(barbecue));

    const view = await createGetCurrentList({ unitOfWork })();

    expect(view.list).toEqual({ id: barbecue, name: 'Barbecue' });
    expect(view.sections.flatMap((s) => s.items.map((i) => i.name))).toEqual([
      'Beurre',
    ]);
  });
});
