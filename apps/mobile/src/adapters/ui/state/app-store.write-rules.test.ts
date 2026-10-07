import { StorageFull } from '../../../application/ports/storage-full';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../../../application/testing/in-memory-repositories';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { SequentialIdGenerator } from '../../../application/testing/sequential-id-generator';
import { createInitializeStore } from '../../../application/use-cases/initialize-store';
import type { ArticleId } from '../../../domain/article';
import type { CurrentListView } from '../../../domain/current-list-view';
import type { ListSummary } from '../../../domain/list-summary';
import { err, ok, type Result } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import type { UseCases } from '../use-cases';
import { createAppStoreWith, type PendingUndo } from './app-store';
import { UnexpectedResult } from './unexpected-result';

type TestError = { type: string };
type Call = () => Promise<Result<string, TestError>>;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const summary = (name: string): ListSummary => ({
  id: `list-${name}` as ListId,
  name,
  itemCount: 0,
  isCurrent: false,
});

const offer: PendingUndo = {
  kind: 'removedItem',
  removed: {
    listId: 'list-1' as ListId,
    articleId: 'article-1' as ArticleId,
    inCart: false,
    quantity: null,
  },
  name: 'Lait',
};

/**
 * A store with test-only actions built on the shared write rules: `testWrite` and
 * `addArticleToList` run the call they are given, and two regions load from jest mocks.
 */
const buildStore = () => {
  const errorReporter = new RecordingErrorReporter();
  const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
  const useCases: UseCases = {
    initializeStore: createInitializeStore({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    }),
  };
  const getLists = jest.fn<Promise<ListSummary[]>, []>();
  const getCurrentList = jest.fn<Promise<CurrentListView>, []>();
  const store = createAppStoreWith({ useCases, errorReporter }, (kit) => ({
    testWrite: (call: Call) => kit.runWrite('testWrite', call),
    addArticleToList: (call: Call) =>
      kit.runWrite('addArticleToList', call, { expected: ['AlreadyOnList'] }),
    restoreRemovedItem: (call: Call) =>
      kit.runWrite('restoreRemovedItem', call),
    loadLists: kit.region('lists', 'getLists', async () => ({
      status: 'success' as const,
      data: await getLists(),
    })),
    loadCurrentList: kit.region('currentList', 'getCurrentList', async () => ({
      status: 'success' as const,
      data: await getCurrentList(),
    })),
  }));
  return { store, errorReporter, getLists, getCurrentList };
};

describe('the shared write rules', () => {
  describe('one write queue', () => {
    it('FR-004 starts a write only after the write called before it has finished', async () => {
      const { store } = buildStore();
      const first = deferred<Result<string, TestError>>();
      const order: string[] = [];
      const firstCall = jest.fn(() => {
        order.push('first starts');
        return first.promise;
      });
      const secondCall = jest.fn(async () => {
        order.push('second starts');
        return ok('second');
      });

      const firstWrite = store.getState().testWrite(firstCall);
      const secondWrite = store.getState().testWrite(secondCall);
      await Promise.resolve();
      await Promise.resolve();

      expect(firstCall).toHaveBeenCalledTimes(1);
      expect(secondCall).not.toHaveBeenCalled();

      order.push('first ends');
      first.resolve(ok('first'));
      await expect(firstWrite).resolves.toEqual(ok('first'));
      await expect(secondWrite).resolves.toEqual(ok('second'));
      expect(order).toEqual(['first starts', 'first ends', 'second starts']);
    });

    it('FR-004 runs the next write after one that failed', async () => {
      const { store } = buildStore();

      const failing = store.getState().testWrite(async () => {
        throw new Error('boom');
      });
      const next = store.getState().testWrite(async () => ok('saved'));

      await expect(failing).resolves.toEqual(err({ type: 'WriteFailed' }));
      await expect(next).resolves.toEqual(ok('saved'));
    });
  });

  describe('the undo offer', () => {
    it('FR-010 is ended by a write that succeeds', async () => {
      const { store } = buildStore();
      store.setState({ pendingUndo: offer });

      await store.getState().testWrite(async () => ok('saved'));

      expect(store.getState().pendingUndo).toBeNull();
    });

    it.each([
      ['a throw', async () => Promise.reject(new Error('boom'))],
      ['an unexpected result', async () => err({ type: 'ItemNotOnList' })],
      ['refused input', async () => err({ type: 'NameRequired' })],
    ] as [string, Call][])(
      'FR-010 is kept by a write that ends with %s',
      async (_, call) => {
        const { store } = buildStore();
        store.setState({ pendingUndo: offer });

        await store.getState().testWrite(call);

        expect(store.getState().pendingUndo).toBe(offer);
      },
    );
  });

  describe('refresh', () => {
    it('FR-003 reloads after a write that succeeds every region already requested, and only those', async () => {
      const { store, getLists, getCurrentList } = buildStore();
      getLists.mockResolvedValueOnce([summary('Ma liste')]);
      await store.getState().loadLists();

      getLists.mockResolvedValueOnce([
        summary('Ma liste'),
        summary('Barbecue'),
      ]);
      await store.getState().testWrite(async () => ok('saved'));

      expect(getLists).toHaveBeenCalledTimes(2);
      expect(getCurrentList).not.toHaveBeenCalled();
      expect(store.getState().currentList).toEqual({ status: 'idle' });
      expect(store.getState().lists).toEqual({
        status: 'success',
        data: [summary('Ma liste'), summary('Barbecue')],
      });
    });

    it('does not reload after a write that fails', async () => {
      const { store, getLists } = buildStore();
      getLists.mockResolvedValue([summary('Ma liste')]);
      await store.getState().loadLists();

      await store.getState().testWrite(async () => {
        throw new Error('boom');
      });

      expect(getLists).toHaveBeenCalledTimes(1);
    });

    it('keeps the data on screen while it reloads, with no loading state', async () => {
      const { store, getLists } = buildStore();
      getLists.mockResolvedValueOnce([summary('Ma liste')]);
      await store.getState().loadLists();
      const reload = deferred<ListSummary[]>();
      getLists.mockReturnValueOnce(reload.promise);

      const refreshing = store.getState().refresh();
      const seen = store.getState().lists;
      reload.resolve([summary('Barbecue')]);
      await refreshing;

      expect(seen).toEqual({ status: 'success', data: [summary('Ma liste')] });
      expect(store.getState().lists).toEqual({
        status: 'success',
        data: [summary('Barbecue')],
      });
    });
  });

  describe('loading a region', () => {
    it('shows loading for the first load, then the data', async () => {
      const { store, getLists } = buildStore();
      const load = deferred<ListSummary[]>();
      getLists.mockReturnValueOnce(load.promise);

      const loading = store.getState().loadLists();
      const seen = store.getState().lists;
      load.resolve([summary('Ma liste')]);
      await loading;

      expect(seen).toEqual({ status: 'loading' });
      expect(store.getState().lists).toEqual({
        status: 'success',
        data: [summary('Ma liste')],
      });
    });

    it('shows the error state and reports the query by name when it throws', async () => {
      const { store, getLists, errorReporter } = buildStore();
      const failure = new Error('boom');
      getLists.mockRejectedValueOnce(failure);

      await store.getState().loadLists();

      expect(store.getState().lists).toEqual({
        status: 'error',
        error: failure,
      });
      expect(errorReporter.reports).toEqual([
        { error: failure, context: { operation: 'getLists' } },
      ]);
    });

    it('shows loading again for a retry after an error', async () => {
      const { store, getLists } = buildStore();
      getLists.mockRejectedValueOnce(new Error('boom'));
      await store.getState().loadLists();
      getLists.mockReturnValueOnce(new Promise(() => {}));

      void store.getState().loadLists();

      expect(store.getState().lists).toEqual({ status: 'loading' });
    });
  });

  describe('an unexpected throw', () => {
    it('FR-030 is reported with the operation only, sets the writeFailed notice and resolves to WriteFailed', async () => {
      const { store, errorReporter, getLists } = buildStore();
      getLists.mockResolvedValue([summary('Ma liste')]);
      await store.getState().loadLists();
      const before = store.getState();
      const failure = new Error('boom');

      const outcome = await store.getState().testWrite(async () => {
        throw failure;
      });

      expect(outcome).toEqual(err({ type: 'WriteFailed' }));
      // The reporter adds the screen last given to `setScreen` (contracts/driven-ports.md).
      expect(errorReporter.reports).toEqual([
        { error: failure, context: { operation: 'testWrite' } },
      ]);
      expect(store.getState()).toEqual({
        ...before,
        notice: { type: 'writeFailed' },
      });
    });

    it('FR-030 R12a StorageFull sets the storageFull notice and is not reported', async () => {
      const { store, errorReporter } = buildStore();

      const outcome = await store.getState().testWrite(async () => {
        throw new StorageFull();
      });

      expect(outcome).toEqual(err({ type: 'WriteFailed' }));
      expect(store.getState().notice).toEqual({ type: 'storageFull' });
      expect(errorReporter.reports).toEqual([]);
    });
  });

  describe('a business error', () => {
    it.each(['NameRequired', 'NameAlreadyUsed', 'AmountNotPositive'])(
      'FR-030 returns the refused input %s unchanged, with no notice and no report',
      async (type) => {
        const { store, errorReporter } = buildStore();
        const refused = { type, existing: 'Lait' };

        const outcome = await store
          .getState()
          .testWrite(async () => err(refused));

        expect(outcome).toEqual(err(refused));
        expect(store.getState().notice).toBeNull();
        expect(errorReporter.reports).toEqual([]);
      },
    );

    it('US2-8 returns AlreadyOnList from addArticleToList unchanged, with no notice and no report', async () => {
      const { store, errorReporter } = buildStore();

      const outcome = await store
        .getState()
        .addArticleToList(async () => err({ type: 'AlreadyOnList' }));

      expect(outcome).toEqual(err({ type: 'AlreadyOnList' }));
      expect(store.getState().notice).toBeNull();
      expect(errorReporter.reports).toEqual([]);
    });

    it('FR-010 treats AlreadyOnList from restoreRemovedItem as a failed restore, reported as UnexpectedResult', async () => {
      const { store, errorReporter } = buildStore();

      const outcome = await store
        .getState()
        .restoreRemovedItem(async () => err({ type: 'AlreadyOnList' }));

      expect(outcome).toEqual(err({ type: 'WriteFailed' }));
      expect(store.getState().notice).toEqual({ type: 'writeFailed' });
      expect(errorReporter.reports).toEqual([
        {
          error: expect.objectContaining({ code: 'AlreadyOnList' }),
          context: { operation: 'restoreRemovedItem' },
        },
      ]);
      expect(errorReporter.reports[0]?.error).toBeInstanceOf(UnexpectedResult);
    });

    it.each(['ItemNotOnList', 'ListNotFound'])(
      'FR-030 handles %s like an unexpected throw, reported as an UnexpectedResult carrying only its tag',
      async (type) => {
        const { store, errorReporter, getLists } = buildStore();
        getLists.mockResolvedValue([summary('Ma liste')]);
        await store.getState().loadLists();
        const before = store.getState();

        const outcome = await store
          .getState()
          .testWrite(async () => err({ type, name: 'Houmous maison' }));

        expect(outcome).toEqual(err({ type: 'WriteFailed' }));
        expect(store.getState()).toEqual({
          ...before,
          notice: { type: 'writeFailed' },
        });
        expect(errorReporter.reports).toEqual([
          {
            error: expect.objectContaining({
              name: 'UnexpectedResult',
              code: type,
              message: 'Unexpected use case result',
            }),
            context: { operation: 'testWrite' },
          },
        ]);
        const error = errorReporter.reports[0]?.error;
        expect(error).toBeInstanceOf(UnexpectedResult);
        expect(JSON.stringify({ ...(error as object) })).not.toContain(
          'Houmous',
        );
      },
    );
  });
});
