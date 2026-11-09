# Data Model: Rename and Delete a Shopping List

Builds on [001](../001-shopping-lists/data-model.md) and [003](../003-server-sync/data-model.md). Only the differences are listed.

## Shared protocol (`packages/sync-core`)

```ts
SyncedFields.list = { name: string; deleted: true }   // was { name: string }
```

`deleted: true` is an intent, never a field of a `ServerRow`: the server turns it into `deletedHlc` (as for `article`). `ServerRow` is unchanged: a list row already has `deletedHlc` and `mergedInto`. A row with `deletedHlc != null` and `mergedInto == null` is a deletion; with `mergedInto != null` it is a name merge (existing).

## Server (`apps/server`)

No schema change: `shopping_list(account_id, id, name, name_hlc, normalized_name, created_hlc, deleted_hlc, merged_into, seq)` and the partial unique index `list_live_name` exist.

State transitions of a list record (`applyChange`):

| Record | Change | Result |
| --- | --- | --- |
| absent | `{ name }` | created live |
| absent | `{ deleted: true }` | nothing written (acknowledged) |
| live | `{ name }` | per-field last writer wins (unchanged) |
| live | `{ deleted: true }` | `deletedHlc = change.hlc`, `seq` = this change's seq; name freed |
| tombstone (deleted or merged) | any | ignored, record returned unchanged |

Items of a deleted list are left as they are (research R2).

## App (`apps/mobile`)

No schema change, no migration. `shopping_list`, `list_item`, `app_state`, `pending_change` as in 003.

| Operation | Local effect | Outbox entry |
| --- | --- | --- |
| rename | `shopping_list.name`, `normalized_name` updated; id, items, current status kept | `('list', id, { name })`, only when the cleaned name differs from the stored one |
| delete | items of the list, then the list row, removed; if it was current, the current list changed first (below) | `('list', id, { deleted: true })`, not held |

**Current list after a deletion** (local or pulled): let `remaining` = lists left; `current` = `pickCurrentList(remaining)` (first by `compareNames`); if `remaining` is empty a list named by `Seed.firstListName` is added (real change record), becomes current. A list that is not the current one leaves `app_state` untouched.

**Ports**

- `ShoppingListRepository`: `rename(id, name)`, `remove(id)` (rejects while items refer to it, like `ArticleRepository.remove`, or while it is the current list: the `app_state` foreign key).
- `ListItemRepository`: `removeAllForList(listId)`.
- `AppStateRepository`: `clearCurrentList()`, used only inside the transaction that replaces the last list (research R4).
- `RemoteEffects.deletedLists: string[]`: lists deleted by this pull.

**Validation**: rename uses `uniqueName(repos.lists, name, (l) => l.id === listId)`: cleaned, 1 to 60 characters, unique ignoring case, accents and spacing, own name allowed (spec FR-003).
