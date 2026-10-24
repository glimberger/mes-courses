---

description: "Task list for the bottom tab navigation and tap-to-add flow"
---

# Tasks: Bottom Tab Navigation and Tap-to-Add Flow

**Input**: Design documents from `/specs/011-tab-navigation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-screens.md

**Tests**: Each test is written first inside the task that implements it (constitution, Principle I); no test-only task. Every phase also updates stories, `required-stories.ts`, Detox E2E and story screenshots for what it touches.

**Organization**: The phases follow the sub-issues of epic #169, not the order of the user stories, so each sub-issue points at its task range. The user story of each phase is in its heading.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files)
- **[Story]**: US1 tab bar, US2 current list, US3 tap-to-add, US4 Listes, US5 Articles

Paths are under `apps/mobile/src/adapters/ui/` unless stated.

## Phase 1: Specification and mockups (sub-issue #170, wave 1)

- [X] T001 Write `specs/011-tab-navigation/spec.md` and its quality checklist
- [X] T002 Write `plan.md`, `research.md`, `data-model.md`, `quickstart.md` and `contracts/ui-screens.md`
- [X] T003 Write this `tasks.md`
- [x] T004 [P] Update `design/mockups/` with the four tab screens (Courses, add screen, Listes, Articles) and the new dialogs (row menus, article edit, delete confirmation), linked from `design/mockups/index.html`

---

## Phase 2: Tab navigation (sub-issue #171, wave 2) - User Story 1 (Priority: P1)

**Goal**: four tabs with nested stacks replace the single stack; nothing else changes.

**Independent Test**: the app opens on Courses; each tab opens; Courses -> add screen, switch tab, back, the add screen is still there.

- [ ] T005 [US1] Add `@react-navigation/bottom-tabs` (version matching React Navigation) to `apps/mobile/package.json` and the lockfile
- [ ] T006 [US1] Test first, then implement the route types: `RootTabParamList` and one param list per stack in `routes.ts`; `Catalog` route added, `EditArticle` kept until phase 5
- [ ] T007 [US1] Test first, then implement `TabBar` (Material 3, labels, icons `shopping_cart`, `format_list_bulleted`, `grocery`, `settings`, selected state, accessible labels) in `components/TabBar.tsx` with a story
- [ ] T008 [US1] Test first, then implement the tab navigator in `navigation.tsx`: Courses (`CurrentList` -> `AddArticles` -> `CreateArticle`), Listes (`Lists`), Articles (`Catalog` placeholder showing today's catalog), Réglages (`Settings` -> `Accounts`, `SignIn`, `ChoosePassword`); opens on Courses; re-tap returns to the stack root
- [ ] T009 [US1] Keep `UndoSnackbar`, `NoticeSnackbar`, `SyncAnnouncer`, `SignedOutNotice` and the per-screen `ScreenErrorBoundary` working above the tab bar; `errorReporter.setScreen` still receives the visible route name (`navigation.tsx`, `screen-tracking-reporter.ts`, tests)
- [ ] T010 [US1] Remove the "Mes listes" and "Réglages" header icons from `screens/CurrentListScreen.tsx` ("Terminer les courses" stays); update its test and stories
- [ ] T011 [US1] Update every `navigate` call to the nested routes (`screens/*.tsx`, `navigation.test.tsx`) and `required-stories.ts`
- [ ] T012 [US1] Update Detox suites in `apps/mobile/tests/e2e` (or the e2e folder in use) and story screenshots for the tab bar; run the Android suite

**Checkpoint**: the app works as before, behind four tabs.

---

## Phase 3: Courses tab (sub-issue #172, wave 3) - User Story 2 (Priority: P1)

**Goal**: shop from the list and manage a row from its menu.

**Independent Test**: set a quantity from a row menu; remove another row and undo.

- [ ] T013 [P] [US2] Test first, then implement the shared `RowMenu` (⋮ button, 48 dp target, accessible label "Actions pour <name>") in `components/RowMenu.tsx` with a story
- [ ] T014 [US2] Test first, then implement the ⋮ menu on `ListItemRow` with "Quantité…" (opens `QuantityDialog`, `change-item-quantity`) and "Retirer de la liste" (`remove-item-from-list`, `UndoSnackbar` "Annuler" -> `restore-removed-item`, no confirmation) in `components/ListItemRow.tsx` and `screens/CurrentListScreen.tsx`
- [ ] T015 [US2] Test first, then implement the extended FAB "Ajouter" to `AddArticles` and the bottom inset of the list in `screens/CurrentListScreen.tsx` (reuse `ScreenFab`)
- [ ] T016 [US2] In-cart rows: square checkbox on the left, struck-through name (`components/ListItemRow.tsx`, `BrandCheckbox.tsx`) with tests
- [ ] T017 [US2] Update stories (row menu open, in cart), `required-stories.ts`, Detox suite and story screenshots; run the Android suite

---

## Phase 4: Listes tab (sub-issue #173, wave 3) - User Story 4 (Priority: P2)

**Goal**: see the current list and switch to another.

**Independent Test**: with two lists, the chip is on the current one; tapping the other opens Courses on it.

- [ ] T018 [P] [US4] Test first, then implement the "en cours" chip and the accessible label "<name>, liste en cours" on the current list row only (`components/ListSummaryRow.tsx`, `components/Chip.tsx`, `screens/ListsScreen.tsx`)
- [ ] T019 [US4] Test first, then implement tap -> `set-current-list`, then switch to the Courses tab with its stack reset to `CurrentList` (`screens/ListsScreen.tsx`, `navigation.tsx`)
- [ ] T020 [US4] Keep the extended FAB "Nouvelle liste"; no ⋮ menu; add the bottom inset (`screens/ListsScreen.tsx`) with tests
- [ ] T021 [US4] Update stories, `required-stories.ts`, Detox suite and story screenshots; run the Android suite

---

## Phase 5: Articles tab (sub-issue #174, wave 3) - User Story 5 (Priority: P2)

**Goal**: the one place to manage articles globally.

**Independent Test**: rename an article and read the number of affected lists; delete another one and undo; create an article from the tab and check the current list is unchanged.

- [ ] T022 [P] [US5] Test first, then implement `UsageBadge` (hidden at 0; label "<name>, dans 1 liste" / "<name>, dans <n> listes") in `components/UsageBadge.tsx` with a story
- [ ] T023 [P] [US5] Test first, then implement the read use case `get-article-usage-counts` (number of lists holding each article, all articles in one unit of work) in `application/use-cases/get-article-usage-counts.ts`, wired in the composition root (`apps/mobile/src/application/`)
- [ ] T024 [P] [US5] Test first, then implement the use case `create-article` (name cleaned and unique, category must exist, no list item; same errors as `create-article-and-add-to-list`) in `application/use-cases/create-article.ts`, and the store action `createArticle` (`adapters/ui/state/edit-list-actions.ts`)
- [ ] T025 [US5] Test first, then implement `CatalogScreen`: search (`SearchField`, `searchCatalog`), grouped by category, empty categories hidden, badges from `get-article-usage-counts` (one read per load or refresh), accessible row label, explicit states, in `screens/CatalogScreen.tsx`
- [ ] T026 [US5] Test first, then add the `addToList` param to `CreateArticleScreen`: `false` in the Articles stack (no quantity fields, `createArticle`, name already used shows the message with no "add the existing article" offer; the current list is unchanged), `true` in Courses (today's behavior); extended FAB "Nouvel article" and bottom inset in `screens/CatalogScreen.tsx`, `screens/CreateArticleScreen.tsx`, `navigation.tsx`, `routes.ts`
- [ ] T027 [US5] Test first, then implement `EditArticleDialog` (name, category, note with the singular/plural text of the contract, `edit-article`, duplicate-name refusal) in `screens/EditArticleDialog.tsx`; remove `EditArticleScreen` and the `EditArticle` route
- [ ] T028 [US5] Test first, then update `DeleteArticleDialog` to state the number of affected lists with the singular/plural text of the contract; keep `delete-article` and the "Annuler" (`restore-deleted-article`) in `screens/DeleteArticleDialog.tsx`
- [ ] T029 [US5] Row menu "Modifier" / "Supprimer" with `RowMenu` in `screens/CatalogScreen.tsx`
- [ ] T030 [US5] Test first, then end the `CategoryPicker` with "+ Nouvelle catégorie" (`CreateCategoryDialog`, new category selected at once) for `CreateArticleScreen` and `EditArticleDialog` (`components/CategoryPicker.tsx`)
- [ ] T031 [US5] Remove "Modifier" and "Supprimer" from the rows of `screens/AddArticlesScreen.tsx` and update its tests
- [ ] T032 [US5] Update stories (including the catalog-only `CreateArticle`), `required-stories.ts`, Detox suite and story screenshots; run the Android suite

---

## Phase 6: Tap-to-add (sub-issue #175, wave 4) - User Story 3 (Priority: P1)

**Goal**: add several articles with one tap each.

**Independent Test**: on a list that already holds Lait, tap Carotte and Pain, tap Pain again, go back: the list holds Lait and Carotte, with no quantity and no "Annuler" snackbar shown.

- [ ] T033 [P] [US3] Test first, then implement `AddToggle` (round, `add_circle` outline -> `check_circle` filled, tinted card and border, accessible labels "Ajouter <name>" / "<name>, dans la liste, toucher pour retirer") in `components/AddToggle.tsx` with stories
- [ ] T034 [US3] Test first, then implement the visit snapshot and visit set, and the visible rows rule, in `screens/AddArticlesScreen.tsx` (hidden: on the list at open; shown: added during the visit); rows grouped under `CategoryHeader`, name only
- [ ] T035 [US3] Test first, then implement the store action `removeItemQuietly(articleId)` in `adapters/ui/state/edit-list-actions.ts`: runs `remove-item-from-list` (`ItemNotOnList` expected), releases its held changes at once, never sets `pendingUndo`; `removeItem` (row menu, with the undo snackbar) is unchanged
- [ ] T036 [US3] Test first, then implement tap -> `add-article-to-list` with no quantity, tap again -> `removeItemQuietly`; no quantity dialog, no confirm button, back arrow ← (`screens/AddArticlesScreen.tsx`)
- [ ] T037 [US3] Test first, then implement the "Créer « xyz »" row (name filled in, `addToList: true`), the return to `AddArticles` with `createdArticleId` that adds the new article to the visit set (shown marked, can be un-tapped), and the "« name » est déjà dans la liste" text with no action (`screens/AddArticlesScreen.tsx`, `screens/CreateArticleScreen.tsx`, `routes.ts`)
- [ ] T038 [US3] Remove the cart icon at the start of rows; rows use `AddToggle` on the right (`components/ArticleRow.tsx`)
- [ ] T039 [US3] Offline tests of the add screen (no network, server unreachable) and the edge case "list made current while the add screen is open"
- [ ] T040 [US3] Update stories, `required-stories.ts`, Detox suite and story screenshots; run the Android suite

---

## Dependencies & Execution Order

- Phase 1 (#170) first. Phase 2 (#171) waits for it and blocks the rest.
- Phases 3, 4 and 5 (#172, #173, #174) run in parallel after phase 2.
- Phase 6 (#175) waits for phase 5 (both edit `AddArticlesScreen.tsx`; management must live in the Articles tab before the add screen drops it, T031).
- Within a phase, a test is written and seen failing before the code of the same task.

## Implementation Strategy

Land the phases in order, one pull request per sub-issue; after phase 2 the app is behaviorally unchanged behind tabs, so each later phase is a safe increment.
