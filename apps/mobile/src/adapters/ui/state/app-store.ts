import { createStore, type StoreApi } from 'zustand/vanilla';

import type { ErrorReporter } from '../../../application/ports/error-reporter';
import { StorageFull } from '../../../application/ports/storage-full';
import { err, type Result } from '../../../domain/result';
import type { UseCases } from '../use-cases';
import {
  createArticlesActions,
  type ArticlesActions,
} from './articles-actions';
import {
  createCategoriesActions,
  type CategoriesActions,
} from './categories-actions';
import {
  createCurrentListActions,
  type CurrentListActions,
} from './current-list-actions';
import {
  createEditListActions,
  type EditListActions,
} from './edit-list-actions';
import { createListsActions, type ListsActions } from './lists-actions';
import { createSyncActions, type SyncActions } from './sync-actions';
import type {
  PendingUndo,
  RefusedInputType,
  StoreCore,
  StoreKit,
  WriteFailed,
  WriteOptions,
} from './store-kit';
import { UnexpectedResult } from './unexpected-result';

export type {
  EmptyCurrentList,
  Notice,
  PendingUndo,
  StoreCore,
  StoreKit,
  WriteFailed,
} from './store-kit';

/** The application state shared by every screen (002 contracts/ui-state.md). */
export type AppState = StoreCore &
  CurrentListActions &
  EditListActions &
  ListsActions &
  CategoriesActions &
  ArticlesActions &
  SyncActions;

export type AppStore = StoreApi<AppState>;

export type AppStoreDeps = {
  useCases: UseCases;
  errorReporter: ErrorReporter;
  /** Called after a local change was saved, so the sync scheduler can run a cycle soon. */
  onLocalWrite?: () => void;
};

/**
 * Input the user can correct: the form or dialog shows it, and it is never reported (FR-030).
 * A record with an entry per tag, so a new name or quantity error does not compile until listed.
 */
const REFUSED_INPUT: Record<RefusedInputType, true> = {
  NameRequired: true,
  NameTooLong: true,
  NameAlreadyUsed: true,
  AmountNotANumber: true,
  AmountNotPositive: true,
  AmountTooPrecise: true,
  AmountTooLarge: true,
  UnitWithoutAmount: true,
  UnitTooLong: true,
};

/**
 * Builds the store with the actions `extend` defines on the shared write rules. Used by
 * `createAppStore`, and by the tests of the write rules with test-only actions.
 */
export const createAppStoreWith = <Actions extends object>(
  { useCases, errorReporter, onLocalWrite }: AppStoreDeps,
  extend: (kit: StoreKit) => Actions,
): StoreApi<StoreCore & Actions> =>
  createStore<StoreCore & Actions>()((set, get) => {
    const regions: { requested: () => boolean; load: () => Promise<void> }[] =
      [];
    let writes: Promise<unknown> = Promise.resolve();
    const update = (partial: Partial<StoreCore>) =>
      set(partial as Partial<StoreCore & Actions>);

    const refresh = async () => {
      await Promise.all(
        regions.filter((r) => r.requested()).map((r) => r.load()),
      );
    };

    const endedRemotely = new Set<string>();
    const releaseOffer = (offer: PendingUndo) => {
      const { undoId } =
        offer.kind === 'removedItem' ? offer.removed : offer.deleted;
      // The release is a write of its own: a failure is reported, and the user is not told.
      useCases.releaseHeldChanges(undoId).catch((error: unknown) => {
        errorReporter.report(error, { operation: 'releaseHeldChanges' });
      });
    };
    const endUndo = () => {
      const offer = get().pendingUndo;
      if (offer === null) return;
      update({ pendingUndo: null });
      releaseOffer(offer);
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
      { expected = [], offer }: WriteOptions<T, string>,
    ): Promise<Result<T, E | WriteFailed>> => {
      let outcome: Result<T, E>;
      try {
        outcome = await call();
      } catch (error) {
        return fail(operation, error);
      }
      if (!outcome.ok) {
        const { type } = outcome.error;
        return Object.hasOwn(REFUSED_INPUT, type) || expected.includes(type)
          ? outcome
          : fail(operation, new UnexpectedResult(type));
      }
      onLocalWrite?.();
      // The offer a write replaces or ends is final: its held changes are released.
      const previous = get().pendingUndo;
      if (previous !== null) releaseOffer(previous);
      // A new offer also ends the notice: its snackbar would cover "Annuler".
      update(
        offer
          ? { pendingUndo: offer(outcome.value), notice: null }
          : { pendingUndo: null },
      );
      return outcome;
    };

    const kit: StoreKit = {
      get,
      set: update,
      useCases,
      endUndo,
      releaseOffer,
      onLocalWrite: () => onLocalWrite?.(),
      endedRemotely,
      runWrite: <T, E extends { type: string }, X extends E['type']>(
        operation: string,
        call: () => Promise<Result<T, E>>,
        options: WriteOptions<T, X> = {},
      ) => {
        const saved = writes.then(() => write(operation, call, options));
        writes = saved.catch(() => undefined);
        // Any error left is refused input or one of `expected`: the others became WriteFailed.
        return saved.then(async (outcome) => {
          if (outcome.ok) await refresh();
          return outcome as Result<
            T,
            Extract<E, { type: RefusedInputType | X }> | WriteFailed
          >;
        });
      },
      report: (error, operation, screen) =>
        errorReporter.report(
          error,
          screen === undefined ? { operation } : { operation, screen },
        ),
      region: (name, operation, query) => {
        const setRegion = (state: StoreCore[typeof name]) =>
          update({ [name]: state } as Partial<StoreCore>);
        let latest = 0;
        const load = async () => {
          const started = ++latest;
          const { status } = get()[name];
          // A reload keeps the data on screen until the new data arrives.
          if (status !== 'success' && status !== 'empty') {
            setRegion({ status: 'loading' });
          }
          try {
            const loaded = await query();
            if (started === latest) setRegion(loaded);
          } catch (error) {
            if (started === latest) setRegion({ status: 'error', error });
            errorReporter.report(error, { operation });
          }
        };
        kit.reloadOnRefresh(() => get()[name].status !== 'idle', load);
        return load;
      },
      reloadOnRefresh: (requested, reload) => {
        regions.push({ requested, load: reload });
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
      categories: { status: 'idle' },
      pendingUndo: null,
      sync: {
        connection: 'notConnected',
        status: 'saved',
        pendingCount: 0,
        lastSyncAt: null,
        serverUrl: null,
      },
      notice: null,
      refresh,
      dismissNotice: () => update({ notice: null }),
      ...extend(kit),
    };
  });

/** Builds the store: a plain vanilla store with no middleware (002 research R1b). */
export const createAppStore = (deps: AppStoreDeps): AppStore =>
  createAppStoreWith(deps, (kit) => {
    const currentList = createCurrentListActions(kit);
    return {
      ...currentList,
      ...createEditListActions(kit, currentList),
      ...createListsActions(kit),
      ...createCategoriesActions(kit),
      ...createArticlesActions(kit),
      ...createSyncActions(kit),
    };
  });
