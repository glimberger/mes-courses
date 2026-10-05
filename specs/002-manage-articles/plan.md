# Implementation Plan: Manage Articles

**Branch**: `feat/002-manage-articles` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-manage-articles/spec.md`

## Summary

Let users rename an article, change its category, and delete it (with the lists it is on named
in the confirmation and an "Annuler" offered for 5 s), all from the catalog, offline, and never
half applied.

Technically: four new use cases (`editArticle`, `getArticleUsage`, `deleteArticle`,
`restoreDeletedArticle`), each write in one SQLite transaction with no schema migration; a menu on
catalog rows, an `EditArticle` screen and a delete confirmation dialog. As requested by the
maintainer, the application state of the whole app is managed with **Zustand**: one store in the
UI adapter holds every screen's `ScreenState`, the single pending undo and the app-wide snackbar,
and reloads loaded views after each write. 001's plan was revised so it is built on the same store
from the start. Synchronization with the Raspberry Pi server (constitution v2.0.0, Principle VII)
is deferred to a dedicated feature that brings 001 and 002 in line; this plan keeps every choice
compatible with it ([research.md](research.md#r7-synchronization-deferred-principle-vii)).
Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React Native through Expo SDK 57, Node.js 24 LTS
(unchanged from 001)

**Primary Dependencies**: those of [001](../001-shopping-lists/plan.md) plus `zustand` 5
([research.md](research.md#new-dependencies-principle-iv))

**Storage**: SQLite via expo-sqlite, 001's schema unchanged (no migration,
[data-model.md](data-model.md#sqlite))

**Testing**: Jest 30 (`jest-expo`), React Native Testing Library, `node:sqlite` for adapter
contract tests, dependency-cruiser; store tests on the vanilla Zustand store with in-memory fakes
and Jest fake timers

**Target Platform**: Android and iOS phones

**Project Type**: mobile app (single Expo project)

**Performance Goals**: rename or recategorize under 10 s of user time (SC-001, SC-007); delete in
3 taps (SC-002); a refresh after a write reloads local read models in milliseconds

**Constraints**: offline (FR-010); no server synchronization in this feature (deferred, R7,
Complexity Tracking); all-or-nothing writes surviving a killed app (FR-009, SC-005);
undo snapshot in memory only; French-only text in the UI adapter; no article or list name in
error reports (FR-011)

**Scale/Scope**: 4 use cases, 4 repository methods, 1 new screen, 1 dialog, 2 app-wide
snackbars, 1 store shared by every screen

No NEEDS CLARIFICATION remains.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies | Status |
|---|---|---|---|
| I | Test-First (non-negotiable) | Each use case, repository method, store action and screen behavior starts with a failing test; the store is driven by tests before any screen uses it. | ✅ |
| II | Tests as executable specification | Each scenario (002 US1-1 … US3-4) and edge case maps to a named test; UI tests query by role and French label. | ✅ |
| III | Fast, deterministic, isolated | Vanilla store built per test from a factory (no singleton); in-memory fakes; Jest fake timers for the 5 s undo; no network. | ✅ |
| IV | Simplicity (YAGNI) | One new dependency, `zustand`, justified in [research.md](research.md) R1 (cross-screen undo and refresh, maintainer's choice for the whole app); no middleware, each one ruled out in [research.md](research.md#r1b-no-zustand-middleware) R1b; no migration; refresh-everything instead of fine-grained invalidation. | ✅ |
| V | Single design system | Paper `Menu`, `Dialog`, `Snackbar`; `CategoryPicker` extracted into the shared module; `UndoSnackbar` and `NoticeSnackbar` are shared components. | ✅ |
| VI | Hexagonal architecture | Use cases and port methods in `src/application`; SQLite methods in the adapter; the store lives in `src/adapters/ui/state` and depends on use cases, never the reverse. New dependency-cruiser rules: `zustand` only under `src/adapters/ui/`; `zustand/middleware` and `immer` nowhere (R1b). | ✅ |
| VII | Remote source of truth, offline first | Local first and offline: every write goes to SQLite in one transaction, the offline UI scenario covers edit, delete and undo with `fetch` throwing, quickstart checks airplane mode. **Not met**: no synchronization with the Pi server and no reconciliation rule; deferred to a dedicated sync feature (R7), justified in Complexity Tracking. Choices kept sync-compatible: device-generated UUIDs, ids never change, each change is one transaction. | ⚠️ deviation |
| VIII | Observability | Store catches unexpected failures, reports them with `{ operation, screen }` only, and shows a French notice; no silent catch. | ✅ |
| IX | Explicit screen states | Store regions are `ScreenState` unions rendered by the shared state components; `EditArticle` reads already-loaded data, and its save outcomes are tested. No synchronization status yet: no data is synchronized until the sync feature (R7), which adds it to every data screen. | ✅ (sync status deferred with VII) |
| X | French interface, no i18n | Text only in UI components ([contracts/ui-screens.md](contracts/ui-screens.md)); store and use cases return typed results and notices. | ✅ |
| QG | Quality gates and CI | Same CI jobs as 001; architecture test gains the `zustand` rules. "Works with the server unreachable" holds trivially: no code path reaches a server. | ✅ |
| WF | Development workflow | The spec states offline behavior (FR-010) but not synchronization or reconciliation; deferred with VII (R7). | ⚠️ deviation |

**Gate result before research**: one deviation, Principle VII (and the matching workflow rule):
the feature does not synchronize with the server. It is justified in Complexity Tracking. The new
dependency is justified (Principle IV).

**Second check, after Phase 1 design**: no new violation; the Principle VII deviation stands as
justified. Points checked:

- The store holds read models and calls use cases; no business rule moved into it (R1).
- The undo snapshot is not persisted, as the spec requires a killed app to make the deletion
  final; nothing else is kept only in memory.
- Nothing in the design blocks the sync feature: ids are device UUIDs that never change,
  each change is one `UnitOfWork` transaction (where a later outbox write can join it), and no
  read model assumes the device holds the only copy. The open questions for that feature
  (propagating deletions, undo after a pushed deletion, name uniqueness across devices) are
  listed in R7.
- Revising 001's R8 to R10 changes no 001 behavior except that a new write ends a pending
  item-removal undo, which 001's spec allows ("while it is offered").

## Project Structure

### Documentation (this feature)

```text
specs/002-manage-articles/
├── plan.md              # This file
├── research.md          # Phase 0: Zustand store, transactions, undo, entry points
├── data-model.md        # Phase 1: article transitions, DeletedArticle, ArticleUsage
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── driving-ports.md # New use cases and repository methods
│   ├── ui-state.md      # Zustand store: state, actions, rules (whole app)
│   └── ui-screens.md    # EditArticle, DeleteArticleDialog, snackbars, French text
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

Additions to [001's layout](../001-shopping-lists/plan.md#source-code-repository-root):

```text
src/
├── domain/
│   └── article.ts                    # + edit rule (uniqueness among other articles)
├── application/
│   ├── ports/                        # + ArticleRepository.update/remove, ListItemRepository.forArticle/removeAllForArticle
│   ├── use-cases/                    # + edit-article, get-article-usage, delete-article, restore-deleted-article
│   └── testing/                      # fakes + contract suites for the new methods
├── adapters/
│   ├── sqlite/                       # new repository methods + contract tests
│   └── ui/
│       ├── state/                    # app-store.ts (createAppStore), provider, useAppStore + tests
│       ├── testing/                  # renderWithStore
│       ├── components/               # CategoryPicker, UndoSnackbar, NoticeSnackbar; ArticleRow menu
│       └── screens/                  # EditArticle, DeleteArticleDialog; AddArticles row menu
└── composition/                      # builds the store once and wraps the app in AppStoreProvider
.dependency-cruiser.cjs               # + zustand only under src/adapters/ui; no zustand/middleware or immer
```

**Structure Decision**: same single Expo project and hexagonal layout as 001. The store is part of
the UI adapter because it exists only to feed screens; the composition root creates it, like
every other adapter.

## Implementation notes for `/speckit-tasks`

- 001 is not implemented yet. If its tasks run first, they build the store from
  [contracts/ui-state.md](contracts/ui-state.md) for 001's regions and actions; this feature then
  only adds its actions and `deletedArticle` undo. If 002 is implemented on top of an existing
  001 codebase without the store, a first refactoring task moves 001's screens onto it with their
  tests kept green.
- Order: repository methods (contract tests on fake and SQLite) → use cases → store actions and
  undo rules → `CategoryPicker` extraction (refactor, tests green) → EditArticle (US1, US3) →
  DeleteArticleDialog and UndoSnackbar (US2) → offline scenario extension.
- US1 and US2 (P1) form the MVP; US3 (P2) reuses EditArticle and only adds the category field.
- No task touches the network or the server: synchronization belongs to the sync feature (R7).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle VII and its workflow rule: no synchronization with the Pi server, no reconciliation rule in the spec | Constitution v2.0.0 was adopted after 001 and 002 were specified; neither spec defines synchronization, and 001, which 002 builds on, has none. A dedicated sync feature (next `/speckit-specify`) defines the server port, the queue of offline changes, reconciliation and the synchronization status for 001 and 002 together. | Adding sync to 002 alone would invent reconciliation rules the spec does not state, sync articles while lists, items and categories (001) stay local, and need the server's technology and API, still undecided. Pausing 002 until sync exists blocks a local-only feature that sync does not change: its use cases, transactions and screens stay as designed. |

**Migration note** (constitution Governance): [003-server-sync](../003-server-sync/plan.md) closes
this deviation. Once 003 is implemented, every command use case of this feature records its
changes through the `ChangeRecorder` port, inside its existing transaction
([003 app-ports contract](../003-server-sync/contracts/app-ports.md#changes-to-existing-use-cases-001-and-002)).
Undoable changes are held until the undo offer ends (article deletion, R5). If this feature is already
implemented by then, 003's tasks add these calls, keeping its existing tests green.
