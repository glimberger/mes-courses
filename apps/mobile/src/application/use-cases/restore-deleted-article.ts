import type { DeletedArticle } from '../../domain/article';
import { ok, type Result } from '../../domain/result';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * Brings a deleted article back with its id, and puts it back on each list as it was, in one
 * transaction (US2-5, SC-006).
 */
export const createRestoreDeletedArticle =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (deleted: DeletedArticle): Promise<Result<void, never>> =>
    unitOfWork.run(async (repos) => {
      await repos.articles.add(deleted.article);
      for (const item of deleted.items) {
        await repos.items.save({ ...item, articleId: deleted.article.id });
      }
      return ok(undefined);
    });
