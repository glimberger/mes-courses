import { InMemoryCredentialStore } from '../../../application/testing/in-memory-credential-store';
import { OfflineSyncServer } from '../../../application/testing/offline-sync-server';
import { StorageFull } from '../../../application/ports/storage-full';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../../../application/testing/in-memory-repositories';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { SequentialIdGenerator } from '../../../application/testing/sequential-id-generator';
import type { Article } from '../../../domain/article';
import type { Category } from '../../../domain/category';
import type { ListItem } from '../../../domain/list-item';
import type { ListId, ShoppingList } from '../../../domain/shopping-list';
import {
  createAppStore,
  type AppState,
  type AppStore,
} from '../state/app-store';
import { createUseCases, type UseCaseName, type UseCases } from '../use-cases';

/** What the in-memory fakes hold when a story or a screen test starts. */
export type Fixture = {
  categories: Category[];
  articles: Article[];
  lists: ShoppingList[];
  items: ListItem[];
  currentListId: ListId | null;
};

/** The store's actions: the only way a scenario changes state (research R22). */
export type StoreActions = {
  [
    K in keyof AppState as AppState[K] extends (...args: never[]) => unknown
      ? K
      : never
  ]: AppState[K];
};

/** What a story or a screen test starts from. It cannot set a state the store cannot reach. */
export type StoryScenario = {
  seed?: Fixture;
  /** Use cases whose promise never settles, for the loading states. */
  pending?: UseCaseName[];
  /** Use cases that reject with an `Error`, for the error states. */
  failing?: UseCaseName[];
  /** Use cases that reject with the given failure instead of an `Error`; they fail too. */
  failingWith?: Partial<Record<UseCaseName, 'storageFull'>>;
  /**
   * Runs once the store is built, through its actions only. It is awaited until it resolves or
   * calls a use case held `pending`, whichever comes first, so a loading state can be prepared.
   */
  prepare?: (store: StoreActions) => Promise<void>;
};

const storeFixture = (unitOfWork: InMemoryUnitOfWork, fixture: Fixture) =>
  unitOfWork.run(async (repos) => {
    for (const category of fixture.categories) {
      await repos.categories.add(category);
    }
    for (const article of fixture.articles) await repos.articles.add(article);
    for (const list of fixture.lists) await repos.lists.add(list);
    for (const item of fixture.items) await repos.items.save(item);
    if (fixture.currentListId !== null) {
      await repos.appState.setCurrentListId(fixture.currentListId);
    }
  });

/** The store's actions, without its data or a way to set it. */
const storeActions = (store: AppStore): StoreActions =>
  Object.fromEntries(
    Object.entries(store.getState()).filter(
      ([, value]) => typeof value === 'function',
    ),
  ) as StoreActions;

/** The use case the scenario asks for in place of `real`, or `real` itself. */
const scenarioUseCase = <K extends UseCaseName>(
  name: K,
  real: UseCases[K],
  { pending = [], failing = [], failingWith = {} }: StoryScenario,
  onPending: () => void,
): UseCases[K] => {
  if (pending.includes(name)) {
    return (() => {
      onPending();
      return new Promise(() => undefined);
    }) as UseCases[K];
  }
  const failure = failingWith[name];
  if (failure !== undefined || failing.includes(name)) {
    return (() =>
      Promise.reject(
        failure === 'storageFull'
          ? new StorageFull()
          : new Error(`${name} fails in this story`),
      )) as UseCases[K];
  }
  return real;
};

/**
 * Builds a store as the app does, on fresh in-memory fakes holding the scenario's seed, with the
 * real use cases except those the scenario holds pending or makes fail, then runs `prepare`
 * until it resolves or calls a use case held pending.
 * Returns the fakes and the reporter with it, for the screen tests.
 */
export const buildStoryStore = async (scenario: StoryScenario) => {
  const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
  if (scenario.seed) await storeFixture(unitOfWork, scenario.seed);
  const real = createUseCases({
    syncServer: new OfflineSyncServer(),
    credentials: new InMemoryCredentialStore(),
    unitOfWork,
    ids: new SequentialIdGenerator(),
  });
  // Settles when a use case held pending is called: `prepare` may be waiting on it for ever.
  let pendingCalled!: () => void;
  const reachedPending = new Promise<void>((resolve) => {
    pendingCalled = resolve;
  });
  const useCases = Object.fromEntries(
    (Object.keys(real) as UseCaseName[]).map((name) => [
      name,
      scenarioUseCase(name, real[name], scenario, pendingCalled),
    ]),
  ) as UseCases;
  const errorReporter = new RecordingErrorReporter();
  const store = createAppStore({ useCases, errorReporter });
  if (scenario.prepare) {
    await Promise.race([scenario.prepare(storeActions(store)), reachedPending]);
  }
  return { store, useCases, unitOfWork, errorReporter };
};

/** The store of a story (research R22): real use cases on fakes, set up by the scenario. */
export const createStoryStore = async (
  scenario: StoryScenario,
): Promise<AppStore> => (await buildStoryStore(scenario)).store;
