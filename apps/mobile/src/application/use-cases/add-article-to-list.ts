import type { ArticleId, ArticleNotFound } from '../../domain/article';
import { add, type AlreadyOnList } from '../../domain/list-item';
import type { Quantity } from '../../domain/quantity';
import { err, ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/** Puts the article on the list, unticked, with the quantity or none (FR-012, US2-1, US2-2). */
export const createAddArticleToList =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (
    listId: ListId,
    articleId: ArticleId,
    quantity: Quantity | null,
  ): Promise<Result<void, AlreadyOnList | ArticleNotFound>> =>
    unitOfWork.run(async (repos) => {
      if (!(await repos.articles.findById(articleId))) {
        return err({ type: 'ArticleNotFound' });
      }
      const added = add(
        await repos.items.find(listId, articleId),
        { listId, articleId },
        quantity,
      );
      if (!added.ok) return added;
      await repos.items.save(added.value);
      return ok(undefined);
    });
