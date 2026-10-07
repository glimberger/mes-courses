# Contract: Application State (Zustand store)

The UI adapter's application state, shared by every screen ([../research.md](../research.md)
R1). It applies to the whole app: 001's screens use it too. Code lives in
`apps/mobile/src/adapters/ui/state/`; `zustand` is imported nowhere else.

## Creation and access

```ts
createAppStore(deps: { useCases: UseCases; errorReporter: ErrorReporter }): AppStore  // zustand/vanilla createStore
<AppStoreProvider store={store}>...</AppStoreProvider>                              // React context
useAppStore<T>(selector: (state: AppState) => T): T                                  // wraps useStore(store, selector)
```

- The composition root builds one store with the production use cases. Tests build one per test
  with use cases on in-memory fakes (`renderWithStore` helper in `apps/mobile/src/adapters/ui/testing/`).
- The store is a plain vanilla store with no middleware (no `persist`, `devtools`, `immer`, ...);
  each one is ruled out in [../research.md](../research.md#r1b-no-zustand-middleware) R1b.
- Screens select the smallest slice they render, so a change to one region does not re-render
  the others.

## State

```ts
type ScreenState<T, E = never> =
  | { status: 'idle' }                         // never requested; nothing is rendered from it
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'empty'; detail: E }
  | { status: 'success'; data: T };

interface AppState {
  currentList: ScreenState<CurrentListView>;
  catalog: {
    query: string;
    full: ScreenState<CatalogView>;                          // loaded once, unfiltered (001 R11a)
    view: ScreenState<CatalogView, { query: string }>;     // full filtered by query
  };
  lists: ScreenState<ListSummary[]>;
  categories: ScreenState<Array<{ id: CategoryId; name: string }>>;  // the category picker (001 US2-7)
  pendingUndo:
    | { kind: 'removedItem'; removed: RemovedItem; name: string }
    | { kind: 'deletedArticle'; deleted: DeletedArticle }
    | null;
  notice: Notice | null;                       // app-wide snackbar
}

type Notice =
  | { type: 'writeFailed' }
  | { type: 'storageFull' }                                  // 001 FR-030, not reported
  | { type: 'articleDeletedElsewhere' }                      // 003 FR-020a, FR-008
  | { type: 'itemRemovedElsewhere' }                         // 003 FR-020a
  | { type: 'articleAdded'; name: string };
```

- `idle` is internal to the store: a screen requests its region on mount, so it only ever renders
  `loading`, `empty`, `error` or `success` (Principle IX). A refresh keeps `success` or `empty`
  data on screen until the new data arrives; `loading` is shown only for the first load and for a
  retry after an error.
- French text is produced by the components that render `ScreenState`, `pendingUndo` and
  `notice`, never by the store (Principle X).

## Actions

| Action | Behavior |
|---|---|
| `loadCurrentList()`, `loadLists()`, `loadCatalog()`, `loadCategories()` | Run the query use case for the region (`getCatalog` without a query for the catalog, on the current list, which is loaded first when no region shows it); `error` state and report on failure (operation = use case name). Also used by "Réessayer". |
| `searchCatalog(query)` | Sets `catalog.query` and derives `catalog.view` from the loaded catalog with the domain's `filterCatalog`, synchronously: no storage read, no `loading` state, no report (001 SC-011, [001 research](../../001-shopping-lists/research.md) R11a). A refresh reloads the full catalog and applies the current query again. |
| `refresh()` | Reloads every region not `idle`. Called after each successful write. |
| Write actions from 001 (`toggleItem`, `finishShopping`, `addArticleToList`, `createArticleAndAddToList`, `changeItemQuantity`, `removeItem`, `createList`, `setCurrentList`, `createCategory`) | Call the matching use case. `toggleItem` is optimistic (001 R9). `removeItem` sets `pendingUndo` to the removed item. |
| `editArticle(articleId, { name, categoryId })` | Calls `editArticle`; returns its `Result` so the screen can show field errors. |
| `getArticleUsage(articleId)` | Calls the query and returns its `Result`; nothing is stored (the dialog holds it). |
| `deleteArticle(articleId)` | Calls `deleteArticle`; on success sets `pendingUndo = { kind: 'deletedArticle', deleted }`. |
| `undo()` | Clears `pendingUndo`, then restores it (`restoreRemovedItem` or `restoreDeletedArticle`) and refreshes. On failure: stays deleted or removed, `notice = writeFailed` and a report (`storageFull` and no report for `StorageFull`). |
| `dismissUndo()` | Clears `pendingUndo` (the change becomes final). Called by the snackbar's 5 s timeout (none while a screen reader is on) and its dismissal. |
| `dismissNotice()` | Clears `notice`. |

Rules shared by every write action:

1. **One write queue**: every write action joins a single store-wide queue and runs in the
   order it was called, so changes are saved in the order the user made them (001 FR-004,
   001 R9). An optimistic tick is shown before its turn comes.
2. **Ends the undo offer on success**: a write that succeeds clears `pendingUndo`, a toggle
   included (FR-006a "or until their next change", 001 FR-010). A write that fails, or input
   refused by a form or a use case, leaves the offer as it was. An `undo()` already queued is
   carried out even if an earlier queued write ends the offer (001 R8). Reads and navigation
   never clear it.
3. **Refreshes after success**: `refresh()` runs, so every loaded region shows the change
   (FR-003, FR-008a, US2-4).
4. **Unexpected failures**: the thrown error is reported with `{ operation, screen }` only, state
   is left as it was (for an optimistic tick, the item's queued toggles are dropped and the region
   is reloaded from storage, 001 R9), `notice = writeFailed` (or `storageFull`, without a report,
   when the error is `StorageFull`, 001 R12a), and the action
   resolves to `{ ok: false, error: { type: 'WriteFailed' } }` so a form stays open.
5. **Business errors** (`Result` errors): refused input (`NameError`, `NameAlreadyUsed`,
   `QuantityError`) and `AlreadyOnList` returned by `addArticleToList` (001 US2-8) are returned
   to the caller unchanged and are not reported, since the form or dialog shows them.
   `AlreadyOnList` from `restoreRemovedItem` is a failed restore (001 FR-010), handled as below.
   `ItemNotOnList` from `removeItemFromList` or `toggleItemInCart` is a tap on an item whose
   removal was queued just before it (001 FR-004): nothing is saved, nothing is shown or
   reported, and a toggle reloads the current list. Every other `Result` error (a missing
   record or the wrong state: `ItemNotOnList`, `ArticleNotFound`, `CategoryNotFound`,
   `ListNotFound`, ...) cannot come from the user's input: it is handled as in
   rule 4 (`notice = writeFailed`, state unchanged, resolves to `WriteFailed`) and reported as an
   `UnexpectedResult` error whose code is the result's tag, with no other content (001 FR-030,
   [001 driving ports](../../001-shopping-lists/contracts/driving-ports.md#conventions)).

## Undo timing

The undo snackbar is rendered once, at the root of the app, from `pendingUndo`, so it stays on
screen across navigation. It calls `dismissUndo()` after 5 s, except while a screen reader is on
(`AccessibilityInfo`), when only the user's dismissal or the next write ends the offer (001
FR-010, 002 FR-006a). Tests drive the delay with Jest fake timers and mock `AccessibilityInfo`
(Principle III).
