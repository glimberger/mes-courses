import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetArticleUsage } from './get-article-usage';

const cremerie = 'c-1' as CategoryId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;

describe('getArticleUsage', () => {
  let unitOfWork: UnitOfWork;
  let getArticleUsage: ReturnType<typeof createGetArticleUsage>;

  const putOn = (listId: string, name: string, articleId: ArticleId) =>
    unitOfWork.run(async (repos) => {
      if (!(await repos.lists.findById(listId as ListId))) {
        await repos.lists.add({ id: listId as ListId, name });
      }
      await repos.items.save({
        listId: listId as ListId,
        articleId,
        inCart: false,
        quantity: null,
      });
    });

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    getArticleUsage = createGetArticleUsage({ unitOfWork });
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
    });
  });

  it('US2-3 FR-006 returns the article and the lists holding it, sorted by name', async () => {
    await putOn('l-1', 'Ma liste', lait);
    await putOn('l-2', 'Barbecue', lait);
    await putOn('l-3', 'Pique-nique', beurre);

    expect(await getArticleUsage(lait)).toEqual(
      ok({
        article: { id: lait, name: 'Lait' },
        lists: [
          { id: 'l-2', name: 'Barbecue' },
          { id: 'l-1', name: 'Ma liste' },
        ],
      }),
    );
  });

  it('US2-3 sorts numbers by value: "Liste 2" comes before "Liste 10"', async () => {
    await putOn('l-1', 'Liste 10', lait);
    await putOn('l-2', 'Liste 2', lait);

    const outcome = await getArticleUsage(lait);

    expect(outcome.ok && outcome.value.lists.map((list) => list.name)).toEqual([
      'Liste 2',
      'Liste 10',
    ]);
  });

  it('US2-1 gives an empty `lists` for an article on no list', async () => {
    expect(await getArticleUsage(beurre)).toEqual(
      ok({ article: { id: beurre, name: 'Beurre' }, lists: [] }),
    );
  });

  it('returns ArticleNotFound for an unknown article', async () => {
    expect(await getArticleUsage('a-unknown' as ArticleId)).toEqual(
      err({ type: 'ArticleNotFound' }),
    );
  });
});
