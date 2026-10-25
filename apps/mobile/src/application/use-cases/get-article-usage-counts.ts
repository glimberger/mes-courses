import type { ArticleId } from '../../domain/article';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * The number of lists holding each article, for the badges of the Articles tab, in one unit of
 * work rather than one read per article. An article on no list has no entry (count 0).
 */
export const createGetArticleUsageCounts =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (): Promise<Map<ArticleId, number>> =>
    unitOfWork.run((repos) => repos.items.countsByArticle());
