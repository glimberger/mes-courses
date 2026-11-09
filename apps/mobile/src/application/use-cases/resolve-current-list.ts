import {
  pickCurrentList,
  type ListId,
  type ShoppingList,
} from '../../domain/shopping-list';
import type { IdGenerator } from '../ports/id-generator';
import type { Repositories } from '../ports/unit-of-work';

/**
 * Removes the list `removing` and its items while always keeping a valid current list, in the
 * caller's transaction (FR-006, FR-007, FR-010, 012 research R4). `app_state.current_list_id`
 * must refer to a stored list, so the current list moves before the rows go:
 *
 * - a list that is not current is just removed;
 * - otherwise the first remaining local list by name becomes current first;
 * - with no local list left, a live `incoming` list (pulled, not stored yet) counts as remaining:
 *   no default list is created and its id is returned, for the caller to make current once the
 *   pull has stored it;
 * - with none at all, a list named `firstListName` (from the UI adapter, Principle X) replaces
 *   it, recorded as a normal change and made current. The current list is cleared while the old
 *   list goes, since the new one may take its name.
 *
 * Records nothing about the removal itself: the caller does when the deletion is local.
 *
 * @returns the incoming list to make current once stored, or null when the current list is set.
 */
export const resolveCurrentList = async (
  repos: Repositories,
  ids: IdGenerator,
  {
    removing,
    incoming = [],
    firstListName,
  }: {
    removing: ListId;
    incoming?: readonly ShoppingList[];
    firstListName: string;
  },
): Promise<ListId | null> => {
  const remove = async () => {
    await repos.items.removeAllForList(removing);
    await repos.lists.remove(removing);
  };

  if (!(await repos.lists.findById(removing))) return null;
  if ((await repos.appState.currentListId()) !== removing) {
    await remove();
    return null;
  }

  const local = pickCurrentList(
    (await repos.lists.all()).filter((l) => l.id !== removing),
  );
  if (local) {
    await repos.appState.setCurrentListId(local.id);
    await remove();
    return null;
  }

  await repos.appState.clearCurrentList();
  await remove();

  const pulled = pickCurrentList(incoming.filter((l) => l.id !== removing));
  if (pulled) return pulled.id;

  const listId = ids.next() as ListId;
  await repos.lists.add({ id: listId, name: firstListName });
  await repos.changes.record('list', listId, { name: firstListName });
  await repos.appState.setCurrentListId(listId);
  return null;
};
