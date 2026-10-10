import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createToggleItemInCart } from './toggle-item-in-cart';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;

describe('toggleItemInCart', () => {
  let unitOfWork: UnitOfWork;
  const stored = (listId: ListId, articleId: ArticleId) =>
    unitOfWork.run((repos) => repos.items.find(listId, articleId));

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
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      await repos.items.save({
        listId: maListe,
        articleId: lait,
        inCart: false,
        quantity: { amount: 2, unit: 'L' },
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

  it('US1-2 US1-4 puts the item in the cart and saves it, keeping its quantity', async () => {
    const outcome = await createToggleItemInCart({ unitOfWork })(maListe, lait);

    expect(outcome).toEqual(ok({ inCart: true }));
    expect(await stored(maListe, lait)).toEqual({
      listId: maListe,
      articleId: lait,
      inCart: true,
      quantity: { amount: 2, unit: 'L' },
    });
  });

  it('US1-3 US1-4 takes a ticked item out of the cart and saves it', async () => {
    const toggleItemInCart = createToggleItemInCart({ unitOfWork });
    await toggleItemInCart(maListe, lait);

    const outcome = await toggleItemInCart(maListe, lait);

    expect(outcome).toEqual(ok({ inCart: false }));
    expect((await stored(maListe, lait))?.inCart).toBe(false);
  });

  it('changes only the item of the given list', async () => {
    await unitOfWork.run((repos) =>
      repos.items.save({
        listId: barbecue,
        articleId: lait,
        inCart: false,
        quantity: null,
      }),
    );

    await createToggleItemInCart({ unitOfWork })(maListe, lait);

    expect((await stored(barbecue, lait))?.inCart).toBe(false);
  });

  it('returns ItemNotOnList for an article that is not on the list, and saves nothing', async () => {
    const outcome = await createToggleItemInCart({ unitOfWork })(
      maListe,
      beurre,
    );

    expect(outcome).toEqual(err({ type: 'ItemNotOnList' }));
    expect(await stored(maListe, beurre)).toBeNull();
    expect((await stored(barbecue, beurre))?.inCart).toBe(false);
  });

  describe('recorded changes (US1)', () => {
    const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));

    it('records listItem.inCart with the new value, only on success', async () => {
      const toggleItemInCart = createToggleItemInCart({ unitOfWork });

      await toggleItemInCart(maListe, lait);
      await toggleItemInCart(maListe, lait);
      await toggleItemInCart(maListe, beurre);

      expect(
        (await pending()).map(({ kind, id, fields }) => ({ kind, id, fields })),
      ).toEqual([
        { kind: 'listItem', id: 'l-1:a-1', fields: { inCart: true } },
        { kind: 'listItem', id: 'l-1:a-1', fields: { inCart: false } },
      ]);
    });
  });
});
