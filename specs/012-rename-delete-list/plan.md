# Implementation Plan: Rename and Delete a Shopping List

**Branch**: `feat/issue-192-rename-and-delete-a-shopping-list-from-the-lists-screen` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-rename-delete-list/spec.md` (issue #192)

## Summary

Each row of the Listes tab swaps its right chevron for the shared `RowMenu` (⋮) offering "Modifier" and "Supprimer". "Modifier" reopens the list creation dialog pre-filled; "Supprimer" asks for confirmation, then deletes the list and its items. Both operations are local-first and synchronized.

Lists already carry a tombstone on the **server** (`deleted_hlc`, `merged_into`, the partial unique index `list_live_name`), because name merges use it; what is missing is the *intent*: `SyncedFields.list` has no `deleted: true` as `article` has. The plan therefore adds it exactly like articles: the client deletes the row and queues `{ deleted: true }`, the server turns it into `deletedHlc` and keeps the row as a tombstone, the pull sends it, other clients delete the list and its items. No server migration, no app migration, no protocol version change (see [research.md](research.md) R1 to R3). The one new difficulty is the per-device current list: deleting (here or through a pull) the current list must pick the first remaining list in displayed order, or create "Ma liste", in the same transaction (R4).

## Technical Context

**Language/Version**: TypeScript 6; React Native (Expo) app, Fastify + `node:sqlite` server, shared package `packages/sync-core`

**Primary Dependencies**: none new (react-native-paper `Menu`/`Dialog` already used by `RowMenu` and `AppDialog`)

**Storage**: unchanged schemas. App: SQLite, a deleted list is removed physically and its tombstone is the pending outbox entry (as for articles). Server: `shopping_list.deleted_hlc` already exists (migration 2); no migration

**Testing**: Jest (fast suite: domain, use cases against in-memory doubles, SQLite adapter, server store contract, React Native Testing Library, stories); Detox on Android for the journey (iOS out of scope, FR-012)

**Target Platform**: Android (iOS code paths kept, not delivered); server on the Pi

**Project Type**: monorepo (mobile app + sync server + `sync-core`)

**Performance Goals**: rename and delete show their result without waiting for the network (SC-005)

**Constraints**: offline-first (VII); French text only in the UI adapter (X); Material 3 tokens and shared components only (V); explicit screen states (IX); hexagonal layers enforced by dependency-cruiser (VI)

**Scale/Scope**: 1 protocol field, 1 server rule, 2 new use cases (`renameList`, `deleteList`) and 1 shared helper, 3 repository methods, 1 applier branch, 1 sync step, 1 changed row component, 1 generalised dialog, 1 new dialog, 1 Detox journey

## Constitution Check

| Principle | Verdict |
| --- | --- |
| I Test-First | Pass. Every task puts its failing test first; no test-only task (tasks.md). |
| II Executable specification | Pass. Each acceptance scenario of US1 to US3 maps to a test (traceability table in tasks.md). |
| III Fast, deterministic | Pass. Use cases run on in-memory doubles; the sync test uses `OfflineSyncServer` and the fake clock; no wall clock. |
| IV Simplicity | Pass. Reuses `RowMenu`, `CreateNamedDialog`, `AppDialog`, `uniqueName`, the article tombstone path and the server's existing list merge machinery. Rejected: server-side cascade of items, a `deleted` column in the app, an undo offer (R2, R5). No new dependency. |
| V Single design system | Pass. Only shared components; the mockups are updated first (T004). |
| VI Hexagonal | Pass. Rules in domain/application (`pickCurrentList`, `resolveCurrentList`); SQL in the SQLite adapter; the French default name travels as a parameter from the UI seed, never produced below the UI. |
| VII Offline first | Pass. Local replica first, outbox, ack-then-remove. Reconciliation: deletion wins over concurrent edits (R3); tested offline and unreachable (T013, T020). |
| VIII Error tracking | Pass. Writes go through `runWrite` (reports, no list content). The pull branch reports nothing new. |
| IX Explicit states | Pass. The Listes regions keep loading/empty/error/success; dialogs have saving and error states; SyncStatusBar unchanged. |
| X French interface | Pass. New text in `ListsScreen`, dialogs, `ListSummaryRow` only. |
| XI Monorepo | Pass. Protocol change in `sync-core`, server and app in one PR, all workspaces green. |

No violation; Complexity Tracking is empty.

## Architecture Decisions

None new: the choices matter inside this feature only and are recorded in [research.md](research.md). Relies on [ADR 0004](../../docs/adr/0004-detox-end-to-end-tests.md) (Detox) and [ADR 0012](../../docs/adr/0012-material-symbols-icons.md) (`more_vert` is already in the icon subset; `chevron_right` stays used by `SettingsRow`).

## Project Structure

### Documentation (this feature)

```text
specs/012-rename-delete-list/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sync-api.md          # delta to 003: list { deleted: true }
│   └── ui-screens.md        # Listes row, edit dialog, delete dialog, states
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/sync-core/src/protocol.ts                      # SyncedFields.list gains deleted: true
apps/server/src/
├── domain/apply-change.ts                              # list tombstone; edits to a tombstone ignored
└── application/{use-cases/sync.test.ts, testing/contracts/list-repository.contract.ts}
apps/mobile/src/
├── domain/shopping-list.ts                             # pickCurrentList (displayed order)
├── application/
│   ├── ports/{repositories.ts, pulled-rows.ts}         # rename/remove, removeAllForList, effects.deletedLists
│   ├── use-cases/{rename-list.ts, delete-list.ts, resolve-current-list.ts, synchronize.ts}
│   └── testing/{in-memory-repositories.ts, contracts/*}
├── adapters/sqlite/{shopping-list-repository.ts, list-item-repository.ts, pulled-rows-applier.ts}
├── composition/composition-root.ts                     # passes the default list name to sync
└── adapters/ui/
    ├── components/{ListSummaryRow.tsx, CreateNamedDialog.tsx}
    ├── screens/{ListsScreen.tsx, EditListDialog.tsx, DeleteListDialog.tsx}
    ├── state/{lists-actions.ts, app-store.ts, store-kit.ts, use-remote-removal.ts}
    └── required-stories.ts, stories
tests/e2e/{journeys/rename-delete-list.e2e.ts, support/app.ts}
design/mockups/                                         # Listes with ⋮, menu, edit, delete
```

**Structure Decision**: the existing three-workspace monorepo; each layer changed is the one that already holds the sibling article feature, so the code reads like 002/011.

## Complexity Tracking

None.
