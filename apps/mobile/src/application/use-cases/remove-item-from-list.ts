import type { ArticleId } from '../../domain/article';
import type { ItemNotOnList, RemovedItem } from '../../domain/list-item';
import { err, ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * Takes the item off the list, the article staying in the catalog, and returns the item as it
 * was stored, so "Annuler" can put it back (FR-010, US2-6, research R8).
 */
export const createRemoveItemFromList =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (
    listId: ListId,
    articleId: ArticleId,
  ): Promise<Result<RemovedItem, ItemNotOnList>> =>
    unitOfWork.run(async (repos) => {
      const item = await repos.items.find(listId, articleId);
      if (!item) return err({ type: 'ItemNotOnList' });
      await repos.items.remove(listId, articleId);
      return ok(item);
    });
