import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createGetArticleUsageCounts } from './get-article-usage-counts';

const cremerie = 'c-1' as CategoryId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;
const oeufs = 'a-3' as ArticleId;

describe('getArticleUsageCounts', () => {
  let unitOfWork: UnitOfWork;
  let getArticleUsageCounts: ReturnType<typeof createGetArticleUsageCounts>;

  const putOn = (listId: string, articleId: ArticleId) =>
    unitOfWork.run(async (repos) => {
      if (!(await repos.lists.findById(listId as ListId))) {
        await repos.lists.add({ id: listId as ListId, name: listId });
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
    getArticleUsageCounts = createGetArticleUsageCounts({ unitOfWork });
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 0,
      });
      for (const [id, name] of [
        [lait, 'Lait'],
        [beurre, 'Beurre'],
        [oeufs, 'Œufs'],
      ] as const) {
        await repos.articles.add({ id, name, categoryId: cremerie });
      }
    });
  });

  it('US5 AC2 counts the lists holding each article, in one read', async () => {
    await putOn('l-1', lait);
    await putOn('l-2', lait);
    await putOn('l-3', lait);
    await putOn('l-1', beurre);

    const counts = await getArticleUsageCounts();

    expect(counts.get(lait)).toBe(3);
    expect(counts.get(beurre)).toBe(1);
  });

  it('US5 AC2 gives 0 to an article on no list', async () => {
    await putOn('l-1', lait);

    const counts = await getArticleUsageCounts();

    expect(counts.get(oeufs) ?? 0).toBe(0);
  });

  it('US5 AC2 reads everything in a single unit of work', async () => {
    await putOn('l-1', lait);
    const run = jest.fn(unitOfWork.run.bind(unitOfWork)) as UnitOfWork['run'];

    await createGetArticleUsageCounts({ unitOfWork: { run } })();

    expect(run).toHaveBeenCalledTimes(1);
  });
});
