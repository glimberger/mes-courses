# Sync API delta: list deletion

Delta to [003 sync-api](../../003-server-sync/contracts/sync-api.md). `API_VERSION` (1) and `MIN_APP_VERSION` do not change: the field is additive.

## Change

```jsonc
{ "changeId": "…", "hlc": { … }, "kind": "list", "id": "<listId>", "fields": { "deleted": true } }
```

Rules:

1. The server sets `deletedHlc` to the change's HLC and gives the row a new `seq`. The row is returned by the next pulls with `deletedHlc` set and `mergedInto: null`.
2. A change aimed at a tombstoned list (deleted or merged), whatever its fields or HLC, has no effect and is acknowledged.
3. A deletion of an unknown list has no effect and is acknowledged.
4. The name of a tombstoned list is free for a new live list (partial unique index).
5. The server does not touch the list's items; a client deletes them with the list.
6. A deletion of a merged-away list id is applied to its survivor (existing redirect rule).
7. The HTTP request schema (`apps/server/src/adapters/http/schemas.ts`) accepts `{ "deleted": true }` on a list (`deleted: { const: true }`); it answered 400 before this fix. Covered by `apps/server/src/adapters/http/sync-route.test.ts`.

## Pull (client)

For a list row with `deletedHlc != null` and `mergedInto == null` the client, in one transaction: resolves the current list first if it is among the deleted lists (data-model.md), deletes the list's items, deletes the list, and reports `effects.deletedLists`. Items pulled for a list the client does not hold are skipped.

## Tests (contract)

`list-repository.contract.ts` (tombstoned list keeps its record, `findLiveByNormalizedName` ignores it, `changedSince` returns it); `apply-change.test.ts`; `sync.test.ts`: delete, then rename ignored, then item change ignored, then same name recreated, then pull from `lastSeq` 0 gives the tombstone.
