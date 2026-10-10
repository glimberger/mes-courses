import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import type { ListItem } from '../../domain/list-item';
import { ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createFinishShopping } from './finish-shopping';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const lait = 'a-1' as ArticleId;
const pommes = 'a-2' as ArticleId;
const farine = 'a-3' as ArticleId;

const item = (
  listId: ListId,
  articleId: ArticleId,
  inCart: boolean,
  quantity: ListItem['quantity'] = null,
): ListItem => ({ listId, articleId, inCart, quantity });

describe('finishShopping', () => {
  let unitOfWork: UnitOfWork;
  const itemsOf = (listId: ListId) =>
    unitOfWork.run((repos) => repos.items.forList(listId));

  const store = (items: ListItem[]) =>
    unitOfWork.run(async (repos) => {
      for (const listItem of items) await repos.items.save(listItem);
    });

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    await unitOfWork.run(async (repos) => {
      const category = 'c-1' as CategoryId;
      await repos.categories.add({ id: category, name: 'Divers', position: 0 });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: category,
      });
      await repos.articles.add({
        id: pommes,
        name: 'Pommes',
        categoryId: category,
      });
      await repos.articles.add({
        id: farine,
        name: 'Farine',
        categoryId: category,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US1-8 takes every item of the list out of the cart, keeping the items and their quantities', async () => {
    await store([
      item(maListe, lait, true, { amount: 2, unit: 'L' }),
      item(maListe, pommes, false),
      item(maListe, farine, true, { amount: 1.5, unit: 'kg' }),
    ]);

    const outcome = await createFinishShopping({ unitOfWork })(maListe);

    expect(outcome).toEqual(ok(undefined));
    expect(await itemsOf(maListe)).toEqual([
      item(maListe, lait, false, { amount: 2, unit: 'L' }),
      item(maListe, pommes, false),
      item(maListe, farine, false, { amount: 1.5, unit: 'kg' }),
    ]);
  });

  it('FR-007 succeeds and changes nothing when nothing is in the cart', async () => {
    const items = [item(maListe, lait, false), item(maListe, pommes, false)];
    await store(items);

    const outcome = await createFinishShopping({ unitOfWork })(maListe);

    expect(outcome).toEqual(ok(undefined));
    expect(await itemsOf(maListe)).toEqual(items);
  });

  it('leaves the items of the other lists in the cart', async () => {
    await store([item(maListe, lait, true), item(barbecue, lait, true)]);

    await createFinishShopping({ unitOfWork })(maListe);

    expect(await itemsOf(barbecue)).toEqual([item(barbecue, lait, true)]);
  });

  describe('recorded changes (US1, FR-013)', () => {
    const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));

    it('records inCart = false for each item ticked at that moment, and only those', async () => {
      await store([
        item(maListe, lait, true),
        item(maListe, pommes, false),
        item(maListe, farine, true),
        item(barbecue, lait, true),
      ]);

      await createFinishShopping({ unitOfWork })(maListe);

      const changes = await pending();
      expect(
        changes.map(({ kind, id, fields }) => ({ kind, id, fields })),
      ).toEqual([
        { kind: 'listItem', id: 'l-1:a-1', fields: { inCart: false } },
        { kind: 'listItem', id: 'l-1:a-3', fields: { inCart: false } },
      ]);
    });

    it('records nothing when nothing is ticked', async () => {
      await store([item(maListe, lait, false)]);

      await createFinishShopping({ unitOfWork })(maListe);

      expect(await pending()).toEqual([]);
    });
  });
});
