import type { IdGenerator } from '../../application/ports/id-generator';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import { createFinishShopping } from '../../application/use-cases/finish-shopping';
import { createGetCurrentList } from '../../application/use-cases/get-current-list';
import {
  createInitializeStore,
  type Seed,
} from '../../application/use-cases/initialize-store';
import { createToggleItemInCart } from '../../application/use-cases/toggle-item-in-cart';
import type { ArticleId } from '../../domain/article';
import type { CurrentListView } from '../../domain/current-list-view';
import type { ItemNotOnList } from '../../domain/list-item';
import type { Result } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';

/**
 * The use cases the store calls, one entry per use case of the driving ports, added story by
 * story (contracts/driving-ports.md).
 */
export type UseCases = {
  initializeStore: (seed: Seed) => Promise<void>;
  getCurrentList: () => Promise<CurrentListView>;
  toggleItemInCart: (
    listId: ListId,
    articleId: ArticleId,
  ) => Promise<Result<{ inCart: boolean }, ItemNotOnList>>;
  finishShopping: (listId: ListId) => Promise<Result<void, never>>;
};

/** The name of one use case. */
export type UseCaseName = keyof UseCases;

/**
 * Builds every use case on the given ports: the composition root gives it the SQLite adapters,
 * the stories and screen tests the in-memory fakes.
 */
export const createUseCases = (ports: {
  unitOfWork: UnitOfWork;
  ids: IdGenerator;
}): UseCases => ({
  initializeStore: createInitializeStore(ports),
  getCurrentList: createGetCurrentList(ports),
  toggleItemInCart: createToggleItemInCart(ports),
  finishShopping: createFinishShopping(ports),
});
