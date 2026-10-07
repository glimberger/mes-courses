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
import type { Repositories, UnitOfWork } from '../ports/unit-of-work';

type State = {
  categories: Map<string, Category>;
  articles: Map<string, Article>;
  lists: Map<string, ShoppingList>;
  items: Map<string, ListItem>;
  currentListId: ListId | null;
};

const emptyState = (): State => ({
  categories: new Map(),
  articles: new Map(),
  lists: new Map(),
  items: new Map(),
  currentListId: null,
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
});

const itemRef = (listId: string, articleId: string) =>
  JSON.stringify([listId, articleId]);

const findByName = <T extends { name: string }>(
  entities: Iterable<T>,
  normalized: string,
) => [...entities].find((entity) => normalizedName(entity.name) === normalized);

/** Repositories kept in memory, for domain, use case and UI tests. */
export class InMemoryRepositories implements Repositories {
  private state = emptyState();

  readonly categories: CategoryRepository = {
    all: async () =>
      [...this.state.categories.values()]
        .sort((a, b) => a.position - b.position)
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
      this.state.categories.set(category.id, { ...category });
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
      this.state.articles.set(article.id, { ...article });
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
      this.state.lists.set(list.id, { ...list });
    },
    itemCounts: async () => {
      const counts = new Map<ListId, number>();
      for (const list of this.state.lists.values()) counts.set(list.id, 0);
      for (const item of this.state.items.values()) {
        counts.set(item.listId, (counts.get(item.listId) ?? 0) + 1);
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
      this.state.items.set(
        itemRef(item.listId, item.articleId),
        copyItem(item),
      );
    },
    remove: async (listId, articleId) => {
      this.state.items.delete(itemRef(listId, articleId));
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
      this.state.currentListId = id;
    },
  };

  /** A copy of everything stored, to give back to `restore`. */
  snapshot(): State {
    return copyState(this.state);
  }

  restore(snapshot: State): void {
    this.state = copyState(snapshot);
  }
}

/**
 * Runs the work on in-memory repositories, one run at a time, and puts back what was stored
 * before a run that throws, as a rolled back transaction would.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly repositories: InMemoryRepositories) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const before = this.repositories.snapshot();
      try {
        return await work(this.repositories);
      } catch (error) {
        this.repositories.restore(before);
        throw error;
      }
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
