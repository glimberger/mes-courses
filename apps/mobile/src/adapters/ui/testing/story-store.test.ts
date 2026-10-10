import { StorageFull } from '../../../application/ports/storage-full';
import { err, ok } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import type * as AppStoreModule from '../state/app-store';
import type * as StoryStoreModule from './story-store';
import { buildStoryStore, createStoryStore } from './story-store';

const seed = { categoryNames: ['Crèmerie'], firstListName: 'Ma liste' };

const barbecue = 'l1' as ListId;

const fixture: StoryStoreModule.Fixture = {
  categories: [{ id: 'c1', name: 'Crèmerie', position: 0 }],
  articles: [{ id: 'a1', name: 'Lait', categoryId: 'c1' }],
  lists: [{ id: 'l1', name: 'Barbecue' }],
  items: [
    {
      listId: 'l1',
      articleId: 'a1',
      inCart: true,
      quantity: { amount: 2, unit: 'L' },
    },
  ],
  currentListId: 'l1',
} as StoryStoreModule.Fixture;

/** Whether the promise is still pending once every queued task has run. */
const isPending = async (promise: Promise<unknown>) => {
  const pending = Symbol('pending');
  const outcome = await Promise.race([
    promise.then(
      () => 'settled',
      () => 'settled',
    ),
    new Promise((resolve) => setTimeout(() => resolve(pending), 0)),
  ]);
  return outcome === pending;
};

describe('createStoryStore', () => {
  it('returns a store built on the real use cases, every region idle', async () => {
    const store = await createStoryStore({});

    expect(store.getState().currentList).toEqual({ status: 'idle' });
    expect(store.getState().notice).toBeNull();
  });

  it('gives each scenario fresh fakes', async () => {
    const first = await buildStoryStore({});
    const second = await buildStoryStore({});

    await first.useCases.initializeStore(seed);

    expect(second.unitOfWork).not.toBe(first.unitOfWork);
    expect(await second.unitOfWork.run((repos) => repos.lists.count())).toBe(0);
  });

  it('stores the seed in the fakes before the store is used', async () => {
    const { unitOfWork } = await buildStoryStore({ seed: fixture });

    const stored = await unitOfWork.run(async (repos) => ({
      categories: await repos.categories.all(),
      articles: await repos.articles.all(),
      lists: await repos.lists.all(),
      items: await repos.items.forList(barbecue),
      currentListId: await repos.appState.currentListId(),
    }));
    expect(stored).toEqual(fixture);
  });

  it('runs the real use cases when the scenario names none', async () => {
    const { useCases, unitOfWork } = await buildStoryStore({});

    await useCases.initializeStore(seed);

    expect(await unitOfWork.run((repos) => repos.lists.all())).toEqual([
      { id: expect.any(String), name: 'Ma liste' },
    ]);
  });

  it('holds a use case named in pending for ever', async () => {
    const { useCases } = await buildStoryStore({
      pending: ['initializeStore'],
    });

    expect(await isPending(useCases.initializeStore(seed))).toBe(true);
  });

  it('rejects a use case named in failing with an Error', async () => {
    const { useCases, unitOfWork } = await buildStoryStore({
      failing: ['initializeStore'],
    });

    const call = useCases.initializeStore(seed);

    await expect(call).rejects.toBeInstanceOf(Error);
    await expect(call).rejects.not.toBeInstanceOf(StorageFull);
    expect(await unitOfWork.run((repos) => repos.lists.count())).toBe(0);
  });

  it('rejects a use case failing with storageFull with StorageFull', async () => {
    const { useCases } = await buildStoryStore({
      failingWith: { initializeStore: 'storageFull' },
    });

    await expect(useCases.initializeStore(seed)).rejects.toBeInstanceOf(
      StorageFull,
    );
  });

  it('runs prepare on the built store before resolving', async () => {
    const steps: string[] = [];

    const store = await createStoryStore({
      prepare: async (actions) => {
        await Promise.resolve();
        actions.dismissNotice();
        steps.push('prepared');
      },
    });

    expect(steps).toEqual(['prepared']);
    expect(store.getState().notice).toBeNull();
  });

  it('stops waiting for prepare once it calls a use case held pending', async () => {
    let isolated!: typeof StoryStoreModule;
    jest.isolateModules(() => {
      // An action that calls initializeStore, held pending, for this test only.
      jest.doMock('../state/app-store', () => {
        const actual =
          jest.requireActual<typeof AppStoreModule>('../state/app-store');
        return {
          ...actual,
          createAppStore: (deps: AppStoreModule.AppStoreDeps) =>
            actual.createAppStoreWith(deps, ({ useCases }) => ({
              initialize: () => useCases.initializeStore(seed),
            })),
        };
      });
      isolated = jest.requireActual<typeof StoryStoreModule>('./story-store');
    });
    const steps: string[] = [];

    const built = isolated.buildStoryStore({
      pending: ['initializeStore'],
      prepare: async (actions) => {
        steps.push('started');
        await (
          actions as unknown as { initialize: () => Promise<unknown> }
        ).initialize();
        steps.push('never');
      },
    });

    expect(await isPending(built)).toBe(false);
    expect(steps).toEqual(['started']);
  });

  it('gives prepare the store actions only, never a way to set state', async () => {
    await createStoryStore({
      prepare: async (actions) => {
        // @ts-expect-error A story reaches a state only through the store's actions (R22).
        expect(actions.setState).toBeUndefined();
        // @ts-expect-error Data regions are not actions.
        expect(actions.currentList).toBeUndefined();
      },
    });
  });

  describe('synchronization (003)', () => {
    const connected = {
      serverUrl: 'https://courses.example.fr',
      lastSyncAt: '2026-10-01T10:00:00.000Z',
    };

    it('starts not connected by default', async () => {
      const { store, useCases } = await buildStoryStore({});

      expect((await useCases.getSyncInfo()).connection).toBe('notConnected');
      expect(store.getState().sync.connection).toBe('notConnected');
    });

    it('starts connected: the credential, the address and the last sync are there', async () => {
      const { store, useCases } = await buildStoryStore({ connected });

      expect(await useCases.getSyncInfo()).toEqual({
        ...connected,
        connection: 'connected',
      });
      expect(store.getState().sync).toMatchObject({
        ...connected,
        connection: 'connected',
      });
    });

    it('keeps the last sync while the server is unreachable, without a notice', async () => {
      const { store, errorReporter } = await buildStoryStore({ connected });

      expect(store.getState().sync.status).toBe('waiting');
      expect(store.getState().sync.lastSyncAt).toBe(connected.lastSyncAt);
      expect(store.getState().notice).toBeNull();
      expect(errorReporter.reports).toEqual([]);
    });

    it('drives the server fake: a revoked device', async () => {
      const { store } = await buildStoryStore({
        connected,
        syncServer: { sync: async () => err({ type: 'DeviceNotAuthorized' }) },
      });

      expect(store.getState().sync.connection).toBe('disconnectedByServer');
    });

    it('drives the server fake: an update required', async () => {
      const { store } = await buildStoryStore({
        connected,
        syncServer: { sync: async () => err({ type: 'UpdateRequired' }) },
      });

      expect(store.getState().sync.connection).toBe('updateRequired');
    });

    it('drives the server fake: a reachable server pairs the device', async () => {
      const { store } = await buildStoryStore({
        syncServer: {
          health: async () =>
            ok({ serverId: 's1', apiVersion: 1, minAppVersion: '1.0.0' }),
          claim: async () =>
            ok({
              serverId: 's1',
              apiVersion: 1,
              minAppVersion: '1.0.0',
              deviceId: 'd1',
              credential: 'secret',
            }),
        },
      });

      const outcome = await store
        .getState()
        .connectToServer('courses.example.fr', 'ABCD-EF23', 'Pixel');

      expect(outcome.ok).toBe(true);
      expect(store.getState().sync.connection).toBe('connected');
      expect(store.getState().notice).toEqual({ type: 'deviceConnected' });
    });

    it('holds synchronize and connectToServer pending', async () => {
      const { store } = await buildStoryStore({
        pending: ['connectToServer', 'synchronize'],
      });

      expect(
        await isPending(store.getState().connectToServer('a', 'b', 'c')),
      ).toBe(true);
      expect(await isPending(store.getState().syncNow())).toBe(true);
    });

    it('makes synchronize and connectToServer fail', async () => {
      const { store, errorReporter } = await buildStoryStore({
        failing: ['connectToServer', 'synchronize'],
      });

      const connect = await store.getState().connectToServer('a', 'b', 'c');
      const cycle = await store.getState().syncNow();

      expect(connect).toEqual(err({ type: 'WriteFailed' }));
      expect(cycle).toEqual({ failed: true });
      expect(errorReporter.reports).toHaveLength(2);
    });
  });
});
