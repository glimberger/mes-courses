---

description: "Task list for renaming and deleting a shopping list"
---

# Tasks: Rename and Delete a Shopping List

**Input**: Design documents from `/specs/012-rename-delete-list/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sync-api.md, contracts/ui-screens.md

**Tests**: Each test is written first inside the task that implements it (constitution, Principle I); no test-only task, and every task leaves the fast suite green. Every phase also updates stories, `required-stories.ts` and screenshots for what it touches.

**Organization**: The protocol and server come first (they are shared and atomic with the app, Principle XI), then the rename and delete behavior bottom-up (repositories, use cases, store, dialogs), then the Listes row and screen, then the pull side, then the Detox journey and documentation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 rename, US2 delete, US3 sync to other devices

Paths are under `apps/mobile/src/` for the app and `apps/server/src/` for the server unless stated.

## Phase 1: Specification and mockups

- [X] T001 Write `specs/012-rename-delete-list/spec.md` and its quality checklist (issue #192)
- [X] T002 Write `plan.md`, `research.md`, `data-model.md`, `quickstart.md` and `contracts/`
- [X] T003 Write this `tasks.md`
- [ ] T004 [P] Update `design/mockups/`: the Listes tab with the ⋮ button in place of the chevron (current row with chip and ⋮), the open row menu, the "Modifier la liste" dialog and the "Supprimer « … » ?" dialog (light, and dark for the delete dialog), as `25-` to `28-` files linked from `index.html` and `README.md`; the app screens follow them (Principle V)

---

## Phase 2: Protocol and server (foundation for US3, atomic with the app)

**Goal**: the server stores and serves a list deletion.

**Independent Test**: a `{ deleted: true }` change makes the list a tombstone returned by a pull from `lastSeq` 0; later edits to it are ignored; its name is free.

- [X] T005 Test first (type-level test in `packages/sync-core/src/protocol.test.ts`), then add `deleted: true` to `SyncedFields['list']` in `packages/sync-core/src/protocol.ts`; typecheck every workspace
- [X] T006 Test first in `apps/server/src/domain/apply-change.test.ts` (live list + `deleted` gives `deletedHlc` and the change's `seq`; a tombstoned list, deleted or merged, ignores name and deletion changes; an unknown list with `deleted` writes nothing), then implement in `apps/server/src/domain/apply-change.ts`
- [X] T007 Test first, then adjust if needed: `apps/server/src/application/use-cases/sync.test.ts` (delete then pull from `lastSeq` 0 returns the list row with `deletedHlc` and `mergedInto: null`; rename after deletion is ignored and acknowledged; item change on a deleted list is stored and does not revive it; the freed name can be created again as a new live list; replaying the same `changeId` is harmless; deleting a merged-away id deletes its survivor) and `testing/contracts/list-repository.contract.ts` (a tombstone is excluded from `findLiveByNormalizedName`, included in `changedSince`), run for the in-memory store and the real `node:sqlite` store; confirm `adapters/sqlite/migrations.test.ts` needs no new migration

**Checkpoint**: server and `sync-core` green; app unchanged.

---

## Phase 3: User Story 1 - Rename a list (Priority: P1)

**Goal**: the rename works from store to dialog, not yet reachable from the row.

**Independent Test**: `renameList` renames a list and records `{ name }`; the dialog renames, refuses duplicates and stays open.

- [X] T008 [US1] Test first in `application/testing/contracts/shopping-list-repository.contract.ts` (`rename` changes the name and normalized name and keeps the id and items; renaming to a taken normalized name rejects), then add `rename(id, name)` to `ShoppingListRepository` (`application/ports/repositories.ts`), `application/testing/in-memory-repositories.ts` and `adapters/sqlite/shopping-list-repository.ts`
- [X] T009 [US1] Test first in `application/use-cases/rename-list.test.ts` (new name saved cleaned and recorded as `('list', id, { name })`; own name or only a case/spacing change accepted, recording only when the cleaned name differs; blank, 61 characters and a name of another list refused with nothing changed and nothing recorded; unknown list gives `ListNotFound`; current status and items untouched), then implement `application/use-cases/rename-list.ts` with `uniqueName(..., isSelf)`, and add it to `adapters/ui/use-cases.ts` and the composition root
- [X] T010 [US1] Test first in `adapters/ui/state/app-store.lists.test.ts` (`renameList` resolves ok and the `lists` region shows the new name in alphabetical place, also with `OfflineSyncServer`; duplicate and blank are returned to the form; `ListNotFound` returned as expected; a storage failure gives the `writeFailed` notice, reports the operation without the name, changes nothing; the id goes through `follow`), then add `renameList` to `adapters/ui/state/lists-actions.ts`
- [X] T011 [P] [US1] Test first in the `CreateNamedDialog` tests (`create-list-dialog.test.tsx` or a new `create-named-dialog.test.tsx`): the dialog accepts `initialName` and `confirmLabel`, pre-fills the field, validates as before and keeps "Créer" by default; then implement in `adapters/ui/components/CreateNamedDialog.tsx`
- [X] T012 [US1] Test first in `adapters/ui/screens/edit-list-dialog.test.tsx` (title "Modifier la liste", pre-filled name, "Enregistrer" renames and closes, duplicate shows "Une liste porte déjà ce nom." and stays open, cancel and dismiss keep the name, a failed save keeps the dialog open as typed, a pull deleting the list closes it silently), then implement `adapters/ui/screens/EditListDialog.tsx`; extend `adapters/ui/state/use-remote-removal.ts` with an optional `listId` matched against `effects.deletedLists` (add the empty `deletedLists: []` to `RemoteEffects`, `noEffects` and the store's initial state here so the type compiles; T021 fills it); add stories `Dialogs/EditListDialog/Default` and `NameError` to `required-stories.ts`

**Checkpoint**: US1 works through the store and dialog; US1-4 to US1-7 tested.

---

## Phase 4: User Story 2 - Delete a list (Priority: P1)

**Goal**: the delete works from store to dialog, current-list fallback included.

**Independent Test**: `deleteList` removes the list and its items, keeps the articles, and always leaves exactly one current list.

- [ ] T013 [US2] Test first in `domain/shopping-list.test.ts` (`pickCurrentList` returns the first list by `compareNames`, numbers by value, `null` when empty), then add `pickCurrentList` to `domain/shopping-list.ts`
- [ ] T014 [US2] Test first in the repository contracts (`shopping-list-repository.contract.ts`: `remove` deletes the list and rejects while an item refers to it; `list-item-repository.contract.ts`: `removeAllForList` removes every item of the list and only those, articles stay), then add `remove` and `removeAllForList` to the ports, `in-memory-repositories.ts`, `adapters/sqlite/shopping-list-repository.ts` and `list-item-repository.ts`
- [ ] T015 [US2] Test first in `application/use-cases/resolve-current-list.test.ts` (removing the current list with others left makes the first by name current; removing the last adds a list named by `firstListName`, records it as a normal change and makes it current; `incoming` live lists count as remaining so no default is created; a removed list that is not current leaves the current list as it is), then implement `application/use-cases/resolve-current-list.ts`
- [ ] T016 [US2] Test first in `application/use-cases/delete-list.test.ts` (non-current list: items and list gone, articles and other lists kept, current list unchanged, one `('list', id, { deleted: true })` entry, not held; current list: first remaining becomes current; last list: "Ma liste" created and current, exactly one current list; unknown list gives `ListNotFound` and records nothing; a storage failure rolls everything back), then implement `application/use-cases/delete-list.ts` (takes `firstListName` as a parameter, no display text) and wire it in `adapters/ui/use-cases.ts` and the composition root
- [ ] T017 [US2] Test first in `adapters/ui/state/app-store.lists.test.ts` (`deleteList` removes the list from `lists`, reloads `currentList` to the new current list, makes no undo offer and ends an existing one; `ListNotFound` is a no-op without a notice; works offline at once; failure gives the `writeFailed` notice), then add `deleteList` to `lists-actions.ts`, passing `seed.firstListName`
- [ ] T018 [US2] Test first in `adapters/ui/screens/delete-list-dialog.test.tsx` (title with the name, message "La liste et ses articles seront supprimés. Les articles restent dans le catalogue.", "Annuler" and dismiss change nothing, confirm deletes once on a fast double tap, closes with no undo snackbar, a pull deleting the list closes it silently and confirming a vanished list is a no-op), then implement `adapters/ui/screens/DeleteListDialog.tsx`; add stories `Dialogs/DeleteListDialog/Default` and `DefaultDark` to `required-stories.ts`

**Checkpoint**: US2 works through the store and dialog; US2-3 to US2-7 tested.

---

## Phase 5: Listes screen (US1 and US2 reachable)

**Goal**: the row menu replaces the chevron and opens both dialogs.

**Independent Test**: from the Listes tab, rename and delete a list with the menu; a tap on the row still makes it current.

- [ ] T019 [US1] [US2] Test first, then implement `adapters/ui/components/ListSummaryRow.tsx` and `list-summary-row.test.tsx`: no chevron (the "ends with a chevron_right" test becomes "has no chevron"), the ⋮ `RowMenu` labelled "Actions pour <name>" outside the tappable area, entries "Modifier <name>" and "Supprimer <name>" in that order, the chip kept on the current row beside the ⋮, `onEdit`/`onDelete` called, the row label unchanged, a tap on the row alone calls `onPress`, `menuInitiallyOpen` for stories; add `Components/ListSummaryRow/MenuOpen`
- [ ] T020 [US1] [US2] Test first in `adapters/ui/screens/lists-screen.test.tsx` (US1-1 to US1-3, US2-1; the row tap still makes the list current and shows Courses; Modifier opens the pre-filled dialog; Supprimer opens the confirmation; the outcomes show in the rows and the "en cours" chip; focus returns to the row's ⋮ or the FAB; loading, empty, error and success states unchanged) and `adapters/ui/offline.test.tsx` (rename and delete with the server unreachable, SC-005), then wire `adapters/ui/screens/ListsScreen.tsx`; add `Screens/Lists/MenuOpen` to the stories and `required-stories.ts`; update the story screenshot list in `tests/e2e/screenshots/` if the Listes shots change

**Checkpoint**: US1 and US2 complete on one device.

---

## Phase 6: User Story 3 - Reach the other devices (Priority: P1)

**Goal**: a pulled deletion removes the list and its items, and repairs the current list.

**Independent Test**: devices A and B synced; A renames one list and deletes another; B syncs and shows both; B's current list is valid.

- [ ] T021 [US3] Test first in `adapters/sqlite/pulled-rows-applier.test.ts` (real SQLite: a list row with `deletedHlc` and no `mergedInto` deletes the list and its items and reports `effects.deletedLists`; unknown list is a no-op; a pending local `('list', id, 'deleted')` does not let a stale live row bring the list back; item rows of an absent list are skipped; a merge tombstone still follows the merge path), then implement the branch in `adapters/sqlite/pulled-rows-applier.ts` and collect the effect in `synchronize.ts`
- [ ] T022 [US3] Test first in `application/use-cases/synchronize.test.ts` (a batch deleting the current list: the first remaining by name becomes current before the apply, silently; none remaining: "Ma liste" created, recorded and current, and no default when the same batch brings a live list; a batch deleting a non-current list leaves the current list; a pulled rename updates the name unless a local rename is pending; a deletion beats a pending local rename of the list; after a snapshot the tombstone beats the minimum-HLC create), then call `resolveCurrentList` in `application/use-cases/synchronize.ts` before `pulledRows.apply`, add the `firstListName` dependency and pass it from `composition/composition-root.ts` (`seed.firstListName`)
- [ ] T023 [US3] Test first in `application/use-cases/synchronize.test.ts` and `adapters/ui/state/app-store.remote-effects.test.ts`, with two replicas on one in-memory server (US3-1 to US3-5: rename reaches B; delete reaches B and no later sync restores it; B's current list repaired; A deletes while B, offline, renames and edits items: deleted on both, no error; A deletes the last list and creates the default: B ends with one default list after the 003 name merge), the offline path (changes queued, removed from the outbox only once acknowledged, `OfflineSyncServer` then recovery), and a pull deleting the list under an open edit or delete dialog closes it without notice; implement what the tests show is missing (expected: nothing beyond T012, T018, T021, T022)
- [ ] T024 [P] [US3] Test first in `adapters/ui/state/app-store.remote-effects.test.ts`: a cycle that deletes the current list reloads `lists` and `currentList`, so the Courses tab shows the new current list (edge case 1); implement in `adapters/ui/state/sync-actions.ts` only if it does not already hold

**Checkpoint**: all three stories covered by fast tests.

---

## Phase 7: End-to-end journey and documentation

- [ ] T025 Add a helper for a Listes row menu entry and one asserting a list is gone to `tests/e2e/support/app.ts` (French text and labels only, no sleeps), then write `tests/e2e/journeys/rename-delete-list.e2e.ts` (isolated: `delete: true, newInstance: true`): create "Barbecue"; rename it to "Barbecue dimanche" (cancel once first; the duplicate "Ma liste" is refused with its message); delete it, cancelling once then confirming; with "Barbecue dimanche" back, delete the current "Ma liste" and check "Barbecue dimanche" is "en cours"; delete the last list and check a new "Ma liste" is current with "0 articles"; run `pnpm test:e2e:android` (one suite at a time)
- [ ] T026 [P] Update `README.md` (features paragraph and the 012 link), `specs/003-server-sync/contracts/sync-api.md` and `data-model.md` (a note linking to `specs/012-rename-delete-list/contracts/sync-api.md` for the list `deleted` intent), the statements of `specs/001-shopping-lists/spec.md` and `specs/011-tab-navigation/spec.md` that lists cannot be renamed or deleted (point to 012), and `docs/architecture.md` only if a table row changes
- [ ] T027 Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:architecture`, then `speckit-analyze`; fix findings in the owning task's files; check the PR diff lists only this feature's files

## Dependencies

- T005 to T007 before T025; T021 to T023 use the protocol type from T005. Otherwise Phase 2 is independent of T008 to T020.
- T011 before T012; T008 to T010 and T012 before T020.
- T013 before T015; T014 and T015 before T016; T016 before T017 and T018; T012 and T018 before T019/T020.
- T021 before T022 before T023; T024 after T021.
- T025 after T020 and T023; T026 and T027 last.

## Traceability (Principle II)

| Scenario | Tests |
| --- | --- |
| US1-1 to US1-3 | T019, T020 |
| US1-4, US1-5, US1-6 | T009, T012, T020 |
| US1-7, US2-7 | T010, T017, T020 (offline) |
| US2-1, US2-2 | T018, T020 |
| US2-3 to US2-6 | T016, T017, T025 |
| US3-1 to US3-5 | T006, T007, T021 to T023 |
| Edge cases | T012, T016, T018, T022, T024 |
| FR-012 device journey | T025 |
