import type { Clock } from '../../application/ports/clock';
import type { CredentialStore } from '../../application/ports/credential-store';
import type { IdGenerator } from '../../application/ports/id-generator';
import type { SyncServer } from '../../application/ports/sync-server';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import { createAddArticleToList } from '../../application/use-cases/add-article-to-list';
import { createChangeItemQuantity } from '../../application/use-cases/change-item-quantity';
import { createCreateArticleAndAddToList } from '../../application/use-cases/create-article-and-add-to-list';
import {
  createConnectToServer,
  type ConnectError,
} from '../../application/use-cases/connect-to-server';
import { createCreateCategory } from '../../application/use-cases/create-category';
import { createCreateList } from '../../application/use-cases/create-list';
import { createDeleteArticle } from '../../application/use-cases/delete-article';
import { createEditArticle } from '../../application/use-cases/edit-article';
import { createFinishShopping } from '../../application/use-cases/finish-shopping';
import { createGetArticleUsage } from '../../application/use-cases/get-article-usage';
import { createGetCatalog } from '../../application/use-cases/get-catalog';
import { createGetCategories } from '../../application/use-cases/get-categories';
import { createGetCurrentList } from '../../application/use-cases/get-current-list';
import {
  createGetSyncInfo,
  type SyncInfo,
} from '../../application/use-cases/get-sync-info';
import { createGetLists } from '../../application/use-cases/get-lists';
import {
  createInitializeStore,
  type Seed,
} from '../../application/use-cases/initialize-store';
import { createRemoveItemFromList } from '../../application/use-cases/remove-item-from-list';
import { createReleaseHeldChanges } from '../../application/use-cases/release-held-changes';
import { createRestoreDeletedArticle } from '../../application/use-cases/restore-deleted-article';
import { createRestoreRemovedItem } from '../../application/use-cases/restore-removed-item';
import { createSetCurrentList } from '../../application/use-cases/set-current-list';
import {
  createSynchronize,
  type SyncResult,
} from '../../application/use-cases/synchronize';
import { createToggleItemInCart } from '../../application/use-cases/toggle-item-in-cart';
import type {
  Article,
  ArticleId,
  ArticleNotFound,
  ArticleUsage,
  DeletedArticle,
} from '../../domain/article';
import type { CatalogView } from '../../domain/catalog-view';
import type {
  Category,
  CategoryId,
  CategoryNotFound,
} from '../../domain/category';
import type { CurrentListView } from '../../domain/current-list-view';
import type {
  AlreadyOnList,
  ItemNotOnList,
  RemovedItem,
} from '../../domain/list-item';
import type { NameAlreadyUsed, NameError } from '../../domain/name';
import type { Quantity } from '../../domain/quantity';
import type { Result } from '../../domain/result';
import type { ListSummary } from '../../domain/list-summary';
import type {
  ListId,
  ListNotFound,
  ShoppingList,
} from '../../domain/shopping-list';

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
  editArticle: (
    articleId: ArticleId,
    article: { name: string; categoryId: CategoryId },
  ) => Promise<
    Result<
      void,
      NameError | NameAlreadyUsed<Article> | ArticleNotFound | CategoryNotFound
    >
  >;
  getArticleUsage: (
    articleId: ArticleId,
  ) => Promise<Result<ArticleUsage, ArticleNotFound>>;
  deleteArticle: (
    articleId: ArticleId,
  ) => Promise<Result<DeletedArticle, ArticleNotFound>>;
  restoreDeletedArticle: (
    deleted: DeletedArticle,
  ) => Promise<Result<void, never>>;
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
  getLists: () => Promise<ListSummary[]>;
  createList: (
    name: string,
  ) => Promise<
    Result<{ listId: ListId }, NameError | NameAlreadyUsed<ShoppingList>>
  >;
  setCurrentList: (listId: ListId) => Promise<Result<void, ListNotFound>>;
  createCategory: (
    name: string,
  ) => Promise<
    Result<{ categoryId: CategoryId }, NameError | NameAlreadyUsed<Category>>
  >;
  connectToServer: (
    url: string,
    code: string,
    deviceName: string,
  ) => Promise<Result<void, ConnectError>>;
  synchronize: () => Promise<SyncResult>;
  releaseHeldChanges: (undoId: string) => Promise<void>;
  getSyncInfo: () => Promise<SyncInfo>;
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
  clock: Clock;
  syncServer: SyncServer;
  credentials: CredentialStore;
  /** Accepts `http://` server addresses; development builds only. */
  allowInsecure?: boolean;
}): UseCases => ({
  initializeStore: createInitializeStore(ports),
  getCurrentList: createGetCurrentList(ports),
  toggleItemInCart: createToggleItemInCart(ports),
  finishShopping: createFinishShopping(ports),
  getCatalog: createGetCatalog(ports),
  getCategories: createGetCategories(ports),
  addArticleToList: createAddArticleToList(ports),
  createArticleAndAddToList: createCreateArticleAndAddToList(ports),
  editArticle: createEditArticle(ports),
  getArticleUsage: createGetArticleUsage(ports),
  deleteArticle: createDeleteArticle(ports),
  restoreDeletedArticle: createRestoreDeletedArticle(ports),
  changeItemQuantity: createChangeItemQuantity(ports),
  removeItemFromList: createRemoveItemFromList(ports),
  restoreRemovedItem: createRestoreRemovedItem(ports),
  getLists: createGetLists(ports),
  createList: createCreateList(ports),
  setCurrentList: createSetCurrentList(ports),
  createCategory: createCreateCategory(ports),
  connectToServer: createConnectToServer(ports),
  synchronize: createSynchronize(ports),
  releaseHeldChanges: createReleaseHeldChanges(ports),
  getSyncInfo: createGetSyncInfo(ports),
});
