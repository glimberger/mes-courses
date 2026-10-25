import type { ArticleId } from '../../domain/article';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * The number of lists holding each article, for the badges of the Articles tab, in one unit of
 * work rather than one read per article. An article on no list has no entry (count 0).
 */
export const createGetArticleUsageCounts =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (): Promise<Map<ArticleId, number>> =>
    unitOfWork.run(async (repos) => {
      const counts = new Map<ArticleId, number>();
      for (const list of await repos.lists.all()) {
        for (const item of await repos.items.forList(list.id)) {
          counts.set(item.articleId, (counts.get(item.articleId) ?? 0) + 1);
        }
      }
      return counts;
    });
