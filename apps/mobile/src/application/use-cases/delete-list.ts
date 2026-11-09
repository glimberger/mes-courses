import { err, ok, type Result } from '../../domain/result';
import type { ListId, ListNotFound } from '../../domain/shopping-list';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';
import { resolveCurrentList } from './resolve-current-list';

/**
 * Deletes the list and its items in one transaction; the articles stay in the catalog (FR-005).
 * Deleting the current list makes the first remaining one current, or a new list named
 * `firstListName` when it was the last (FR-006, FR-007). The deletion is recorded, not held:
 * there is no undo offer (research R2).
 */
export const createDeleteList =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (
    listId: ListId,
    firstListName: string,
  ): Promise<Result<void, ListNotFound>> =>
    unitOfWork.run(async (repos) => {
      if (!(await repos.lists.findById(listId))) {
        return err({ type: 'ListNotFound' });
      }
      await repos.changes.record('list', listId, { deleted: true });
      await resolveCurrentList(repos, ids, {
        removing: listId,
        firstListName,
      });
      return ok(undefined);
    });
