import type { CatalogView } from '../../../domain/catalog-view';
import type { CategoryId } from '../../../domain/category';
import type { CurrentListView } from '../../../domain/current-list-view';
import type { RemovedItem } from '../../../domain/list-item';
import type { ListSummary } from '../../../domain/list-summary';
import type { NameError } from '../../../domain/name';
import type { QuantityError } from '../../../domain/quantity';
import type { Result } from '../../../domain/result';
import type { UseCases } from '../use-cases';
import type { ScreenState } from './screen-state';

// The types the store core and each story's actions share, apart from app-store.ts so the actions
// do not import the module that builds the store from them.

/** The app-wide snackbar; its French text is written by `NoticeSnackbar` (Principle X). */
export type Notice =
  | { type: 'writeFailed' }
  | { type: 'storageFull' }
  | { type: 'articleAdded'; name: string };

/** The one change that "Annuler" can still revert (FR-010). */
export type PendingUndo = {
  kind: 'removedItem';
  removed: RemovedItem;
  name: string;
};

/** What the current list region shows when the list has no item: its name (US1-10). */
export type EmptyCurrentList = { list: CurrentListView['list'] };

/** The state and actions every story shares: the regions and the shared write rules. */
export interface StoreCore {
  currentList: ScreenState<CurrentListView, EmptyCurrentList>;
  catalog: {
    query: string;
    /** Loaded once, unfiltered (R11a). */
    full: ScreenState<CatalogView>;
    /** `full` filtered by `query`. */
    view: ScreenState<CatalogView, { query: string }>;
  };
  lists: ScreenState<ListSummary[]>;
  /** The categories of the category picker, ordered by position. */
  categories: ScreenState<{ id: CategoryId; name: string }[]>;
  pendingUndo: PendingUndo | null;
  notice: Notice | null;
  /** Reloads every region already requested. Runs after each write that succeeds. */
  refresh: () => Promise<void>;
  dismissNotice: () => void;
}

/** What a write action resolves to when its save failed; the notice already says so. */
export type WriteFailed = { type: 'WriteFailed' };

/** The tags of the input the user can correct: returned to the form, never reported (FR-030). */
export type RefusedInputType =
  NameError['type'] | QuantityError['type'] | 'NameAlreadyUsed';

/** How a write treats its outcome, beyond the shared write rules. */
export type WriteOptions<T, X extends string> = {
  /** Business errors returned to the caller as they are, besides refused input. */
  expected?: readonly X[];
  /** The undo offer a success makes, in place of ending the pending one (FR-010). */
  offer?: (value: T) => PendingUndo;
};

/** Regions that hold one `ScreenState` and load with one query. */
type RegionName = 'currentList' | 'lists' | 'categories';
type Loaded<K extends RegionName> = Extract<
  StoreCore[K],
  { status: 'success' | 'empty' }
>;

/** What the actions are built with. */
export interface StoreKit {
  get: () => StoreCore;
  set: (partial: Partial<StoreCore>) => void;
  useCases: UseCases;
  /**
   * Runs a write in the store-wide queue, after every write called before it, and applies the
   * shared write rules (002 contracts/ui-state.md). Refused input, and the business errors named
   * in `expected`, are returned to the caller as they are; every other error is a failed save.
   * After a success it resolves once `refresh()` is done; the next write does not wait for that
   * refresh.
   */
  runWrite: <T, E extends { type: string }, X extends E['type'] = never>(
    operation: string,
    call: () => Promise<Result<T, E>>,
    options?: WriteOptions<T, X>,
  ) => Promise<
    Result<T, Extract<E, { type: RefusedInputType | X }> | WriteFailed>
  >;
  /** Reports a failure the action handles itself, with the operation only (Principle VIII). */
  report: (error: unknown, operation: string) => void;
  /**
   * Defines how a region loads, and returns its load action. `refresh` reloads the region once
   * it has been requested. When loads overlap, only the last one started is shown.
   */
  region: <K extends RegionName>(
    name: K,
    operation: string,
    query: () => Promise<Loaded<K>>,
  ) => () => Promise<void>;
  /**
   * Has `refresh` call `reload` whenever `requested` says the region has been requested, for a
   * region that `region` cannot build (the catalog, whose two views load together).
   */
  reloadOnRefresh: (
    requested: () => boolean,
    reload: () => Promise<void>,
  ) => void;
}
