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
import { createDeleteArticle } from './delete-article';
import { createGetCatalog } from './get-catalog';
import { createGetCurrentList } from './get-current-list';
import { createGetLists } from './get-lists';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const cremerie = 'c-1' as CategoryId;
const boissons = 'c-2' as CategoryId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;
const eau = 'a-3' as ArticleId;

describe('deleteArticle', () => {
  let unitOfWork: UnitOfWork;
  let deleteArticle: ReturnType<typeof createDeleteArticle>;
  const articles = () => unitOfWork.run((repos) => repos.articles.all());
  const itemsOf = (listId: ListId) =>
    unitOfWork.run((repos) => repos.items.forList(listId));
  const catalog = (listId: ListId, query?: string) =>
    createGetCatalog({ unitOfWork })(listId, query);

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    deleteArticle = createDeleteArticle({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    });
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 0,
      });
      await repos.categories.add({
        id: boissons,
        name: 'Boissons',
        position: 1,
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
      await repos.articles.add({ id: eau, name: 'Eau', categoryId: boissons });
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
        articleId: beurre,
        inCart: false,
        quantity: null,
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

  it('US2-1 removes the article from the catalog, its category and the search', async () => {
    await deleteArticle(lait);

    const sections = (await catalog(maListe)).sections;
    const names = sections.flatMap((section) =>
      section.articles.map((article) => article.name),
    );
    expect(names).not.toContain('Lait');
    expect(names).toContain('Beurre');
    expect(
      (await catalog(maListe, 'lait')).sections.flatMap(
        (section) => section.articles,
      ),
    ).toEqual([]);
    expect((await articles()).map((article) => article.id)).not.toContain(lait);
  });

  it('US2-4 removes it from both lists, and the counts drop', async () => {
    const lists = createGetLists({ unitOfWork });
    const counts = async () =>
      (await lists()).map((list) => [list.name, list.itemCount]);
    expect(await counts()).toEqual([
      ['Barbecue', 1],
      ['Ma liste', 2],
    ]);

    await deleteArticle(lait);

    expect(await itemsOf(maListe)).toEqual([
      { listId: maListe, articleId: beurre, inCart: false, quantity: null },
    ]);
    expect(await itemsOf(barbecue)).toEqual([]);
    expect(await counts()).toEqual([
      ['Barbecue', 0],
      ['Ma liste', 1],
    ]);
    // "Lait" was ticked and "Beurre" is not: one article remains to buy.
    expect((await createGetCurrentList({ unitOfWork })()).remainingCount).toBe(
      1,
    );
  });

  it('FR-005 keeps the category and the lists', async () => {
    await deleteArticle(lait);

    expect(
      await unitOfWork.run((repos) => repos.categories.findById(cremerie)),
    ).not.toBeNull();
    expect(await unitOfWork.run((repos) => repos.lists.all())).toHaveLength(2);
  });

  it('returns the snapshot: the article and each list item as it was', async () => {
    const outcome = await deleteArticle(lait);

    expect(outcome).toEqual(
      ok({
        undoId: expect.any(String),
        article: { id: lait, name: 'Lait', categoryId: cremerie },
        items: expect.arrayContaining([
          { listId: maListe, inCart: true, quantity: { amount: 2, unit: 'L' } },
          { listId: barbecue, inCart: false, quantity: null },
        ]),
      }),
    );
    expect(outcome.ok && outcome.value.items).toHaveLength(2);
  });

  it('deletes an article on no list, with an empty snapshot of items', async () => {
    expect(await deleteArticle(eau)).toEqual(
      ok({
        undoId: expect.any(String),
        article: { id: eau, name: 'Eau', categoryId: boissons },
        items: [],
      }),
    );
  });

  it('US2-8 deleting the last article of a category leaves the category, shown empty', async () => {
    await deleteArticle(eau);

    const section = (await catalog(maListe)).sections.find(
      (candidate) => candidate.category.id === boissons,
    );
    expect(section?.articles).toEqual([]);
  });

  it('returns ArticleNotFound for an unknown article, changing nothing', async () => {
    expect(await deleteArticle('a-unknown' as ArticleId)).toEqual(
      err({ type: 'ArticleNotFound' }),
    );
    expect(await articles()).toHaveLength(3);
  });

  it('SC-005 a failure midway leaves the article and every item as they were', async () => {
    const failing: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repos) =>
          work({
            ...repos,
            articles: {
              ...repos.articles,
              remove: () => Promise.reject(new Error('disk failed')),
            },
          }),
        ),
    };

    await expect(
      createDeleteArticle({
        unitOfWork: failing,
        ids: new SequentialIdGenerator(),
      })(lait),
    ).rejects.toThrow('disk failed');

    expect(await articles()).toHaveLength(3);
    expect(await itemsOf(maListe)).toHaveLength(2);
    expect(await itemsOf(barbecue)).toHaveLength(1);
  });

  describe('recorded changes (US1)', () => {
    const entries = () => unitOfWork.run((repos) => repos.changes.pending(100));

    it('records article.deleted = true held by a new undoId returned in DeletedArticle', async () => {
      const outcome = await deleteArticle(lait);
      if (!outcome.ok) throw new Error('not deleted');

      expect(outcome.value.undoId).toEqual(expect.any(String));
      expect(await entries()).toEqual([]);

      await unitOfWork.run((repos) =>
        repos.changes.release(outcome.value.undoId),
      );
      expect(
        (await entries()).map(({ kind, id, fields }) => ({ kind, id, fields })),
      ).toEqual([{ kind: 'article', id: lait, fields: { deleted: true } }]);
    });

    it('records nothing when the article is not found', async () => {
      await deleteArticle('a-gone' as ArticleId);
      await unitOfWork.run((repos) => repos.changes.releaseAll());

      expect(await entries()).toEqual([]);
    });
  });
});
