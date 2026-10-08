import type { ListSummary } from '../../domain/list-summary';
import { compareNames } from '../../domain/name';
import type { UnitOfWork } from '../ports/unit-of-work';

/**
 * Every list sorted by name, numbers by value, each with its item count, ticked or not, and the
 * current mark (US3-8).
 */
export const createGetLists =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (): Promise<ListSummary[]> =>
    unitOfWork.run(async (repos) => {
      const currentListId = await repos.appState.currentListId();
      const counts = await repos.lists.itemCounts();
      return (await repos.lists.all())
        .map(({ id, name }) => ({
          id,
          name,
          itemCount: counts.get(id) ?? 0,
          isCurrent: id === currentListId,
        }))
        .sort((a, b) => compareNames(a.name, b.name));
    });
