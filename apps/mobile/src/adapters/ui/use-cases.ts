import type { AccountServer } from '../../application/ports/account-server';
import type {
  AdminServer,
  Forbidden,
} from '../../application/ports/admin-server';
import {
  createSuspendAccount,
  type SuspendAccountError,
} from '../../application/use-cases/suspend-account';
import {
  createReactivateAccount,
  type ReactivateAccountError,
} from '../../application/use-cases/reactivate-account';
import {
  createResendCredentials,
  type ResendCredentialsError,
} from '../../application/use-cases/resend-credentials';
import {
  createDeleteAccountAsAdmin,
  type DeleteAccountAsAdminError,
} from '../../application/use-cases/delete-account-as-admin';
import type { Clock } from '../../application/ports/clock';
import type { CredentialStore } from '../../application/ports/credential-store';
import type { LocalDataEraser } from '../../application/ports/local-data-eraser';
import type { IdGenerator } from '../../application/ports/id-generator';
import type {
  DeviceNotFound,
  SyncFailure,
  SyncServer,
} from '../../application/ports/sync-server';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import {
  createGetAccountSettings,
  type AccountSettings,
} from '../../application/use-cases/get-account-settings';
import {
  createRequestPasswordReset,
  type RequestPasswordResetError,
} from '../../application/use-cases/request-password-reset';
import {
  createInviteAccount,
  type InviteAccountError,
} from '../../application/use-cases/invite-account';
import { createAcknowledgeSignedOut } from '../../application/use-cases/acknowledge-signed-out';
import { createListAccounts } from '../../application/use-cases/list-accounts';
import { createAddArticleToList } from '../../application/use-cases/add-article-to-list';
import {
  createChangeServerUrl,
  type ChangeServerUrlError,
} from '../../application/use-cases/change-server-url';
import { createChangeItemQuantity } from '../../application/use-cases/change-item-quantity';
import { createCreateArticleAndAddToList } from '../../application/use-cases/create-article-and-add-to-list';
import {
  createSignIn,
  type SignInError,
  type SignInResult,
} from '../../application/use-cases/sign-in';
import {
  createChooseInitialPassword,
  type ChooseInitialPasswordError,
} from '../../application/use-cases/choose-initial-password';
import { createCreateCategory } from '../../application/use-cases/create-category';
import { createCreateList } from '../../application/use-cases/create-list';
import { createDeleteArticle } from '../../application/use-cases/delete-article';
import {
  createChangePassword,
  type ChangePasswordError,
} from '../../application/use-cases/change-password';
import {
  createDeleteMyAccount,
  type DeleteMyAccountError,
} from '../../application/use-cases/delete-my-account';
import { createSignOut } from '../../application/use-cases/sign-out';
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
import {
  createListDevices,
  type DeviceInfo,
} from '../../application/use-cases/list-devices';
import { createGetLists } from '../../application/use-cases/get-lists';
import {
  createInitializeStore,
  type Seed,
} from '../../application/use-cases/initialize-store';
import { createRemoveItemFromList } from '../../application/use-cases/remove-item-from-list';
import { createReleaseHeldChanges } from '../../application/use-cases/release-held-changes';
import { createRenameDevice } from '../../application/use-cases/rename-device';
import { createRevokeDevice } from '../../application/use-cases/revoke-device';
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
import type { AccountSummary } from '@mes-courses/sync-core';
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
  signIn: (
    url: string,
    email: string,
    password: string,
    deviceName: string,
  ) => Promise<Result<SignInResult, SignInError>>;
  chooseInitialPassword: (
    url: string,
    email: string,
    temporaryPassword: string,
    newPassword: string,
    confirmation: string,
    deviceName: string,
  ) => Promise<Result<void, ChooseInitialPasswordError>>;
  requestPasswordReset: (
    url: string,
    email: string,
  ) => Promise<Result<void, RequestPasswordResetError>>;
  synchronize: () => Promise<SyncResult>;
  releaseHeldChanges: (undoId: string) => Promise<void>;
  getSyncInfo: () => Promise<SyncInfo>;
  listDevices: () => Promise<Result<DeviceInfo[], SyncFailure>>;
  renameDevice: (
    id: string,
    name: string,
  ) => Promise<Result<void, NameError | SyncFailure | DeviceNotFound>>;
  revokeDevice: (
    id: string,
  ) => Promise<Result<void, SyncFailure | DeviceNotFound>>;
  signOut: () => Promise<Result<void, never>>;
  changePassword: (
    current: string,
    next: string,
    confirmation: string,
  ) => Promise<Result<void, ChangePasswordError>>;
  deleteMyAccount: (
    password: string,
  ) => Promise<Result<void, DeleteMyAccountError>>;
  changeServerUrl: (url: string) => Promise<Result<void, ChangeServerUrlError>>;
  getAccountSettings: () => Promise<AccountSettings>;
  listAccounts: () => Promise<
    Result<AccountSummary[], SyncFailure | Forbidden>
  >;
  inviteAccount: (
    email: string,
  ) => Promise<Result<AccountSummary, InviteAccountError>>;
  acknowledgeSignedOut: () => Promise<Result<void, never>>;
  suspendAccount: (id: string) => Promise<Result<void, SuspendAccountError>>;
  reactivateAccount: (
    id: string,
  ) => Promise<Result<void, ReactivateAccountError>>;
  resendCredentials: (
    id: string,
  ) => Promise<Result<void, ResendCredentialsError>>;
  deleteAccountAsAdmin: (
    id: string,
  ) => Promise<Result<void, DeleteAccountAsAdminError>>;
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
  accountServer: AccountServer;
  adminServer: AdminServer;
  credentials: CredentialStore;
  localDataEraser: LocalDataEraser;
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
  signIn: createSignIn(ports),
  chooseInitialPassword: createChooseInitialPassword(ports),
  requestPasswordReset: createRequestPasswordReset(ports),
  synchronize: createSynchronize(ports),
  releaseHeldChanges: createReleaseHeldChanges(ports),
  getSyncInfo: createGetSyncInfo(ports),
  listDevices: createListDevices(ports),
  renameDevice: createRenameDevice(ports),
  revokeDevice: createRevokeDevice(ports),
  signOut: createSignOut(ports),
  changePassword: createChangePassword(ports),
  deleteMyAccount: createDeleteMyAccount(ports),
  changeServerUrl: createChangeServerUrl(ports),
  getAccountSettings: createGetAccountSettings(ports),
  listAccounts: createListAccounts(ports),
  inviteAccount: createInviteAccount(ports),
  acknowledgeSignedOut: createAcknowledgeSignedOut(ports),
  suspendAccount: createSuspendAccount(ports),
  reactivateAccount: createReactivateAccount(ports),
  resendCredentials: createResendCredentials(ports),
  deleteAccountAsAdmin: createDeleteAccountAsAdmin(ports),
});
