import type {
  ArticleId,
  ArticleNotFound,
  DeletedArticle,
} from '../../domain/article';
import { err, ok, type Result } from '../../domain/result';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * Deletes the article from the catalog and from every list in one transaction, and returns it
 * as it was so "Annuler" can bring it back (FR-005, FR-009, research R4).
 */
export const createDeleteArticle =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (articleId: ArticleId): Promise<Result<DeletedArticle, ArticleNotFound>> =>
    unitOfWork.run(async (repos) => {
      const article = await repos.articles.findById(articleId);
      if (!article) return err({ type: 'ArticleNotFound' });
      const items = await repos.items.forArticle(articleId);
      await repos.items.removeAllForArticle(articleId);
      await repos.articles.remove(articleId);
      // Held until the undo offer ends; "Annuler" discards it (research R10).
      const undoId = ids.next();
      await repos.changes.record(
        'article',
        articleId,
        { deleted: true },
        { heldBy: undoId },
      );
      return ok({
        undoId,
        article,
        items: items.map(({ listId, inCart, quantity }) => ({
          listId,
          inCart,
          quantity,
        })),
      });
    });
