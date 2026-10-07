import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createChangeItemQuantity } from './change-item-quantity';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const cremerie = 'c-1' as CategoryId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;

describe('changeItemQuantity', () => {
  let unitOfWork: UnitOfWork;
  const stored = (listId: ListId, articleId: ArticleId) =>
    unitOfWork.run((repos) => repos.items.find(listId, articleId));

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
      await repos.articles.add({
        id: beurre,
        name: 'Beurre',
        categoryId: cremerie,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      for (const listId of [maListe, barbecue]) {
        await repos.items.save({
          listId,
          articleId: lait,
          inCart: true,
          quantity: { amount: 1, unit: 'L' },
        });
      }
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US2-3 FR-015 changes the quantity of this list item only, keeping its tick and the article', async () => {
    const outcome = await createChangeItemQuantity({ unitOfWork })(
      maListe,
      lait,
      { amount: 2, unit: 'L' },
    );

    expect(outcome).toEqual(ok(undefined));
    expect(await stored(maListe, lait)).toEqual({
      listId: maListe,
      articleId: lait,
      inCart: true,
      quantity: { amount: 2, unit: 'L' },
    });
    expect((await stored(barbecue, lait))?.quantity).toEqual({
      amount: 1,
      unit: 'L',
    });
    expect(
      await unitOfWork.run((repos) => repos.articles.findById(lait)),
    ).toEqual({ id: lait, name: 'Lait', categoryId: cremerie });
  });

  it('US2-4 FR-015 clears the quantity', async () => {
    await createChangeItemQuantity({ unitOfWork })(maListe, lait, null);

    expect((await stored(maListe, lait))?.quantity).toBeNull();
    expect((await stored(maListe, lait))?.inCart).toBe(true);
  });

  it('returns ItemNotOnList for an article not on the list, and saves nothing', async () => {
    const outcome = await createChangeItemQuantity({ unitOfWork })(
      maListe,
      beurre,
      { amount: 1, unit: null },
    );

    expect(outcome).toEqual(err({ type: 'ItemNotOnList' }));
    expect(await stored(maListe, beurre)).toBeNull();
  });
});
