# Contract: Driven Ports

Interfaces the application layer requires from the outside, declared in
`apps/mobile/src/application/ports/` (Principle VI). Each has an in-memory fake under
`apps/mobile/src/application/testing/` used by domain and use-case tests, and a production adapter
tested against the real technology.

## `UnitOfWork`

```ts
interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;   // one transaction
}

interface Repositories {
  categories: CategoryRepository;
  articles: ArticleRepository;
  lists: ShoppingListRepository;
  items: ListItemRepository;
  appState: AppStateRepository;
}
```

Every use case that writes runs inside `run`, so a multi-step write (seed, create-and-add) is
all-or-nothing. Production: `withTransactionAsync` of the SQLite database.

## Repositories

```ts
interface CategoryRepository {
  all(): Promise<Category[]>;                        // ordered by position
  findById(id: CategoryId): Promise<Category | null>;
  findByNormalizedName(normalizedName: string): Promise<Category | null>;
  nextPosition(): Promise<number>;
  add(category: Category): Promise<void>;
}

interface ArticleRepository {
  all(): Promise<Article[]>;
  findById(id: ArticleId): Promise<Article | null>;
  findByNormalizedName(normalizedName: string): Promise<Article | null>;
  add(article: Article): Promise<void>;
}

interface ShoppingListRepository {
  all(): Promise<ShoppingList[]>;
  findById(id: ListId): Promise<ShoppingList | null>;
  findByNormalizedName(normalizedName: string): Promise<ShoppingList | null>;
  count(): Promise<number>;
  add(list: ShoppingList): Promise<void>;
  itemCounts(): Promise<Map<ListId, number>>;
}

interface ListItemRepository {
  forList(listId: ListId): Promise<ListItem[]>;
  find(listId: ListId, articleId: ArticleId): Promise<ListItem | null>;
  save(item: ListItem): Promise<void>;               // insert or update
  remove(listId: ListId, articleId: ArticleId): Promise<void>;
  takeAllOutOfCart(listId: ListId): Promise<void>;
}

interface AppStateRepository {
  currentListId(): Promise<ListId | null>;            // null only before initializeStore
  setCurrentListId(id: ListId): Promise<void>;
}
```

- Production adapter: `apps/mobile/src/adapters/sqlite/`, written against the `SqlDatabase` interface
  (`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync`). It is the
  expo-sqlite database in the app and a `node:sqlite` wrapper in adapter tests
  ([../research.md](../research.md) R4).
- Every error thrown by the database is rethrown by the adapter as a `StorageError` with a fixed
  message ("Storage operation failed") and the SQLite result code when there is one; its own
  stack is captured at the rethrow, and the original error, message and stack are dropped, so
  no stored value reaches a report (FR-030, [../research.md](../research.md) R13).
  `migrate` throws `DataFromNewerVersion` instead when `PRAGMA user_version` is above the
  highest migration it knows, before any other statement (FR-040, R18c).
- Contract tests: one shared suite per repository runs against both the in-memory fake and the
  SQLite adapter, so the fake cannot drift from the real behavior.

## `IdGenerator`

```ts
interface IdGenerator { next(): string; }
```

Production: `expo-crypto` `randomUUID()`. Tests: sequential fake (`"id-1"`, `"id-2"`, ...).

## `ErrorReporter`

```ts
interface ErrorReporter {
  report(error: unknown, context: { operation: string; screen?: string }): void;
}
```

- `context` holds only fixed technical identifiers (for example `{ operation: 'toggleItemInCart',
  screen: 'CurrentList' }`), never names, quantities or other list content (Principle VIII).
- `report` never throws and never blocks.
- Production: Sentry adapter (`apps/mobile/src/adapters/error-reporting/sentry-error-reporter.ts`), or a
  console reporter when `EXPO_PUBLIC_SENTRY_DSN` is unset. Tests: `RecordingErrorReporter`, which
  keeps reports in memory so tests can assert them.
- It is used by the UI adapter, which catches unexpected errors. Uncaught errors are captured by
  the Sentry SDK's global handlers, configured in the same adapter.
