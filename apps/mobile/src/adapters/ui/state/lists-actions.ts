import type { NameAlreadyUsed, NameError } from '../../../domain/name';
import type { Result } from '../../../domain/result';
import type {
  ListId,
  ListNotFound,
  ShoppingList,
} from '../../../domain/shopping-list';
import { seed } from '../seed';
import type { StoreKit, WriteFailed } from './store-kit';

/** The actions of the lists screen (User Story 3). */
export type ListsActions = {
  /** Loads every list with its item count; also used by "Réessayer" (US3-7, US3-8). */
  loadLists: () => Promise<void>;
  /** Creates an empty list, not current (US3-2, FR-024). */
  createList: (
    name: string,
  ) => Promise<
    Result<
      { listId: ListId },
      NameError | NameAlreadyUsed<ShoppingList> | WriteFailed
    >
  >;
  /**
   * Renames the list; the lists region then shows it in its alphabetical place (US1-1). A list
   * already gone, deleted just before, is `ListNotFound`: not reported.
   */
  renameList: (
    listId: ListId,
    name: string,
  ) => Promise<
    Result<
      void,
      NameError | NameAlreadyUsed<ShoppingList> | ListNotFound | WriteFailed
    >
  >;
  /**
   * Deletes the list and its items, with no undo offer; the refresh then shows the lists and the
   * current list, which may have moved (US2-3 to US2-6). A list already gone is `ListNotFound`:
   * not reported.
   */
  deleteList: (
    listId: ListId,
  ) => Promise<Result<void, ListNotFound | WriteFailed>>;
  /** Makes the list current; the refresh then shows it in the current list region (US3-3). */
  setCurrentList: (listId: ListId) => Promise<Result<void, WriteFailed>>;
};

export const createListsActions = ({
  useCases,
  runWrite,
  region,
  follow,
}: StoreKit): ListsActions => ({
  loadLists: region('lists', 'getLists', async () => ({
    status: 'success',
    data: await useCases.getLists(),
  })),
  createList: (name) => runWrite('createList', () => useCases.createList(name)),
  renameList: (listId, name) =>
    runWrite('renameList', () => useCases.renameList(follow(listId), name), {
      expected: ['ListNotFound'],
    }),
  deleteList: (listId) =>
    runWrite(
      'deleteList',
      () => useCases.deleteList(follow(listId), seed.firstListName),
      { expected: ['ListNotFound'] },
    ),
  setCurrentList: (listId) =>
    runWrite('setCurrentList', () => useCases.setCurrentList(follow(listId))),
});
