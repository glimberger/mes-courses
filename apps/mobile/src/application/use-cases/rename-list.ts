import type { NameAlreadyUsed, NameError } from '../../domain/name';
import { err, ok, type Result } from '../../domain/result';
import type {
  ListId,
  ListNotFound,
  ShoppingList,
} from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import { uniqueName } from './unique-name';

/**
 * Renames the list, its name cleaned and unique among the other lists; a list keeps its own name
 * (FR-003). The id, the items and the current status stay. Only a name that differs from the
 * stored one is recorded; on any error nothing changes.
 */
export const createRenameList =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (
    listId: ListId,
    name: string,
  ): Promise<
    Result<void, NameError | NameAlreadyUsed<ShoppingList> | ListNotFound>
  > =>
    unitOfWork.run(async (repos) => {
      const list = await repos.lists.findById(listId);
      if (!list) return err({ type: 'ListNotFound' });

      const unique = await uniqueName(
        repos.lists,
        name,
        (existing) => existing.id === listId,
      );
      if (!unique.ok) return unique;

      if (unique.value !== list.name) {
        await repos.lists.rename(listId, unique.value);
        await repos.changes.record('list', listId, { name: unique.value });
      }
      return ok(undefined);
    });
