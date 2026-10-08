import type { NameAlreadyUsed, NameError } from '../../../domain/name';
import type { Result } from '../../../domain/result';
import type { ListId, ShoppingList } from '../../../domain/shopping-list';
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
  /** Makes the list current; the refresh then shows it in the current list region (US3-3). */
  setCurrentList: (listId: ListId) => Promise<Result<void, WriteFailed>>;
};

export const createListsActions = ({
  useCases,
  runWrite,
  region,
}: StoreKit): ListsActions => ({
  loadLists: region('lists', 'getLists', async () => ({
    status: 'success',
    data: await useCases.getLists(),
  })),
  createList: (name) => runWrite('createList', () => useCases.createList(name)),
  setCurrentList: (listId) =>
    runWrite('setCurrentList', () => useCases.setCurrentList(listId)),
});
