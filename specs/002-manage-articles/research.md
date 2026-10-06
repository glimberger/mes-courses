# Research: Manage Articles

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

This feature builds on the stack and design of
[001-shopping-lists](../001-shopping-lists/research.md); only new or changed decisions are listed
here. The maintainer asked for Zustand to manage the application state across the whole app
(R1), so 001's R8 to R10 were revised to match. R7 records how this feature stands with
constitution v2.0.0, which makes a remote server the source of truth.

## R1. Application state with Zustand (whole app)

- **Decision**: one Zustand 5 store in the UI adapter, `apps/mobile/src/adapters/ui/state/`, holds the state
  every screen reads:
  - one `ScreenState<T>` per data region (current list, catalog with its search query, lists),
    the union of 001's R10, so Principle IX still holds;
  - `pendingUndo`, the single undoable change on offer (a removed list item from 001, or a
    deleted article from this feature);
  - `notice`, the transient message for the app-wide snackbar (typed, turned into French by the
    component that renders it).

  The store is created by a factory, `createAppStore({ useCases, errorReporter })`, built with
  `createStore` from `zustand/vanilla`. The composition root calls the factory once and passes
  the store to an `AppStoreProvider` (React context); screens read it through
  `useAppStore(selector)`, a thin wrapper over Zustand's `useStore`. There is no module-level
  singleton, so each test builds its own store (Principle III).
- **What the store does and does not do**:
  - SQLite holds the device's data (Principle VII: the local replica, read and written first;
    until the sync feature, R7, it is the only copy). The store holds read models returned
    by query use cases and calls command use cases; it never computes business rules, which stay
    in the domain and application layers.
  - After any successful write, the store reloads every region that has already been loaded
    (`refresh()`), keeping the previous data on screen while it reloads. Local SQLite reads of a
    few hundred rows take milliseconds, so reloading everything is simpler than tracking which
    view a change touches, and it covers FR-003, FR-008a and the edge case "the list shows the new
    name on its next display" without per-screen focus listeners.
  - Optimistic updates (001 R9) are store actions: update the region, call the use case, revert
    and set a `writeFailed` notice on failure.
  - No middleware ([R1b](#r1b-no-zustand-middleware)).
- **Where Zustand may be imported**: only under `apps/mobile/src/adapters/ui/`. The domain and application
  layers already cannot import npm packages (001 R15); a new dependency-cruiser rule also keeps
  `zustand` out of the other adapters and out of `apps/mobile/src/composition/` (which only calls the
  factory). The same rule forbids `zustand/middleware` and `immer` (R1b).
- **Rationale**: this feature needs state that outlives a screen:
  - the "Annuler" offer after deleting an article starts on the catalog and must stay offered,
    and end "at the next change", wherever that change is made (FR-006a);
  - renaming, recategorizing or deleting an article changes what the catalog, the current list
    and the lists overview show (FR-003, FR-008a, US2-4 item counts).

  A per-screen `useScreenData` hook (001's former R10) cannot hold either without lifting state
  into a shared container, which would rebuild a small store by hand. The maintainer chose
  Zustand for that container across the whole app, so 001 is built on it from the start rather
  than mixing two styles. Zustand is about 1 KB, has no dependencies, uses React's
  `useSyncExternalStore`, and its vanilla store is testable without rendering.
- **Testing**: store tests run against the real use cases wired on 001's in-memory fakes
  (`apps/mobile/src/application/testing/`) and a `RecordingErrorReporter`, with Jest fake timers for the 5 s
  undo. Screen tests render through a `renderWithStore` helper that builds a fresh store.
- **Alternatives considered**:
  - React context + `useReducer`: no dependency, but a hand-written store with selector
    memoization to avoid re-rendering every screen on each change.
  - Redux Toolkit: same model with more ceremony and a larger dependency.
  - TanStack Query: built for remote server state; its cache and retry features are unused with
    local SQLite.
  - Reloading on focus only (001's former R10): does not hold an undo offer across screens.

## R1b. No Zustand middleware

- **Decision**: the store is a plain vanilla store (`createStore` from `zustand/vanilla`) with no
  middleware from `zustand/middleware` and no `immer`. A dependency-cruiser rule forbids
  importing `zustand/middleware` and `immer`, so CI checks this decision like the rule on where
  `zustand` may be imported (R1).
- **Rationale**, middleware by middleware:
  - **`persist`**: SQLite holds the device's data (Principle VII, FR-009). `persist` would
    write a second copy of the state to an asynchronous key-value store (AsyncStorage or MMKV, a
    new dependency) outside SQLite's transactions, so the two could diverge after a crash.
    Persistence goes through driven ports (Principle VI), not through the UI adapter.
    Rehydrating read models at launch would show stale data as current, which Principle IX
    forbids. And persisting `pendingUndo` would keep "Annuler" available after the app is
    killed, while the spec makes the deletion final in that case (edge case).
  - **`devtools`**: it talks to the Redux DevTools browser extension, which a React Native app
    does not reach without an extra third-party bridge. The store's behavior is pinned by tests
    (Principles I and II), and React Native DevTools covers interactive debugging. Wiring it in
    would be code that no failing test requires (Principle IV).
  - **`immer`**: a new dependency (`immer`). Regions are replaced whole by the read models the
    use cases return (`refresh()`); the only nested update is the optimistic tick (001 R9), a
    small pure function with its own tests.
  - **`subscribeWithSelector`**: nothing outside React subscribes to the store; screens read it
    through `useAppStore(selector)`.
  - **`combine`, `redux`**: style helpers with no behavior; the store is typed by an explicit
    `AppState` interface and plain actions.
- **Revisit when**: a feature has a need, expressed by a test, that a middleware meets better than
  store code (for example, debugging store transitions becomes a real bottleneck). That feature's
  plan then justifies the addition and lifts the dependency-cruiser rule for it. State that must
  survive a restart always goes through a port to SQLite, never through `persist`.
- **Alternatives considered**: `persist` for the current list region to speed up launch (001's
  SC-001 is met by reading SQLite directly, and stale data would break Principle IX); `immer` for
  readability (one nested update does not justify a dependency).

## R2. All-or-nothing article changes (FR-008a, FR-009, SC-005)

- **Decision**: `editArticle`, `deleteArticle` and `restoreDeletedArticle` each run in one
  `UnitOfWork.run` transaction (001's driven port). `editArticle` validates the name and the
  category before writing, then writes name and category in one update, so a refused name changes
  nothing (US3-3).
- **Rationale**: SQLite transactions make a killed app see either the whole change or none of it,
  with no new mechanism.

## R3. Name uniqueness when renaming (FR-002, US1-4, US1-5)

- **Decision**: reuse `validateName` and `normalizedName` (001 R6). The rename is refused with
  `NameAlreadyUsed` only when `findByNormalizedName` returns a **different** article. Renaming
  "Lait" to "lait" or " Lait " finds the article itself and is accepted; the name is stored
  cleaned (001 R6).
- **Rationale**: the rule stays in the domain/use case; the `UNIQUE` index on `normalized_name`
  remains the safety net.

## R4. Deleting an article and its list items (FR-005, FR-006, FR-007)

- **Decision**: `deleteArticle` reads the article and its list items, removes the list items,
  then the article, in one transaction, and returns a `DeletedArticle` snapshot. No schema
  migration: the reference from `list_item.article_id` to `article` stays `NO ACTION` (the
  default), so an article can never be removed while an item still refers to it; that is the
  safety net for the explicit deletion order. Categories and lists are untouched (FR-005). Once the deletion is final, the
  row is gone, so the name is free again (FR-007).
- **Alternatives considered**: `ON DELETE CASCADE` through a migration (rebuilding `list_item` in
  SQLite for an effect the use case needs to snapshot anyway); a soft-delete flag (every query
  would have to filter it, and the name would stay taken).

## R5. Undo after deleting an article (FR-006a, edge cases)

- **Decision**: the snapshot lives only in the store's `pendingUndo` (R1), never on disk.
  - `restoreDeletedArticle(snapshot)` re-inserts the article with its **same id**, name and
    category, then each list item with its quantity and ticked state, in one transaction
    (US2-5, SC-006).
  - The offer ends after 5 s (`setTimeout`, driven by Jest fake timers in tests; no timeout
    while a screen reader is on, [001 research](../001-shopping-lists/research.md) R8), when the
    user dismisses the snackbar, or when any other write action starts: every store action that writes
    first clears `pendingUndo` (US2-6). Navigation and reads do not end it.
  - A killed app loses the in-memory snapshot, so the deletion is final (edge case).
  - If the restore fails, the article stays deleted, a `writeFailed` notice is shown and the
    error is reported (edge case).
  - One undo slot for the whole app: a new undoable change (an item removal from 001 or another
    article deletion) replaces the previous offer, which becomes final. 001's item-removal undo
    follows the same rule (revised 001 R8).
- **Rationale**: matches 001's undo (real, immediate write; restore by re-inserting) and the
  spec's "final when the app is killed" rule with no extra storage.

## R6. Where the actions are offered (FR-001, FR-008, SC-001, SC-002, SC-007)

- **Decision**: on the catalog (`AddArticles` screen, browsing and search results), each
  `ArticleRow` gets a trailing icon button "Plus d'actions" opening a Paper `Menu` with
  "Modifier" and "Supprimer", also exposed as accessibility actions. "Modifier" opens a new
  `EditArticle` screen (name field and category picker, the same components as `CreateArticle`);
  "Supprimer" opens a confirmation dialog. Deleting takes 3 taps (menu, "Supprimer", confirm),
  meeting SC-002. Actions from a list item stay out of scope (spec Assumptions).
- **Rationale**: one place, reusing the shared `NameField` and the category picker extracted from
  `CreateArticle` into the shared UI module (Principle V).

## R7. Synchronization deferred (Principle VII)

> **Resolved by [003-server-sync](../003-server-sync/research.md)**, which answers each open
> question below (research R6 to R13 there).

- **Decision**: this feature does not synchronize with the Raspberry Pi server. Constitution
  v2.0.0 makes the server's database the source of truth, but neither this spec nor 001's
  defines synchronization or reconciliation, and 001 has no server port. A dedicated sync feature
  brings 001 and 002 in line together. The deviation is justified in the plan's Complexity
  Tracking.
- **Kept compatible with sync** (no extra code, Principle IV):
  - ids are UUIDs generated on the device (001 R5) and never change, so a server can match
    records across devices;
  - each change (edit, delete, restore) is one `UnitOfWork` transaction, so a later outbox of
    pending changes can be written in the same transaction and never diverge from the data;
  - read models and screens never assume the device holds the only copy.
- **Open questions for the sync feature's spec**, raised by this design:
  - *Deletions*: a hard delete (R4) leaves no trace to send to the server. The sync feature
    records the deletion (an outbox entry or a tombstone table) in the same transaction; R4's
    reasons against a soft-delete flag on `article` still hold for that.
  - *Undo*: a deletion pushed before "Annuler" is tapped is followed by a restore with the same
    id; the server must accept it, or deletions are pushed only once the undo offer ends.
  - *Name uniqueness*: two devices can create or rename articles to the same normalized name
    offline (FR-002); reconciliation must define which one wins or how they merge.
  - *Concurrent edit and delete*: a rename on one device and a deletion on another.
  - *Edit atomicity*: name and category edited together (FR-008a) travel as one change.
- **Alternatives considered**: synchronize articles in this feature (rules not in the spec, server
  API undecided, lists and items of 001 still local); add an outbox now (code no test requires
  while nothing reads it).

## New dependencies (Principle IV)

| Dependency | Why it is needed |
|---|---|
| `zustand` (5.x) | Application state shared across screens: pending undo and reload after article changes (R1). Chosen by the maintainer for the whole app. |
