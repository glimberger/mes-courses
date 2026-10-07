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
      await repos.items.takeAllOutOfCart(listId);
      return ok(undefined);
    });
