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
  When the error is a full storage (`SQLITE_FULL`, or the engine's message "database or disk
  is full", checked before the text is dropped), the adapter throws `StorageFull`, with the
  same fixed message. `StorageFull` is declared in `application/ports/storage-full.ts`, so the
  UI adapter recognizes it without importing the SQLite adapter (FR-030,
  [../research.md](../research.md) R12a).
  `migrate` throws `DataFromNewerVersion` instead when `PRAGMA user_version` is above the
  highest migration it knows, before any other statement (FR-040, R18c). It is declared in
  `application/ports/data-from-newer-version.ts` for the same reason as `StorageFull`: adapters
  never import each other ([../research.md](../research.md) R15). `StorageError` stays in the
  SQLite adapter, since no other code tells it apart from any unexpected error.
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
  setScreen(screen: string): void;
  crashNatively(): void;
}
```

- `crashNatively` exists only for the smoke test of a release build
  ([../quickstart.md](../quickstart.md) §6 step 5): the Sentry adapter crashes the app in native
  code, the console reporter prints a line, and `RecordingErrorReporter` records the call.
  Nothing else calls it.

- `setScreen` records the route shown; the navigation container calls it on every route change.
  A report whose context has no `screen`, and every error the global handlers catch (operation
  `uncaught`), carries the last screen recorded, which the Sentry adapter keeps as a global tag
  so native crashes carry it too ([../research.md](../research.md) R13).

- `context` holds only fixed technical identifiers (for example `{ operation: 'toggleItemInCart',
  screen: 'CurrentList' }`), never names, quantities or other list content (Principle VIII).
- Whatever the error, a sent report holds only the FR-030 fields (error type, error code, stack
  trace, operation, screen, app version, device model and system version, environment): the
  error's own text is removed, including for errors captured by the global handlers
  ([../research.md](../research.md) R13).
- A sent report carries no user identifier, no installation identifier and no device name; the
  device model is its only device detail (FR-030). The one exception is a native crash, built
  by the native SDKs outside the filter: it may carry the random installation id, never the
  device name or list content. Session tracking and app hang reports are off (R13).
- The same failure (error type, error code, operation and screen) is sent at most once per
  opening of the app, for `report` calls and the global handlers alike; callers still call
  `report` on every failure, and the adapter drops the repeats (FR-030, R13).
- The environment is `production` (store release) or `preview` (internal build); development
  runs and test builds have no DSN and send nothing. The version is the release
  `mes-courses@<version>+<build>` with the build number as `dist` (FR-030, R13).
- Reports raised offline are kept on the device, at most 30, the oldest dropped first, and sent
  when the network returns (FR-030a).
- Every feature reports through this one port and its one Sentry adapter, so FR-030 and FR-030a
  hold for 002 and 003 too (FR-030b). A feature's expected situations are those it does not
  pass to `report`.
- The Sentry adapter sets each event's fingerprint to the FR-030 key
  (`type | code | operation | screen`), so one kind of failure is one Sentry issue, which the
  email alerts of FR-030c rely on (R13).
- `report` and `setScreen` never throw and never block.
- Production: Sentry adapter (`apps/mobile/src/adapters/error-reporting/sentry-error-reporter.ts`), or a
  console reporter when `EXPO_PUBLIC_SENTRY_DSN` is unset. Tests: `RecordingErrorReporter`, which
  keeps reports in memory so tests can assert them.
- It is used by the UI adapter, which catches unexpected errors. Uncaught errors are captured by
  the Sentry SDK's global handlers, configured in the same adapter.
