import type { IdGenerator } from '../../application/ports/id-generator';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import { createAddArticleToList } from '../../application/use-cases/add-article-to-list';
import { createChangeItemQuantity } from '../../application/use-cases/change-item-quantity';
import { createCreateArticleAndAddToList } from '../../application/use-cases/create-article-and-add-to-list';
import { createFinishShopping } from '../../application/use-cases/finish-shopping';
import { createGetCatalog } from '../../application/use-cases/get-catalog';
import { createGetCategories } from '../../application/use-cases/get-categories';
import { createGetCurrentList } from '../../application/use-cases/get-current-list';
import {
  createInitializeStore,
  type Seed,
} from '../../application/use-cases/initialize-store';
import { createRemoveItemFromList } from '../../application/use-cases/remove-item-from-list';
import { createRestoreRemovedItem } from '../../application/use-cases/restore-removed-item';
import { createToggleItemInCart } from '../../application/use-cases/toggle-item-in-cart';
import type { Article, ArticleId, ArticleNotFound } from '../../domain/article';
import type { CatalogView } from '../../domain/catalog-view';
import type { CategoryId, CategoryNotFound } from '../../domain/category';
import type { CurrentListView } from '../../domain/current-list-view';
import type {
  AlreadyOnList,
  ItemNotOnList,
  RemovedItem,
} from '../../domain/list-item';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import type { Quantity } from '../../domain/quantity';
import type { Result } from '../../domain/result';
import type { ListId, ListNotFound } from '../../domain/shopping-list';

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
  getCatalog: (listId: ListId, query?: string) => Promise<CatalogView>;
  getCategories: () => Promise<{ id: CategoryId; name: string }[]>;
  addArticleToList: (
    listId: ListId,
    articleId: ArticleId,
    quantity: Quantity | null,
  ) => Promise<Result<void, AlreadyOnList | ArticleNotFound>>;
  createArticleAndAddToList: (
    listId: ListId,
    article: { name: string; categoryId: CategoryId },
    quantity: Quantity | null,
  ) => Promise<
    Result<
      { articleId: ArticleId },
      NameError | NameAlreadyUsed<Article> | CategoryNotFound
    >
  >;
  changeItemQuantity: (
    listId: ListId,
    articleId: ArticleId,
    quantity: Quantity | null,
  ) => Promise<Result<void, ItemNotOnList>>;
  removeItemFromList: (
    listId: ListId,
    articleId: ArticleId,
  ) => Promise<Result<RemovedItem, ItemNotOnList>>;
  restoreRemovedItem: (
    removed: RemovedItem,
  ) => Promise<Result<void, AlreadyOnList | ListNotFound | ArticleNotFound>>;
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
  getCatalog: createGetCatalog(ports),
  getCategories: createGetCategories(ports),
  addArticleToList: createAddArticleToList(ports),
  createArticleAndAddToList: createCreateArticleAndAddToList(ports),
  changeItemQuantity: createChangeItemQuantity(ports),
  removeItemFromList: createRemoveItemFromList(ports),
  restoreRemovedItem: createRestoreRemovedItem(ports),
});
