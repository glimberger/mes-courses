import type {
  ArticleId,
  ArticleNotFound,
  DeletedArticle,
} from '../../domain/article';
import { err, ok, type Result } from '../../domain/result';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * Deletes the article from the catalog and from every list in one transaction, and returns it
 * as it was so "Annuler" can bring it back (FR-005, FR-009, research R4).
 */
export const createDeleteArticle =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (articleId: ArticleId): Promise<Result<DeletedArticle, ArticleNotFound>> =>
    unitOfWork.run(async (repos) => {
      const article = await repos.articles.findById(articleId);
      if (!article) return err({ type: 'ArticleNotFound' });
      const items = await repos.items.forArticle(articleId);
      await repos.items.removeAllForArticle(articleId);
      await repos.articles.remove(articleId);
      return ok({
        article,
        items: items.map(({ listId, inCart, quantity }) => ({
          listId,
          inCart,
          quantity,
        })),
      });
    });
