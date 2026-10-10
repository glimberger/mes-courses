import { nextHlc, type Change, type EntityKind } from '@mes-courses/sync-core';
import type { Article } from '../../domain/article';
import type { Category } from '../../domain/category';
import type { ListItem } from '../../domain/list-item';
import { normalizedName } from '../../domain/name';
import type { ListId, ShoppingList } from '../../domain/shopping-list';
import type {
  AppStateRepository,
  ArticleRepository,
  CategoryRepository,
  ListItemRepository,
  ShoppingListRepository,
} from '../ports/repositories';
import type { ChangeRecorder, PendingChange } from '../ports/change-recorder';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import {
  LOCAL_DEVICE_ID,
  initialSyncState,
  type SyncState,
  type SyncStateRepository,
} from '../ports/sync-state';
import type { PulledRowsApplier } from '../ports/pulled-rows';
import type { Repositories, UnitOfWork } from '../ports/unit-of-work';
import { FakeClock } from './fake-clock';
import { SequentialIdGenerator } from './sequential-id-generator';

type Entry = { change: PendingChange; heldBy: string | null };

type State = {
  categories: Map<string, Category>;
  articles: Map<string, Article>;
  lists: Map<string, ShoppingList>;
  items: Map<string, ListItem>;
  currentListId: ListId | null;
  outbox: Entry[];
  nextSeq: number;
  syncState: SyncState;
};

const copySyncState = (state: SyncState): SyncState => ({
  ...state,
  maxHlc: { ...state.maxHlc },
});

const copyEntry = ({ change, heldBy }: Entry): Entry => ({
  change: JSON.parse(JSON.stringify(change)) as PendingChange,
  heldBy,
});

const emptyState = (): State => ({
  categories: new Map(),
  articles: new Map(),
  lists: new Map(),
  items: new Map(),
  currentListId: null,
  outbox: [],
  nextSeq: 1,
  syncState: initialSyncState(),
});

// Every value goes in and out as a copy, as it would through storage.
const copyItem = (item: ListItem): ListItem => ({
  ...item,
  quantity: item.quantity && { ...item.quantity },
});

const copyState = (state: State): State => ({
  categories: new Map([...state.categories].map(([id, c]) => [id, { ...c }])),
  articles: new Map([...state.articles].map(([id, a]) => [id, { ...a }])),
  lists: new Map([...state.lists].map(([id, l]) => [id, { ...l }])),
  items: new Map([...state.items].map(([ref, i]) => [ref, copyItem(i)])),
  currentListId: state.currentListId,
  outbox: state.outbox.map(copyEntry),
  nextSeq: state.nextSeq,
  syncState: copySyncState(state.syncState),
});

const itemRef = (listId: string, articleId: string) =>
  JSON.stringify([listId, articleId]);

const findByName = <T extends { name: string }>(
  entities: Iterable<T>,
  normalized: string,
) => [...entities].find((entity) => normalizedName(entity.name) === normalized);

// The fakes reject what the SQLite schema rejects, so a use case that passes on them does not
// fail on a device.
const uniqueFailed = (column: string) =>
  new Error(`UNIQUE constraint failed: ${column}`);
const missingReference = () =>
  new Error('Constraint failed: the referenced row does not exist');

/** Checks the primary key and the `normalized_name UNIQUE` column of a new named entity. */
const checkNewNamed = <T extends { id: string; name: string }>(
  table: string,
  stored: Map<string, T>,
  entity: T,
) => {
  if (stored.has(entity.id)) throw uniqueFailed(`${table}.id`);
  if (findByName(stored.values(), normalizedName(entity.name))) {
    throw uniqueFailed(`${table}.normalized_name`);
  }
};

/** Repositories kept in memory, for domain, use case and UI tests. */
export class InMemoryRepositories implements Repositories {
  private state = emptyState();
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(deps: { clock?: Clock; ids?: IdGenerator } = {}) {
    this.clock = deps.clock ?? new FakeClock();
    this.ids = deps.ids ?? new SequentialIdGenerator();
  }

  readonly categories: CategoryRepository = {
    all: async () =>
      [...this.state.categories.values()]
        .sort(
          (a, b) =>
            a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        )
        .map((c) => ({ ...c })),
    findById: async (id) => {
      const found = this.state.categories.get(id);
      return found ? { ...found } : null;
    },
    findByNormalizedName: async (normalized) => {
      const found = findByName(this.state.categories.values(), normalized);
      return found ? { ...found } : null;
    },
    nextPosition: async () =>
      Math.max(
        -1,
        ...[...this.state.categories.values()].map((c) => c.position),
      ) + 1,
    add: async (category) => {
      const stored = this.state.categories;
      checkNewNamed('category', stored, category);
      stored.set(category.id, { ...category });
    },
  };

  readonly articles: ArticleRepository = {
    all: async () => [...this.state.articles.values()].map((a) => ({ ...a })),
    findById: async (id) => {
      const found = this.state.articles.get(id);
      return found ? { ...found } : null;
    },
    findByNormalizedName: async (normalized) => {
      const found = findByName(this.state.articles.values(), normalized);
      return found ? { ...found } : null;
    },
    add: async (article) => {
      checkNewNamed('article', this.state.articles, article);
      if (!this.state.categories.has(article.categoryId)) {
        throw missingReference();
      }
      this.state.articles.set(article.id, { ...article });
    },
    update: async (article) => {
      const stored = this.state.articles;
      const sameName = findByName(
        stored.values(),
        normalizedName(article.name),
      );
      if (sameName && sameName.id !== article.id) {
        throw uniqueFailed('article.normalized_name');
      }
      if (!this.state.categories.has(article.categoryId)) {
        throw missingReference();
      }
      if (stored.has(article.id)) stored.set(article.id, { ...article });
    },
    remove: async (id) => {
      if ([...this.state.items.values()].some((i) => i.articleId === id)) {
        throw new Error('Constraint failed: a list item still refers to it');
      }
      this.state.articles.delete(id);
    },
  };

  readonly lists: ShoppingListRepository = {
    all: async () => [...this.state.lists.values()].map((l) => ({ ...l })),
    findById: async (id) => {
      const found = this.state.lists.get(id);
      return found ? { ...found } : null;
    },
    findByNormalizedName: async (normalized) => {
      const found = findByName(this.state.lists.values(), normalized);
      return found ? { ...found } : null;
    },
    count: async () => this.state.lists.size,
    add: async (list) => {
      checkNewNamed('shopping_list', this.state.lists, list);
      this.state.lists.set(list.id, { ...list });
    },
    itemCounts: async () => {
      const counts = new Map<ListId, number>();
      for (const list of this.state.lists.values()) counts.set(list.id, 0);
      for (const item of this.state.items.values()) {
        const count = counts.get(item.listId);
        if (count !== undefined) counts.set(item.listId, count + 1);
      }
      return counts;
    },
  };

  readonly items: ListItemRepository = {
    forList: async (listId) =>
      [...this.state.items.values()]
        .filter((i) => i.listId === listId)
        .map(copyItem),
    find: async (listId, articleId) => {
      const found = this.state.items.get(itemRef(listId, articleId));
      return found ? copyItem(found) : null;
    },
    save: async (item) => {
      if (
        !this.state.lists.has(item.listId) ||
        !this.state.articles.has(item.articleId)
      ) {
        throw missingReference();
      }
      this.state.items.set(
        itemRef(item.listId, item.articleId),
        copyItem(item),
      );
    },
    remove: async (listId, articleId) => {
      this.state.items.delete(itemRef(listId, articleId));
    },
    forArticle: async (articleId) =>
      [...this.state.items.values()]
        .filter((i) => i.articleId === articleId)
        .map(copyItem),
    removeAllForArticle: async (articleId) => {
      for (const [ref, item] of this.state.items) {
        if (item.articleId === articleId) this.state.items.delete(ref);
      }
    },
    takeAllOutOfCart: async (listId) => {
      for (const item of this.state.items.values()) {
        if (item.listId === listId) item.inCart = false;
      }
    },
  };

  readonly appState: AppStateRepository = {
    currentListId: async () => this.state.currentListId,
    setCurrentListId: async (id) => {
      if (!this.state.lists.has(id)) throw missingReference();
      this.state.currentListId = id;
    },
  };

  readonly changes: ChangeRecorder = {
    record: async (kind, id, fields, options) => {
      const { syncState } = this.state;
      const hlc = nextHlc(
        {
          ...syncState.maxHlc,
          deviceId: syncState.deviceId ?? LOCAL_DEVICE_ID,
        },
        this.clock.nowMs(),
      );
      syncState.maxHlc = hlc;
      const seq = this.state.nextSeq;
      this.state.nextSeq += 1;
      const change = {
        seq,
        changeId: this.ids.next(),
        hlc,
        kind: kind as EntityKind,
        id,
        fields: JSON.parse(JSON.stringify(fields)) as object,
      } as PendingChange & Change;
      this.state.outbox.push({ change, heldBy: options?.heldBy ?? null });
    },
    pending: async (limit) =>
      this.state.outbox
        .filter((entry) => entry.heldBy === null)
        .slice(0, limit)
        .map((entry) => copyEntry(entry).change),
    acknowledge: async (changeIds) => {
      const acknowledged = new Set(changeIds);
      this.state.outbox = this.state.outbox.filter(
        (entry) => !acknowledged.has(entry.change.changeId),
      );
    },
    release: async (heldBy) => {
      for (const entry of this.state.outbox) {
        if (entry.heldBy === heldBy) entry.heldBy = null;
      }
    },
    releaseAll: async () => {
      for (const entry of this.state.outbox) entry.heldBy = null;
    },
    discard: async (heldBy) => {
      this.state.outbox = this.state.outbox.filter(
        (entry) => entry.heldBy !== heldBy,
      );
    },
    count: async () =>
      this.state.outbox.filter((entry) => entry.heldBy === null).length,
  };

  readonly syncState: SyncStateRepository = {
    get: async () => copySyncState(this.state.syncState),
    save: async (state) => {
      this.state.syncState = copySyncState(state);
    },
  };

  /**
   * Applies nothing and reports no effect: tests of the sync use cases spy on it or replace it,
   * and the SQLite applier has its own tests.
   */
  pulledRows: PulledRowsApplier = {
    apply: async () => ({
      deferred: 0,
      effects: { deletedArticles: [], removedItems: [], merges: [] },
    }),
  };

  /** A copy of everything stored, to give back to `restore`. */
  snapshot(): State {
    return copyState(this.state);
  }

  /** Takes the snapshot over: give it back once, and keep no reference to it. */
  restore(snapshot: State): void {
    this.state = snapshot;
  }
}

/** Wraps every method so that it rejects once `isOpen` returns false. */
const guarded = <R extends object>(repository: R, isOpen: () => boolean): R =>
  Object.fromEntries(
    Object.entries(repository).map(([name, method]) => [
      name,
      (...args: unknown[]) =>
        isOpen()
          ? (method as (...args: unknown[]) => Promise<unknown>)(...args)
          : Promise.reject(
              new Error(`Repositories used after their run ended (${name})`),
            ),
    ]),
  ) as R;

/**
 * Runs the work on in-memory repositories and puts back what was stored before a run that
 * throws, as a rolled back transaction would. Runs go one at a time, in the order they were
 * started, as on SQLite; so a run started inside another's work would wait for ever: use cases
 * never nest runs. The repositories given to the work reject once the run has ended.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly repositories: InMemoryRepositories) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.runNow(work));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async runNow<T>(
    work: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    let open = true;
    const isOpen = () => open;
    const repos = this.repositories;
    const before = repos.snapshot();
    try {
      return await work({
        categories: guarded(repos.categories, isOpen),
        articles: guarded(repos.articles, isOpen),
        lists: guarded(repos.lists, isOpen),
        items: guarded(repos.items, isOpen),
        appState: guarded(repos.appState, isOpen),
        changes: guarded(repos.changes, isOpen),
        syncState: guarded(repos.syncState, isOpen),
        pulledRows: guarded(repos.pulledRows, isOpen),
      });
    } catch (error) {
      repos.restore(before);
      throw error;
    } finally {
      open = false;
    }
  }
}
