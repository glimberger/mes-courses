import { err, ok, type Result } from '../../domain/result';
import type { ListId, ListNotFound } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';

/** Makes the list current; the choice is stored, so it is kept for the next opening (FR-025). */
export const createSetCurrentList =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (listId: ListId): Promise<Result<void, ListNotFound>> =>
    unitOfWork.run(async (repos) => {
      if (!(await repos.lists.findById(listId))) {
        return err({ type: 'ListNotFound' });
      }
      await repos.appState.setCurrentListId(listId);
      return ok(undefined);
    });
