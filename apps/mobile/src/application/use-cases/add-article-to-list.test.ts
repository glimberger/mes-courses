import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createAddArticleToList } from './add-article-to-list';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const lait = 'a-1' as ArticleId;
const farine = 'a-2' as ArticleId;

describe('addArticleToList', () => {
  let unitOfWork: UnitOfWork;
  const stored = (listId: ListId, articleId: ArticleId) =>
    unitOfWork.run((repos) => repos.items.find(listId, articleId));

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
        id: farine,
        name: 'Farine',
        categoryId: category,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US2-1 FR-008 FR-012 adds the article unticked, with no quantity', async () => {
    const outcome = await createAddArticleToList({ unitOfWork })(
      maListe,
      lait,
      null,
    );

    expect(outcome).toEqual(ok(undefined));
    expect(await stored(maListe, lait)).toEqual({
      listId: maListe,
      articleId: lait,
      inCart: false,
      quantity: null,
    });
  });

  it('US2-2 adds the article with its quantity', async () => {
    await createAddArticleToList({ unitOfWork })(maListe, farine, {
      amount: 1.5,
      unit: 'kg',
    });

    expect((await stored(maListe, farine))?.quantity).toEqual({
      amount: 1.5,
      unit: 'kg',
    });
  });

  it('US2-5 keeps a quantity per list for the same article', async () => {
    const addArticleToList = createAddArticleToList({ unitOfWork });

    await addArticleToList(maListe, lait, { amount: 2, unit: 'L' });
    await addArticleToList(barbecue, lait, { amount: 6, unit: 'L' });

    expect((await stored(maListe, lait))?.quantity).toEqual({
      amount: 2,
      unit: 'L',
    });
    expect((await stored(barbecue, lait))?.quantity).toEqual({
      amount: 6,
      unit: 'L',
    });
  });

  it('FR-011 returns AlreadyOnList with the current quantity, and changes nothing', async () => {
    const addArticleToList = createAddArticleToList({ unitOfWork });
    await addArticleToList(maListe, lait, { amount: 2, unit: 'L' });
    await unitOfWork.run(async (repos) => {
      const item = await repos.items.find(maListe, lait);
      if (item) await repos.items.save({ ...item, inCart: true });
    });

    const outcome = await addArticleToList(maListe, lait, null);

    expect(outcome).toEqual(
      err({ type: 'AlreadyOnList', quantity: { amount: 2, unit: 'L' } }),
    );
    expect(await stored(maListe, lait)).toEqual({
      listId: maListe,
      articleId: lait,
      inCart: true,
      quantity: { amount: 2, unit: 'L' },
    });
  });

  it('returns ArticleNotFound for an unknown article, and saves nothing', async () => {
    const unknown = 'a-unknown' as ArticleId;

    const outcome = await createAddArticleToList({ unitOfWork })(
      maListe,
      unknown,
      null,
    );

    expect(outcome).toEqual(err({ type: 'ArticleNotFound' }));
    expect(
      await unitOfWork.run((repos) => repos.items.forList(maListe)),
    ).toEqual([]);
  });

  describe('recorded changes (US1)', () => {
    const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));

    it('records the whole list item, with its quantity', async () => {
      await createAddArticleToList({ unitOfWork })(maListe, farine, {
        amount: 1.5,
        unit: 'kg',
      });

      expect(
        (await pending()).map(({ kind, id, fields }) => ({ kind, id, fields })),
      ).toEqual([
        {
          kind: 'listItem',
          id: 'l-1:a-2',
          fields: {
            listId: 'l-1',
            articleId: 'a-2',
            present: true,
            inCart: false,
            quantity: { amount: 1.5, unit: 'kg' },
          },
        },
      ]);
    });

    it('records nothing when the article is already on the list or unknown', async () => {
      const addArticleToList = createAddArticleToList({ unitOfWork });
      await addArticleToList(maListe, lait, null);
      const before = await pending();

      await addArticleToList(maListe, lait, null);
      await addArticleToList(maListe, 'a-9' as ArticleId, null);

      expect(await pending()).toEqual(before);
    });
  });
});
