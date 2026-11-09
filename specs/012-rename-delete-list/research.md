# Research: Rename and Delete a Shopping List

Decisions that matter only inside this feature. Code references are to the repository at `main` (v2.0.1).

## R1. The list tombstone already exists on the server

**Finding**: `shopping_list` has `deleted_hlc` and `merged_into`; `ListRecord` is `Stamped`; `listRow` sends `deletedHlc`; the unique index `list_live_name` is partial (`WHERE deleted_hlc IS NULL`), so a tombstone frees its name. They exist for name merges (003 R8). Missing: `SyncedFields['list']` is `{ name }` only, `updateRecord` for a list never tombstones, and does not ignore edits to a tombstone.

**Decision**: add `deleted: true` to `SyncedFields['list']` (as `article` has) and handle it in `apply-change.ts`: `{ ...row, deletedHlc: incoming, seq }`; a list whose `deletedHlc` is set ignores every later change (as articles do). No SQL migration.

**Alternatives**: a new `deleteList` endpoint (rejected: the protocol is a change stream, one mechanism); encode deletion as `name: ''` (rejected: invalid state, collides with name rules).

## R2. Client side: physical delete + outbox entry, like articles

**Finding**: the app has no tombstone column. `deleteArticle` removes the rows and records `{ deleted: true }` in `pending_change`; the pulled-rows applier ignores a pulled row whose `<kind>:<id>:deleted` is pending, so a stale pull cannot resurrect it.

**Decision**: same for lists. `deleteList` removes the list's items, the list, and records `('list', id, { deleted: true })`. Not held (no undo offer, clarification 1), so it syncs at the next cycle. `applyNamed` already consults `pending('list', id, 'deleted')`. No app migration.

**Server cascade**: not done. Articles do not cascade either: the server keeps the item rows, and a pulling client skips items whose parent list is absent (`parents` check in the applier) and deletes items of a deleted parent. Cascading would add N rows per deletion for no reader. The pull of a fresh device sends orphan item rows; they are skipped. Accepted.

## R3. Concurrency (spec FR-009, US3-4)

- Deletion vs rename or item edits on another device: the tombstone wins whatever the HLC order, because a tombstoned record ignores later changes (R1). Edits that arrive later find the list absent on their device after its next pull; its pending edits are sent, acknowledged and ignored by the server.
- Rename vs rename: unchanged per-field last-writer-wins with the deterministic tie-break of `mergeField`.
- Deleting a list that the server merged away: the change is redirected to the survivor by `redirect()` (R8 of 003), so the survivor is deleted. Accepted: the user deleted "that list" on a device that had not yet learned of the merge; the same already holds for articles.
- Deleting an unknown list (never synced create, or already deleted): `createRecord` returns null for a change with no name, so nothing is written and the change is acknowledged.
- A joining device's snapshot (minimum HLC) creating a list the server tombstoned: ignored by the tombstone rule; the device then pulls the tombstone and deletes it (SC-003, no resurrection).
- Two devices deleting the last list and each creating "Ma liste": the server's merge by name (003 FR-012) keeps the earlier one; same as two fresh installs.

## R4. The current list (FR-006, FR-007, FR-010)

**Finding**: `app_state.current_list_id` is `NOT NULL REFERENCES shopping_list(id)` and foreign keys are ON, so the current list cannot be deleted before another is chosen. "Displayed order" is `compareNames` (domain), which the SQLite applier should not re-implement, and creating the default list needs an id, an outbox entry and a French name (not available to an adapter).

**Decision**:
1. Domain: `pickCurrentList(lists)` returns the first list by `compareNames`, or null.
2. Application: `resolveCurrentList(repos, ids, { removing, incoming, firstListName })` sets the current list to `pickCurrentList(remaining)`; with none left, adds a list `firstListName` (real change record, not a seed) and makes it current. `remaining` = local lists minus `removing` plus live list rows of the pulled batch not yet local, so a pull that both deletes and brings lists never creates a spurious default.
3. `deleteList` calls it in its transaction. Implementation note (T015): `resolveCurrentList` also removes the list and its items itself, because the order matters. When the list is current, the current list moves first, then the rows go. A list that is not current is just removed. The last list is a cycle: the default "Ma liste" cannot be added while the removed list still holds that name, and the removed list cannot go while `app_state` refers to it. So `AppStateRepository.clearCurrentList()` empties `app_state` in the transaction, the old list goes, then the default is added and made current. When only an `incoming` list remains, the current list is left cleared and that list's id is returned, so the caller makes it current once the pull has stored it.
4. `synchronize` calls it before `pulledRows.apply` when the batch tombstones (without `mergedInto`) the current list. The applier then deletes the list freely. The merge case (current list merged away) keeps its existing handling.
5. `firstListName` reaches `synchronize` as a dependency wired by the composition root from the existing UI seed (`seed.firstListName`), the same way `initializeStore` receives it; the application layer produces no display text (X).

## R5. UI decisions

- **Row layout**: the ⋮ (`RowMenu`) sits outside the row's `TouchableRipple`, so it is its own 48 dp target and a tap on it does not choose the list. The "en cours" chip stays, left of the ⋮, on the current row (the chip is a state, the chevron was an affordance; spec FR-001 replaces only the chevron). The row label keeps "Barbecue, 0 articles", so existing journeys keep working; the menu button reads "Actions pour Barbecue" (existing `RowMenu` wording, as the Articles tab), entries "Modifier Barbecue" / "Supprimer Barbecue".
- **Edit form**: `CreateNamedDialog` gains `initialName` and `confirmLabel` props (title "Modifier la liste", confirm "Enregistrer"; creation unchanged: "Nouvelle liste" / "Créer"). A new `EditListDialog` wraps it with `renameList`. Alternative (copy the dialog) rejected by Principle IV.
- **Delete dialog**: `AppDialog` like `DeleteArticleDialog`: icon `delete`, title `Supprimer « Barbecue » ?`, message "La liste et ses articles seront supprimés. Les articles restent dans le catalogue.", "Annuler" / "Supprimer" (dangerFilled). No undo snackbar. Double tap guarded by a ref.
- **Remote removal**: a dialog open on a list that a pull deletes closes silently. `useRemoteRemoval` gains an optional `listId` that matches `effects.deletedLists`; no notice is set (spec edge case). It also follows merge redirects like the article case.
- **Stale write**: `renameList`/`deleteList` on a vanished list return `ListNotFound`, declared `expected` in the store: the dialog closes, no error.
- **Store**: after a successful write `runWrite` already calls `refresh()`, which reloads `lists` and `currentList`; the Courses tab therefore shows the new current list (edge case 1). `SyncSlice.remote.effects` gains `deletedLists`; a cycle with `pulledRows > 0` already reloads regions.
- **Icons**: `more_vert` and `delete` already in `symbols.txt`; nothing to add.

## R6. Compatibility with older apps and servers

`API_VERSION` stays 1 and `MIN_APP_VERSION` stays 1.1.0: the field is additive. A new app on an old server: the old `updateRecord` for lists returns the row unchanged when `name` is undefined, so the deletion is acknowledged but not stored; the list would return on the next pull. The server and the app change in one PR, but they are delivered separately, so the window lasts until the server is updated; the quickstart says to deploy the server first. An old app on a new server: ignores non-merge list tombstones (`continue` in the applier) and keeps a stale copy until updated; it never resurrects it on the server because the snapshot runs once. Accepted per the spec's Assumptions.

## R7. Tests

- No existing test asserts the chevron except `list-summary-row.test.tsx` ("ends with a chevron_right when not current"), which changes because the behavior changes.
- Server: `apply-change.test.ts` (unit), `sync.test.ts` (use case on the in-memory store), `list-repository.contract.ts` (both stores), real `node:sqlite` through the existing sqlite store test.
- App: contract tests for the repositories (in-memory and SQLite), use-case tests on `InMemoryUnitOfWork`, `pulled-rows-applier.test.ts` on real SQLite, `synchronize.test.ts` with `OfflineSyncServer`/paired-device doubles, component tests with `renderWithStore`, stories checked by `stories.test.tsx`.
- Multi-device (US3-1 to US3-5): `tests/sync/src/two-devices.test.ts`, two real SQLite replicas against a real test server, because the in-memory applier does not merge by name.
- Device: one Detox journey on Android (rename, delete another, delete the current one, delete the last one), isolated with `delete: true, newInstance: true`.
