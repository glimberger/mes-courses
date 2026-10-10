import type { ArticleId } from '../../domain/article';
import { changeQuantity, type ItemNotOnList } from '../../domain/list-item';
import type { Quantity } from '../../domain/quantity';
import { err, ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/** Sets or clears the quantity of this list item only (FR-015, US2-3, US2-4, US2-5). */
export const createChangeItemQuantity =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (
    listId: ListId,
    articleId: ArticleId,
    quantity: Quantity | null,
  ): Promise<Result<void, ItemNotOnList>> =>
    unitOfWork.run(async (repos) => {
      const item = await repos.items.find(listId, articleId);
      if (!item) return err({ type: 'ItemNotOnList' });
      const changed = changeQuantity(item, quantity);
      await repos.items.save(changed);
      await repos.changes.record('listItem', `${listId}:${articleId}`, {
        quantity: changed.quantity,
      });
      return ok(undefined);
    });
