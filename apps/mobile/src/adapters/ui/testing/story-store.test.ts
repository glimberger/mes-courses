import { StorageFull } from '../../../application/ports/storage-full';
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
});
