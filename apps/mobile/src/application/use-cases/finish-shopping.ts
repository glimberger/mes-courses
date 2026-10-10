import { ok, type Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * Takes every item of the list out of the cart in one transaction, keeping the items and their
 * quantities; with nothing in the cart it changes nothing and succeeds (FR-007).
 */
export const createFinishShopping =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (listId: ListId): Promise<Result<void, never>> =>
    unitOfWork.run(async (repos) => {
      // Only what is ticked now: a tick made later, on any device, is kept (FR-013).
      const ticked = (await repos.items.forList(listId)).filter(
        (item) => item.inCart,
      );
      await repos.items.takeAllOutOfCart(listId);
      for (const item of ticked) {
        await repos.changes.record('listItem', `${listId}:${item.articleId}`, {
          inCart: false,
        });
      }
      return ok(undefined);
    });
