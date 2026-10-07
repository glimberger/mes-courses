import { createStore, type StoreApi } from 'zustand/vanilla';

import type { ErrorReporter } from '../../../application/ports/error-reporter';
import { StorageFull } from '../../../application/ports/storage-full';
import type { CatalogView } from '../../../domain/catalog-view';
import type { CurrentListView } from '../../../domain/current-list-view';
import type { RemovedItem } from '../../../domain/list-item';
import type { ListSummary } from '../../../domain/list-summary';
import type { NameError } from '../../../domain/name';
import type { QuantityError } from '../../../domain/quantity';
import { err, type Result } from '../../../domain/result';
import type { UseCases } from '../use-cases';
import type { ScreenState } from './screen-state';
import { UnexpectedResult } from './unexpected-result';

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

/** The application state shared by every screen (002 contracts/ui-state.md). */
export interface AppState {
  currentList: ScreenState<CurrentListView>;
  catalog: {
    query: string;
    /** Loaded once, unfiltered (R11a). */
    full: ScreenState<CatalogView>;
    /** `full` filtered by `query`. */
    view: ScreenState<CatalogView, { query: string }>;
  };
  lists: ScreenState<ListSummary[]>;
  pendingUndo: PendingUndo | null;
  notice: Notice | null;
  /** Reloads every region already requested. Runs after each write that succeeds. */
  refresh: () => Promise<void>;
  dismissNotice: () => void;
}

export type AppStore = StoreApi<AppState>;

export type AppStoreDeps = {
  useCases: UseCases;
  errorReporter: ErrorReporter;
};

/** What a write action resolves to when its save failed; the notice already says so. */
export type WriteFailed = { type: 'WriteFailed' };

/** Regions that hold one `ScreenState` and load with one query. */
type RegionName = 'currentList' | 'lists';
type Loaded<K extends RegionName> = Extract<
  AppState[K],
  { status: 'success' | 'empty' }
>;

/** What the actions are built with. */
export interface StoreKit {
  get: () => AppState;
  set: (partial: Partial<AppState>) => void;
  useCases: UseCases;
  /**
   * Runs a write in the store-wide queue, after every write called before it, and applies the
   * shared write rules (002 contracts/ui-state.md). Refused input, and the business errors named
   * in `expected`, are returned to the caller as they are.
   */
  runWrite: <T, E extends { type: string }>(
    operation: string,
    call: () => Promise<Result<T, E>>,
    options?: { expected?: readonly E['type'][] },
  ) => Promise<Result<T, E | WriteFailed>>;
  /**
   * Defines how a region loads, and returns its load action. `refresh` reloads the region once
   * it has been requested.
   */
  region: <K extends RegionName>(
    name: K,
    operation: string,
    query: () => Promise<Loaded<K>>,
  ) => () => Promise<void>;
}

/** Input the user can correct: the form or dialog shows it, and it is never reported (FR-030). */
const REFUSED_INPUT: readonly string[] = [
  'NameRequired',
  'NameTooLong',
  'NameAlreadyUsed',
  'AmountNotANumber',
  'AmountNotPositive',
  'AmountTooPrecise',
  'AmountTooLarge',
  'UnitWithoutAmount',
  'UnitTooLong',
] satisfies readonly (
  NameError['type'] | QuantityError['type'] | 'NameAlreadyUsed'
)[];

/**
 * Builds the store with the actions `extend` defines on the shared write rules. Used by
 * `createAppStore`, and by the tests of the write rules with test-only actions.
 */
export const createAppStoreWith = <Actions extends object>(
  { useCases, errorReporter }: AppStoreDeps,
  extend: (kit: StoreKit) => Actions,
): StoreApi<AppState & Actions> =>
  createStore<AppState & Actions>()((set, get) => {
    const regions: { requested: () => boolean; load: () => Promise<void> }[] =
      [];
    let writes: Promise<unknown> = Promise.resolve();
    const update = (partial: Partial<AppState>) =>
      set(partial as Partial<AppState & Actions>);

    const refresh = async () => {
      await Promise.all(
        regions.filter((r) => r.requested()).map((r) => r.load()),
      );
    };

    const fail = (
      operation: string,
      error: unknown,
    ): Result<never, WriteFailed> => {
      if (error instanceof StorageFull) {
        update({ notice: { type: 'storageFull' } });
      } else {
        update({ notice: { type: 'writeFailed' } });
        errorReporter.report(error, { operation });
      }
      return err({ type: 'WriteFailed' });
    };

    const write = async <T, E extends { type: string }>(
      operation: string,
      call: () => Promise<Result<T, E>>,
      expected: readonly string[],
    ): Promise<Result<T, E | WriteFailed>> => {
      let outcome: Result<T, E>;
      try {
        outcome = await call();
      } catch (error) {
        return fail(operation, error);
      }
      if (!outcome.ok) {
        const { type } = outcome.error;
        return REFUSED_INPUT.includes(type) || expected.includes(type)
          ? outcome
          : fail(operation, new UnexpectedResult(type));
      }
      update({ pendingUndo: null });
      await refresh();
      return outcome;
    };

    const kit: StoreKit = {
      get,
      set: update,
      useCases,
      runWrite: (operation, call, options) => {
        const run = writes.then(() =>
          write(operation, call, options?.expected ?? []),
        );
        writes = run.catch(() => undefined);
        return run;
      },
      region: (name, operation, query) => {
        const setRegion = (state: AppState[typeof name]) =>
          update({ [name]: state } as Partial<AppState>);
        const load = async () => {
          const { status } = get()[name];
          // A reload keeps the data on screen until the new data arrives.
          if (status !== 'success' && status !== 'empty') {
            setRegion({ status: 'loading' });
          }
          try {
            setRegion(await query());
          } catch (error) {
            setRegion({ status: 'error', error });
            errorReporter.report(error, { operation });
          }
        };
        regions.push({ requested: () => get()[name].status !== 'idle', load });
        return load;
      },
    };

    return {
      currentList: { status: 'idle' },
      catalog: {
        query: '',
        full: { status: 'idle' },
        view: { status: 'idle' },
      },
      lists: { status: 'idle' },
      pendingUndo: null,
      notice: null,
      refresh,
      dismissNotice: () => update({ notice: null }),
      ...extend(kit),
    };
  });

/** Builds the store: a plain vanilla store with no middleware (002 research R1b). */
export const createAppStore = (deps: AppStoreDeps): AppStore =>
  createAppStoreWith(deps, () => ({}));
