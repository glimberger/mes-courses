import {
  buildCurrentListView,
  type CurrentListView,
} from '../../domain/current-list-view';
import type { UnitOfWork } from '../ports/unit-of-work';

/** The current list as the screen shows it (FR-001, FR-003, FR-005, FR-006). */
export const createGetCurrentList =
  ({ unitOfWork }: { unitOfWork: UnitOfWork }) =>
  (): Promise<CurrentListView> =>
    unitOfWork.run(async (repos) => {
      const listId = await repos.appState.currentListId();
      const list = listId && (await repos.lists.findById(listId));
      if (!list) throw new Error('No current list');
      return buildCurrentListView({
        list,
        categories: await repos.categories.all(),
        articles: await repos.articles.all(),
        items: await repos.items.forList(list.id),
      });
    });
