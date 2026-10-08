---

description: "Task list for feature 002-manage-articles"
---

# Tasks: Manage Articles

**Input**: Design documents from `specs/002-manage-articles/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md), and an
implemented 001 ([001 tasks](../001-shopping-lists/tasks.md)): the store, the repositories with
their contract suites, `ArticleRow`, `NameField`, `CreateArticleScreen`, `AddArticlesScreen`,
`UndoSnackbar`, the offline scenario, Storybook with `createStoryStore` and the story test, and
the Detox workspace `tests/e2e/` with 001's journeys all exist
([001 research](../001-shopping-lists/research.md) R22, R23).

**Tests**: REQUIRED. Test-Driven Development is non-negotiable (constitution Principle I). Run
each test task, confirm it fails for the expected reason (Red), then do the matching
implementation task (Green), then refactor with the suite green. Test names carry the scenario id
with the feature prefix, for example `"002 US1-4 renaming to an existing name is refused"`, so
[quickstart.md](quickstart.md) can find them.

**Organization**: tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1 rename, US2 delete, US3 change category)
- Every task names the exact file(s) it touches

## Path Conventions

Same `apps/mobile/` workspace and layout as 001 ([plan.md](plan.md#source-code-repository-root)); commands
run from the repository root. Tests sit next to the code they cover as `*.test.ts(x)`, stories as
`*.stories.tsx`; the new journeys go in `tests/e2e/journeys/`. The stories and journeys to add are
listed in [contracts/ui-screens.md](contracts/ui-screens.md#stories-and-end-to-end-journeys).

## Rules that apply to every task

- **No network, no server**: synchronization is deferred ([research.md](research.md) R7).
- **No schema migration**: the writes use 001's schema ([data-model.md](data-model.md#sqlite)).
- **Every write is one `UnitOfWork.run` transaction**: edit, delete and restore are all or nothing (FR-009, SC-005).
- **French text only in the UI adapter**. The use cases return the tagged errors of [data-model.md](data-model.md#article-changed). UI tests assert the exact text of [contracts/ui-screens.md](contracts/ui-screens.md).
- **Error reports** carry `{ operation: 'editArticle' | 'getArticleUsage' | 'deleteArticle' | 'restoreDeletedArticle', screen: 'AddArticles' | 'EditArticle' }` only, never an article or list name (FR-011).
- **The store stays middleware-free**: `zustand` is used only under `apps/mobile/src/adapters/ui/`, with no `zustand/middleware` and no `immer` ([research.md](research.md) R1b). 001's architecture test already enforces this.
- **Stories and journeys** follow 001's rules: story data from `createStoryStore`, form errors through the screen's presentational form component; journeys from a fresh install, by French text and label, no `testID`, no sleeps, no retries.

---

## Phase 1: Setup

**Purpose**: start from a green 001 baseline.

- [X] T001 Branch from `origin/main` (`git fetch`, then `git switch -c feat/002-manage-articles origin/main`) with 001 merged. Run `yarn typecheck && yarn lint && yarn format:check && yarn test && yarn test:architecture` and `yarn test:e2e:android` and confirm it is all green before any change.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the new repository methods, the row menu and the shared category picker that every
story uses.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Repository methods ([contracts/driving-ports.md](contracts/driving-ports.md#driven-port-changes))

- [X] T002 Extend `apps/mobile/src/application/testing/contracts/article-repository.contract.ts` with failing cases:
  - `update(article)` changes the name, the normalized name and the category, and `findByNormalizedName` finds it under the new name only;
  - `remove(id)` deletes the article;
  - `remove(id)` rejects while a list item still refers to it.
- [X] T003 Extend `apps/mobile/src/application/testing/contracts/list-item-repository.contract.ts` with failing cases:
  - `forArticle(articleId)` returns the article's items on every list, with `inCart` and `quantity`;
  - `removeAllForArticle(articleId)` removes them all and leaves other articles' items untouched.
- [X] T004 Add `ArticleRepository.update(article: Article): Promise<void>` and `remove(id: ArticleId): Promise<void>`, and `ListItemRepository.forArticle(articleId): Promise<ListItem[]>` and `removeAllForArticle(articleId): Promise<void>` to `apps/mobile/src/application/ports/repositories.ts`. Implement them in the fakes in `apps/mobile/src/application/testing/in-memory-repositories.ts`, where `remove` throws while an item refers to the article, to turn T002–T003 green against the fakes.
- [X] T005 Implement the same methods in `apps/mobile/src/adapters/sqlite/article-repository.ts` and `apps/mobile/src/adapters/sqlite/list-item-repository.ts` to turn T002–T003 green against SQLite in `apps/mobile/src/adapters/sqlite/sqlite-repositories.test.ts`. Wrap every database call with `toStorageError` (001 R13), and add one test there: a failing `remove` rejects with a `StorageError` whose message and stack hold no article name. The SQL:
  - edit: `UPDATE article SET name = ?, normalized_name = ?, category_id = ? WHERE id = ?`;
  - remove items: `DELETE FROM list_item WHERE article_id = ?`;
  - remove article: `DELETE FROM article WHERE id = ?`, where the `NO ACTION` reference from `list_item` makes it fail while an item is left ([research.md](research.md) R4).

### Shared UI ([contracts/ui-screens.md](contracts/ui-screens.md#shared-components-new-or-changed))

- [X] T006 [P] Write failing tests for the row menu in `apps/mobile/src/adapters/ui/components/article-row.test.tsx`:
  - a trailing icon button labelled "Plus d'actions pour « {name} »" opens a `Menu` with "Modifier" and "Supprimer";
  - choosing them calls `onEdit` / `onDelete`;
  - both are also accessibility actions of the row;
  - tapping the row itself still calls `onPress` (001's QuantityDialog);
  - the button is ≥ 48 dp.
- [X] T007 [P] Add the trailing menu button, the Paper `Menu` and the accessibility actions to `apps/mobile/src/adapters/ui/components/ArticleRow.tsx` to turn T006 green.
- [X] T008 [P] Extract the category picker from `apps/mobile/src/adapters/ui/screens/CreateArticleScreen.tsx` into `apps/mobile/src/adapters/ui/components/CategoryPicker.tsx`. It is a radio list of all categories by position plus "Nouvelle catégorie" (CreateCategoryDialog), with a new category preselected. This is a refactoring step: 001's CreateArticle tests stay green unchanged. Then add `apps/mobile/src/adapters/ui/components/category-picker.test.tsx`, covering the order, the selection, and the preselection of a new category.
- [X] T009 Add `Components/CategoryPicker/Default` and `Components/CategoryPicker/NewCategorySelected` to `apps/mobile/src/adapters/ui/required-stories.ts` and see the story test fail. Then write `apps/mobile/src/adapters/ui/components/CategoryPicker.stories.tsx` from 001's fixtures (categories by position; a newly created category selected) to turn it green. Review it in Storybook in light and dark mode.

**Checkpoint**: new repository methods green on fakes and SQLite; catalog rows offer
"Modifier" / "Supprimer" (wired in the stories); 001's suite still green.

---

## Phase 3: User Story 1 - Rename an article (Priority: P1) 🎯 MVP

**Goal**: rename an article from the catalog; the new name shows everywhere, with each list
item's quantity and ticked state kept.

**Independent Test**: create an article and put it on two lists, with different quantities and
ticked on one. Rename it, and check both lists show the new name with their quantities and
ticked states unchanged.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [ ] T010 [US1] Write the failing journey `tests/e2e/journeys/rename-article.e2e.ts` ([contracts/ui-screens.md](contracts/ui-screens.md#stories-and-end-to-end-journeys)): on a fresh install, create "Lait", add it to "Ma liste" with "2" "L" and tick it, create "Barbecue" and add "Lait" there; from the catalog, "Plus d'actions pour « Lait »" → "Modifier", rename it "Lait demi-écrémé", save; both lists show the new name with the ticked state and quantity kept; `device.terminateApp()` then `device.launchApp({ newInstance: true })`: still renamed (002 US1-1, US1-2, SC-005). Run `yarn test:e2e:android` and confirm it fails on the missing menu.
- [ ] T011 [P] [US1] Add failing tests for the edit rule to `apps/mobile/src/application/use-cases/unique-name.test.ts`, where 001 keeps the shared naming rule (`uniqueName`). The name follows 001's rules: "cleaned, non-blank, ≤ 60 characters". With a new optional "ignore" argument, uniqueness is "by `normalizedName` among **other** articles":
  - a name used by another article → `NameAlreadyUsed` carrying that article (002 US1-4: " beurre " while "Beurre" exists);
  - the article's own name with a different case or spaces is accepted (002 US1-5: "Lait" → "lait", and "Pommes de terre" → "Pommes  de terre");
  - `NameRequired` / `NameTooLong` (002 US1-6).
- [ ] T012 [P] [US1] Write failing use case tests in `apps/mobile/src/application/use-cases/edit-article.test.ts`, on 001's fakes:
  - 002 US1-1: the catalog shows the new name and not the old one;
  - 002 US1-2: both lists show the new name, each keeping its quantity and `inCart`;
  - 002 US1-3: searching "demi" and "Lait" both find it;
  - 002 US1-4 / US1-5 / US1-6: as in T011, and on any error nothing is written;
  - 002 US1-8: the item moves to its new alphabetical place in its category;
  - `ArticleNotFound`;
  - the name is stored cleaned: "  Lait   demi-écrémé " → "Lait demi-écrémé".
- [ ] T013 [P] [US1] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.edit-article.test.ts`:
  - `editArticle(articleId, { name, categoryId })` clears `pendingUndo` first;
  - it returns the use case `Result` unchanged and does not report business errors;
  - on success it refreshes every loaded region, so `currentList`, `catalog` and `lists` show the new name (edge case "renamed while a list is on screen");
  - on a throw it reports `{ operation: 'editArticle', screen: 'EditArticle' }`, sets `notice = writeFailed` and resolves to `{ ok: false, error: { type: 'WriteFailed' } }`.
- [ ] T014 [US1] Write failing screen tests in `apps/mobile/src/adapters/ui/screens/edit-article-screen.test.tsx`, through `renderWithStore`:
  - Appbar "Modifier l'article" with a back action, `NameField` "Nom" prefilled, and the button "Enregistrer";
  - success goes back to AddArticles with no snackbar, and the row shows the new name;
  - 002 US1-4: "Un article « Beurre » existe déjà.";
  - 002 US1-6: "Indiquez un nom." and "Le nom ne peut pas dépasser 60 caractères.";
  - after a refused save, the field keeps what was typed and the stored name is unchanged;
  - 002 US1-7: back without saving changes nothing;
  - `ArticleNotFound` or a throw: the screen stays open with "La modification n'a pas pu être enregistrée.", reported.
- [ ] T015 [US1] Write failing tests in `apps/mobile/src/adapters/ui/screens/add-articles-screen.test.tsx`: "Plus d'actions" → "Modifier" opens EditArticle for that article (FR-001), both while browsing by category and in search results; after saving, the search results show the new name (002 US1-3).

### Implementation for User Story 1

- [ ] T016 [P] [US1] Extend `uniqueName` in `apps/mobile/src/application/use-cases/unique-name.ts` with an optional `isSelf: (existing: T) => boolean` argument: a match for which it returns true is not a conflict. Do not add a second uniqueness rule in the domain. This turns T011 green ([research.md](research.md) R3).
- [ ] T017 [US1] Implement `editArticle(articleId, { name, categoryId })` in `apps/mobile/src/application/use-cases/edit-article.ts`, per [contracts/driving-ports.md](contracts/driving-ports.md): validate everything before writing, then one `articles.update` inside `UnitOfWork.run`. This turns T012 green. Add it to `UseCases` in `apps/mobile/src/adapters/ui/use-cases.ts` and to `apps/mobile/src/composition/composition-root.ts`.
- [ ] T018 [US1] Add the `editArticle` action to `apps/mobile/src/adapters/ui/state/app-store.ts`, through the shared write rules, to turn T013 green.
- [ ] T019 [US1] Implement `apps/mobile/src/adapters/ui/screens/EditArticleScreen.tsx` with the name field only; the category field comes in US3, and saving passes the current `categoryId`. Register the `EditArticle` route (param `articleId`) in `apps/mobile/src/adapters/ui/navigation.tsx`. This turns T014 green.
- [ ] T020 [US1] Wire `onEdit` of `ArticleRow` in `apps/mobile/src/adapters/ui/screens/AddArticlesScreen.tsx` to navigate to EditArticle, to turn T015 green.
- [ ] T021 [US1] Add `Screens/EditArticle/Default`, `.../NameAlreadyUsed` and `.../NameRequired` to `required-stories.ts` and see the story test fail. Then write `apps/mobile/src/adapters/ui/screens/EditArticleScreen.stories.tsx`: Default renders the screen for "Lait" from a `createStoryStore` scenario; the two error stories render the screen's presentational form (001's convention) with "Un article « Beurre » existe déjà." and "Indiquez un nom.". Turn the test green and review the stories in Storybook on both platforms.
- [ ] T022 [US1] Make `rename-article.e2e.ts` (T010) green with `yarn test:e2e:android` and `yarn test:e2e:ios`, with 001's journeys still green. Any production fix starts with its own failing unit or screen test.

**Checkpoint**: renaming works end to end, offline, and every list shows the new name.

---

## Phase 4: User Story 2 - Delete an article (Priority: P1) 🎯 MVP

**Goal**: delete an article from the catalog after a confirmation that names its lists. It
disappears from the catalog and every list, and "Annuler" restores everything for 5 seconds.

**Independent Test**: delete an article on no list. Delete one that is on two lists, and check
the catalog and the lists. Delete a third one and undo, and check it is back everywhere as it was.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [ ] T023 [US2] Write the failing journey `tests/e2e/journeys/delete-article.e2e.ts`: on a fresh install, create "Lait" and put it on "Ma liste" (ticked, "2" "L") and on "Barbecue"; from the catalog, "Plus d'actions pour « Lait »" → "Supprimer": the dialog reads "Il est dans les listes « Barbecue » et « Ma liste » et en sera retiré." (in the order the use case returns); confirm; the lists no longer show it; on the current list tap "Annuler" in "« Lait » supprimé": it is back on both lists, ticked with "2 L" on "Ma liste" (002 US2-1, US2-3, US2-5). Confirm it fails.
- [ ] T024 [P] [US2] Write failing use case tests in `apps/mobile/src/application/use-cases/get-article-usage.test.ts`:
  - it returns `ArticleUsage = { article: { id, name }, lists: Array<{ id, name }> }`, with the lists holding the article "sorted by name with 001's `compareNames` (numbers by value)" (FR-006, 002 US2-3);
  - an article on no list gives an empty `lists`;
  - `ArticleNotFound`.
- [ ] T025 [P] [US2] Write failing use case tests in `apps/mobile/src/application/use-cases/delete-article.test.ts`:
  - 002 US2-1: the article is gone from the catalog, its category and search;
  - 002 US2-4: it is gone from both lists, and `remainingCount` and `itemCount` drop;
  - FR-005: the category and the lists remain;
  - it returns `DeletedArticle = { article: { id, name, categoryId }, items: Array<{ listId, inCart, quantity: Quantity | null }> }`;
  - 002 US2-8: deleting the last article of a category leaves the category, and the catalog shows it empty;
  - `ArticleNotFound`;
  - a failure midway leaves the article and every item as they were (one transaction, SC-005).
- [ ] T026 [P] [US2] Write failing use case tests in `apps/mobile/src/application/use-cases/restore-deleted-article.test.ts`:
  - 002 US2-5 / SC-006: the article comes back with the **same id**, name and category, and back on "Ma liste" (2 L, ticked) and "Barbecue" (no quantity, unticked);
  - it runs in one transaction;
  - a storage failure throws.

  Also add to `apps/mobile/src/application/use-cases/create-article-and-add-to-list.test.ts`: 002 US2-7 / FR-007, once the deletion is final, creating "Houmous" again succeeds as a new article.
- [ ] T027 [P] [US2] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.delete-article.test.ts`:
  - `getArticleUsage` returns the `Result` and stores nothing;
  - `deleteArticle` on success replaces any pending offer: it sets `pendingUndo = { kind: 'deletedArticle', deleted }` and refreshes;
  - `undo()` with a `deletedArticle` clears the offer, calls `restoreDeletedArticle` and refreshes;
  - if the restore throws, the article stays deleted, `notice = writeFailed`, and the error is reported with `{ operation: 'restoreDeletedArticle' }` (edge case);
  - 002 US2-6: any other write that succeeds ends the offer, and a failed write or refused input leaves it (001 FR-010);
  - a new deletion or an item removal replaces the offer;
  - `dismissUndo()` ends it;
  - a store built afresh on the same fakes, standing for a killed app, has `pendingUndo = null`: the deletion is final (edge case).
- [ ] T028 [P] [US2] Write failing tests for the French list join in `apps/mobile/src/adapters/ui/components/join-french.test.ts`: `["A"]` → "« A »", `["A","B"]` → "« A » et « B »", `["A","B","C"]` → "« A », « B » et « C »".
- [ ] T029 [P] [US2] Extend `apps/mobile/src/adapters/ui/components/undo-snackbar.test.tsx` with failing tests:
  - `deletedArticle` shows "« Lait » supprimé" with "Annuler" calling `undo`;
  - it is dismissed after 5 s (Jest fake timers, 002 US2-6), but not while a screen reader is on (mocked `AccessibilityInfo`, FR-006a);
  - it stays visible after navigating from AddArticles to CurrentList.
- [ ] T030 [US2] Write failing tests in `apps/mobile/src/adapters/ui/screens/delete-article-dialog.test.tsx`:
  - the title is "Supprimer « {name} » ?";
  - the body for no list is "L'article sera retiré du catalogue.";
  - the body for one list is "Il est dans la liste « Ma liste » et en sera retiré.";
  - the body for several lists is "Il est dans les listes « Barbecue » et « Ma liste » et en sera retiré." (002 US2-3);
  - 002 US2-2: "Annuler" closes the dialog and changes nothing;
  - 002 US2-1 / US2-4: "Supprimer" deletes and closes;
  - an unexpected delete failure closes the dialog, changes nothing and shows "La modification n'a pas pu être enregistrée.", reported.
- [ ] T031 [US2] Write failing tests in `apps/mobile/src/adapters/ui/screens/add-articles-screen.test.tsx`:
  - "Plus d'actions" → "Supprimer" loads the usage and opens DeleteArticleDialog;
  - if loading the usage fails: `writeFailed` snackbar, reported with `{ operation: 'getArticleUsage', screen: 'AddArticles' }`;
  - SC-002: deleting takes 3 taps (menu, "Supprimer", confirm);
  - 002 US2-8: the emptied category shows "Aucun article dans cette catégorie";
  - 002 US2-5: "Annuler" brings the article back in the catalog and on both lists.

### Implementation for User Story 2

- [ ] T032 [US2] Implement `getArticleUsage` in `apps/mobile/src/application/use-cases/get-article-usage.ts` to turn T024 green.
- [ ] T033 [US2] Implement `deleteArticle` in `apps/mobile/src/application/use-cases/delete-article.ts` to turn T025 green. Inside one `UnitOfWork.run`: read the article and `items.forArticle`, then `items.removeAllForArticle`, then `articles.remove`, then return the snapshot ([research.md](research.md) R4).
- [ ] T034 [US2] Implement `restoreDeletedArticle` in `apps/mobile/src/application/use-cases/restore-deleted-article.ts` to turn T026 green. Inside one `UnitOfWork.run`: `articles.add` with the same id, then `items.save` for each item. Add T032–T034 to `UseCases` and to `apps/mobile/src/composition/composition-root.ts`.
- [ ] T035 [US2] Add the `getArticleUsage` and `deleteArticle` actions and the `deletedArticle` branch of `undo()` to `apps/mobile/src/adapters/ui/state/app-store.ts`, and widen `pendingUndo` to `{ kind: 'deletedArticle'; deleted: DeletedArticle }`. This turns T027 green.
- [ ] T036 [P] [US2] Implement `joinFrench` in `apps/mobile/src/adapters/ui/components/join-french.ts` to turn T028 green.
- [ ] T037 [P] [US2] Add the `deletedArticle` text to `apps/mobile/src/adapters/ui/components/UndoSnackbar.tsx` to turn T029 green.
- [ ] T038 [US2] Implement `apps/mobile/src/adapters/ui/screens/DeleteArticleDialog.tsx` (Paper `Dialog` in a `Portal`) to turn T030 green.
- [ ] T039 [US2] Wire `onDelete` of `ArticleRow` in `apps/mobile/src/adapters/ui/screens/AddArticlesScreen.tsx` (load usage, then open the dialog) to turn T031 green.
- [ ] T040 [US2] Add `Components/UndoSnackbar/DeletedArticle`, `Dialogs/DeleteArticleDialog/NoList`, `.../OneList` and `.../SeveralLists` to `required-stories.ts` and see the story test fail. Then extend `apps/mobile/src/adapters/ui/components/UndoSnackbar.stories.tsx` (a `prepare` that deletes an article) and write `apps/mobile/src/adapters/ui/screens/DeleteArticleDialog.stories.tsx` (an article on no list, on one list, on three lists) to turn it green. Review them in Storybook on both platforms, light and dark.
- [ ] T041 [US2] Make `delete-article.e2e.ts` (T023) green with `yarn test:e2e:android` and `yarn test:e2e:ios`, every earlier journey still green.

**Checkpoint**: US1 + US2 form the MVP. Rename and delete work everywhere, offline, with the
5-second undo.

---

## Phase 5: User Story 3 - Change an article's category (Priority: P2)

**Goal**: change the category where the name is edited. The article moves to the new category
in the catalog and on every list, and name and category are saved together or not at all.

**Independent Test**: put an article on a list, change its category, and check it appears under
the new category heading on the list and in the catalog.

### Tests for User Story 3 ⚠️ (write first, confirm they fail)

- [ ] T042 [P] [US3] Extend `apps/mobile/src/application/use-cases/edit-article.test.ts` with failing tests:
  - 002 US3-1: "Houmous" moved from "Épicerie salée" to "Crèmerie" shows under "Crèmerie" in the catalog and on "Ma liste", with its quantity and `inCart` kept;
  - 002 US3-2: when it was the only "Épicerie salée" item on "Ma liste", that section is gone from the list view;
  - 002 US3-3: name and category are applied together, and with a taken name neither is applied;
  - an unknown category → `CategoryNotFound` with nothing written (FR-008).
- [ ] T043 [US3] Extend `apps/mobile/src/adapters/ui/screens/edit-article-screen.test.tsx` with failing tests:
  - `CategoryPicker` shows every category with the current one selected;
  - 002 US3-1: saving another category moves the article on CurrentList;
  - 002 US3-3: a taken name with a new category shows the name error and changes neither;
  - 002 US3-4: a category created from "Nouvelle catégorie" is offered and preselected;
  - SC-007: change the category in at most 4 taps from the catalog (menu, "Modifier", category, "Enregistrer").

### Implementation for User Story 3

- [ ] T044 [US3] Make `editArticle` in `apps/mobile/src/application/use-cases/edit-article.ts` check `categories.findById` before writing, returning `CategoryNotFound`, to turn T042 green. Only the category validation is new; T017 already saves both fields in one update.
- [ ] T045 [US3] Add `CategoryPicker` (from T008) to `apps/mobile/src/adapters/ui/screens/EditArticleScreen.tsx` and save the chosen `categoryId`, to turn T043 green.
- [ ] T046 [US3] Check that `Screens/EditArticle/Default` now shows the category picker with the current category selected, and review it in Storybook. No new required story: the picker's own stories exist (T009).

**Checkpoint**: all three stories work independently and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T047 Extend 001's offline scenario in `apps/mobile/src/adapters/ui/offline.test.tsx` with `global.fetch` throwing: rename, change category, delete and undo. Every step succeeds and nothing is reported (FR-010, SC-004).
- [ ] T048 [P] Extend `apps/mobile/src/adapters/ui/state/error-context.test.ts` so the reports raised in the 002 store tests carry only the `operation` and `screen` fields, never an article or list name (FR-011).
- [ ] T049 [P] Extend `apps/mobile/src/adapters/ui/screens/accessibility.test.tsx` to cover EditArticle, DeleteArticleDialog, the row menu and the undo snackbar: French labels and ≥ 48 dp targets.
- [ ] T050 [P] Update `README.md` to list renaming, recategorizing and deleting articles (with undo) among the app's features.
- [ ] T051 Review every 002 story in Storybook on Android and iOS, in light and dark mode and at 200% text size, and run `yarn test:e2e:android` and `yarn test:e2e:ios` green. Then run [quickstart.md](quickstart.md) section 2 on Android and iOS: the 8 hands-on scenarios, including airplane mode, killing the app while "Annuler" is shown, and TalkBack/VoiceOver. Record the results, and anything not checked, in the pull request's test plan.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: needs 001 merged and green.
- **Foundational (Phase 2)**: T002–T003 → T004 → T005. T006–T007 and T008 can run beside the repository work; T009 (`CategoryPicker` stories) follows T008. It blocks every story.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after Foundational. It is independent of US1 except for shared files: `AddArticlesScreen.tsx` (T020, T039), `app-store.ts` and `add-articles-screen.test.tsx`. Doing them in sequence avoids conflicts.
- **US3 (Phase 5)**: after US1, because it extends `editArticle` and `EditArticleScreen`.
- **Polish (Phase 6)**: after the stories it covers.

### Within Each User Story

The story's journey first, seen failing (outer loop). Tests first, seen failing. Then domain →
use cases → store → components → screens, each Green followed by a refactor and a commit. Then
the story's required stories (story test red, then the story files), and the journey green on both
platforms.

### Parallel Opportunities

- Foundational: T006–T007 (`ArticleRow`) and T008 (`CategoryPicker`) beside T002–T005.
- US1: T011, T012 and T013 are separate test files; T016 runs beside T017's test setup.
- US2: T024–T029 are six separate test files; T036 and T037 in parallel after them.
- Polish: T048, T049 and T050.

---

## Parallel Example: User Story 2

```bash
# Red: write these failing tests together (different files)
Task: "T024 get-article-usage.test.ts"
Task: "T025 delete-article.test.ts"
Task: "T026 restore-deleted-article.test.ts"
Task: "T027 app-store.delete-article.test.ts"
Task: "T028 join-french.test.ts"
Task: "T029 undo-snackbar.test.tsx"

# Green: then, after the use cases
Task: "T036 joinFrench in apps/mobile/src/adapters/ui/components/join-french.ts"
Task: "T037 deletedArticle text in UndoSnackbar.tsx"
```

## Parallel Example: User Story 1

```bash
Task: "T011 edit rule tests in apps/mobile/src/application/use-cases/unique-name.test.ts"
Task: "T012 editArticle tests in apps/mobile/src/application/use-cases/edit-article.test.ts"
Task: "T013 store tests in apps/mobile/src/adapters/ui/state/app-store.edit-article.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2, both P1)

1. Phase 1: confirm the 001 baseline.
2. Phase 2: repository methods, row menu, `CategoryPicker`.
3. Phase 3: US1, rename. Validate quickstart scenarios 1–2.
4. Phase 4: US2, delete with undo. Validate quickstart scenarios 4–5.
5. **Stop and validate**: `rename-article` and `delete-article` green on both platforms, then
   airplane mode and the killed app by hand (quickstart 6–7).

### Incremental Delivery

1. Foundational → US1 → one pull request (rename).
2. US2 → one pull request (delete and undo).
3. US3 → one pull request (category; only adds the field).
4. Polish → offline scenario, accessibility, device validation.

Each pull request is merged only when `gh pr checks` is all green and, unless it is
documentation-only (`.github/scripts/app-changed.sh`), an `e2e-android` run started with
`gh workflow run e2e.yml --ref <branch>` is green on its latest commit (constitution v2.3.0,
Quality Gates).

---

## Notes

- [P] tasks touch different files and depend on no unfinished task.
- Never delete, skip or weaken a test to make a change go green (Principle I).
- The undo snapshot lives only in the store, never on disk: a killed app makes the deletion final.
- Synchronization of edits and deletions is out of scope; its open questions are in [research.md](research.md) R7.
- Test gates (constitution v2.3.0, Quality Gates): before each commit, `yarn test` (the fast
  suite) is green; before each push, `yarn test:e2e:android` (the device suite) is green, unless
  the branch changes only documentation (`specs/`, `.specify/`, Markdown files, as
  `.github/scripts/app-changed.sh` decides); before merging a pull request that is not
  documentation-only, the `E2E Android` workflow, started by hand on its branch, is green on its
  latest commit; the iOS journeys (`yarn test:e2e:ios`) run before each release and before merging a pull request
  that changes native configuration (`apps/mobile/app.config.ts`, a config plugin or a native
  dependency), and that pull request's test plan records the run.
