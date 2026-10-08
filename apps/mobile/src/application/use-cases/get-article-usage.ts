import type {
  ArticleId,
  ArticleNotFound,
  ArticleUsage,
} from '../../domain/article';
import { compareNames } from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * The article and the lists holding it, sorted by name, so the delete dialog can say where it
 * will be removed from (FR-006, US2-3).
 */
export const createGetArticleUsage =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (articleId: ArticleId): Promise<Result<ArticleUsage, ArticleNotFound>> =>
    unitOfWork.run(async (repos) => {
      const article = await repos.articles.findById(articleId);
      if (!article) return err({ type: 'ArticleNotFound' });
      const items = await repos.items.forArticle(articleId);
      const lists = (await repos.lists.all())
        .filter((list) => items.some((item) => item.listId === list.id))
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => compareNames(a.name, b.name));
      return ok({ article: { id: article.id, name: article.name }, lists });
    });
