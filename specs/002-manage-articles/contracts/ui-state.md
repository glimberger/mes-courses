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
  catalog: { query: string; view: ScreenState<CatalogView, { query: string }> };
  lists: ScreenState<ListSummary[]>;
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
| `loadCurrentList()`, `loadLists()`, `searchCatalog(query)` | Run the query use case for the region; `error` state and report on failure (operation = use case name). Also used by "Réessayer". |
| `refresh()` | Reloads every region not `idle`. Called after each successful write. |
| Write actions from 001 (`toggleItem`, `finishShopping`, `addArticleToList`, `createArticleAndAddToList`, `changeItemQuantity`, `removeItem`, `createList`, `setCurrentList`, `createCategory`) | Call the matching use case. `toggleItem` is optimistic (001 R9). `removeItem` sets `pendingUndo` to the removed item. |
| `editArticle(articleId, { name, categoryId })` | Calls `editArticle`; returns its `Result` so the screen can show field errors. |
| `getArticleUsage(articleId)` | Calls the query and returns its `Result`; nothing is stored (the dialog holds it). |
| `deleteArticle(articleId)` | Calls `deleteArticle`; on success sets `pendingUndo = { kind: 'deletedArticle', deleted }`. |
| `undo()` | Clears `pendingUndo`, then restores it (`restoreRemovedItem` or `restoreDeletedArticle`) and refreshes. On failure: stays deleted or removed, `notice = writeFailed` and a report (`storageFull` and no report for `StorageFull`). |
| `dismissUndo()` | Clears `pendingUndo` (the change becomes final). Called by the snackbar's 5 s timeout (none while a screen reader is on) and its dismissal. |
| `dismissNotice()` | Clears `notice`. |

Rules shared by every write action:

1. **Ends the undo offer first**: `pendingUndo` is cleared before the write starts (FR-006a "or
   until their next change"). Reads, navigation and `undo()` itself do not clear it beforehand.
2. **Refreshes after success**: `refresh()` runs, so every loaded region shows the change
   (FR-003, FR-008a, US2-4).
3. **Unexpected failures**: the thrown error is reported with `{ operation, screen }` only, state
   is left as it was (for an optimistic tick, the item's queued saves are dropped and the region
   is reloaded from storage, 001 R9), `notice = writeFailed` (or `storageFull`, without a report,
   when the error is `StorageFull`, 001 R12a), and the action
   resolves to `{ ok: false, error: { type: 'WriteFailed' } }` so a form stays open.
4. **Business errors** (`Result` errors): refused input (`NameError`, `NameAlreadyUsed`,
   `QuantityError`) and `AlreadyOnList` returned by `addArticleToList` (001 US2-8) are returned
   to the caller unchanged and are not reported, since the form or dialog shows them.
   `AlreadyOnList` from `restoreRemovedItem` is a failed restore (001 FR-010), handled as below. Every other `Result` error (a missing
   record or the wrong state: `ItemNotOnList`, `ArticleNotFound`, `CategoryNotFound`,
   `ListNotFound`, `NothingInCart`, ...) cannot come from the user's input: it is handled as in
   rule 3 (`notice = writeFailed`, state unchanged, resolves to `WriteFailed`) and reported as an
   `UnexpectedResult` error whose code is the result's tag, with no other content (001 FR-030,
   [001 driving ports](../../001-shopping-lists/contracts/driving-ports.md#conventions)).

## Undo timing

The undo snackbar is rendered once, at the root of the app, from `pendingUndo`, so it stays on
screen across navigation. It calls `dismissUndo()` after 5 s, except while a screen reader is on
(`AccessibilityInfo`), when only the user's dismissal or the next write ends the offer (001
FR-010, 002 FR-006a). Tests drive the delay with Jest fake timers and mock `AccessibilityInfo`
(Principle III).
