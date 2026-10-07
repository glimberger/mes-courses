import type { CategoryId } from '../../domain/category';
import type { ListId } from '../../domain/shopping-list';
import type { IdGenerator } from '../ports/id-generator';
import type { UnitOfWork } from '../ports/unit-of-work';

/** The first launch's content; its French names come from the UI adapter (Principle X). */
export type Seed = {
  categoryNames: readonly string[];
  firstListName: string;
};

/**
 * On a store with no list, creates the categories in the given order when it has none, then the
 * first list, and makes it current, all in one transaction; otherwise does nothing (FR-020,
 * FR-023, R18). Categories already there are kept, so a store holding categories and no list
 * still starts.
 */
export const createInitializeStore =
  ({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) =>
  (seed: Seed): Promise<void> =>
    unitOfWork.run(async (repos) => {
      if ((await repos.lists.count()) > 0) return;

      if ((await repos.categories.nextPosition()) === 0) {
        for (const [position, name] of seed.categoryNames.entries()) {
          await repos.categories.add({
            id: ids.next() as CategoryId,
            name,
            position,
          });
        }
      }
      const listId = ids.next() as ListId;
      await repos.lists.add({ id: listId, name: seed.firstListName });
      await repos.appState.setCurrentListId(listId);
    });
