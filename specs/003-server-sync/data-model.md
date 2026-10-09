# Data Model: Server Synchronization

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

This builds on [001's data model](../001-shopping-lists/data-model.md) and
[002's](../002-manage-articles/data-model.md). It has three parts: the types shared by the app
and the server (`packages/sync-core`), the device's local additions (migration 2 of the app's
SQLite), and the server's database.

## Shared types (`packages/sync-core`)

```text
Hlc = { wallMs: number; counter: number; deviceId: string }
  compare(a, b): by wallMs, then counter, then deviceId (string order)
  MIN(deviceId) = { wallMs: 0, counter: 0, deviceId }               // snapshot stamp (research R13)

EntityKind = 'category' | 'article' | 'list' | 'listItem'

Change = {
  changeId: string                  // UUID, idempotence (FR-006)
  hlc: Hlc
  kind: EntityKind
  id: string                        // category/article/list id; listItem: `${listId}:${articleId}`
  fields: Partial<SyncedFields[kind]>   // only the fields this change sets
}

SyncedFields = {
  category: { name: string; position: number }
  article:  { name: string; categoryId: string; deleted: true }    // deleted: tombstone, final
  list:     { name: string }
  listItem: { listId: string; articleId: string; present: boolean; inCart: boolean;
              quantity: { amount: number; unit: string | null } | null }
}

ServerRow = {                       // what a pull returns, per entity
  kind, id, seq: number,
  fields: { [field]: { value, hlc: Hlc } },
  createdHlc: Hlc,
  deletedHlc: Hlc | null,           // tombstone (articles; merged entities of any kind)
  mergedInto: string | null         // survivor id when merged (research R8)
}
```

Rules (pure functions in `sync-core`, tested in isolation):

| Rule | Function | Source |
|---|---|---|
| A field changes only if the incoming HLC is greater | `mergeField(current, incoming)` | FR-009, FR-010 |
| A stamp more than 60 s ahead of the server clock is clamped | `clampHlc(hlc, serverNowMs)` | Edge case "wrong clock", research R6 |
| A deleted article ignores every later change | `applyToArticle` | FR-011 |
| An item's `present = false` is not reset by `inCart` or `quantity` changes | field independence | FR-011, US2-6 |
| Same `normalizedName` in a kind → survivor = smaller `(createdHlc, id)` | `pickSurvivor` | FR-012, research R8 |
| Categories ordered by `(position, createdHlc, id)` | `compareCategories` | FR-014 |
| `cleanName` and `normalizedName` exactly as defined in [001's data model](../001-shopping-lists/data-model.md#name-articles-categories-lists) (invisible characters removed, every Unicode space a space, "œ", "æ" and "’" folded) | moved here from 001's domain | 001 R6, 001 FR-021, 001 FR-022 |

## Device: local additions (app SQLite, migration 2)

### Outbox entry (`PendingChange`, FR-005)

| Field | Type | Notes |
|---|---|---|
| `seq` | integer, autoincrement | Send order (US1-3). |
| `changeId` | UUID | From `IdGenerator`. |
| `hlc` | `Hlc` | From the device's HLC at the time of the change. |
| `kind`, `entityId`, `fields` | as in `Change` | `fields` stored as JSON. |
| `heldBy` | `string \| null` | Undo id while "Annuler" is offered; held entries are never sent (FR-008). |

State transitions:

```text
(none) --command use case--> pending              (heldBy = null)
(none) --removeItem / deleteArticle--> held       (heldBy = undoId)
held   --restore*(undoId)--> (none)               entries deleted; the server never sees them (US1-7)
held   --releaseHeldChanges(undoId) | app start--> pending
pending --push acknowledged (changeId in response)--> (none)
```

### Sync state (single row, `sync_state`)

| Field | Type | Notes |
|---|---|---|
| `serverUrl` | `string \| null` | `https://<domain>`; `null` when not connected. |
| `serverId` | `string \| null` | The server's id at pairing time (research R12). |
| `deviceId` | `string \| null` | Assigned by the server at pairing. |
| `lastSeq` | integer | Highest server `seq` applied locally; `0` before the first sync. |
| `maxHlc` | `Hlc` | The device's HLC state; never moves backwards. |
| `lastSyncAt` | timestamp `\| null` | Shown in Settings (US4-8). |
| `snapshotDone` | boolean | `false` until the first full upload to this server completed (research R13). |

The device credential is **not** stored here. It lives in the operating system's secure
storage (`expo-secure-store`, research R11), which a system backup never carries to another
device (research R12a). `serverUrl` set with no credential means a restored phone: the device
is treated as `disconnectedByServer` (FR-018b).

### Connection state (UI store, `sync.connection`)

```text
notConnected --claim succeeds--> connected
connected --401 or different serverId--> disconnectedByServer    (US4-10, FR-018a)
connected --serverUrl set but no credential (restored phone)--> disconnectedByServer   (FR-018b)
connected --response minAppVersion > app version--> updateRequired
connected --"Déconnecter" confirmed--> notConnected               (US4-11)
disconnectedByServer --claim succeeds (new code)--> connected     (lastSeq = 0, snapshotDone = false)
```

### Sync status (UI store, `sync.status`, US3)

```text
saved   --local write--> waiting(pendingCount)
waiting --cycle starts, server reachable--> sending
sending --success, outbox empty--> saved
sending --network error / timeout / unreachable--> waiting          (never reported)
sending --5xx, bad response or unverifiable certificate × 3 in a row--> failed  (reported once)
failed  --"Réessayer" or next success--> sending | saved
```

### Changes to 001's schema (migration 2)

- `category.position` loses its `UNIQUE` constraint, because positions created concurrently on
  two devices can be equal. They are ordered by `(position, created_hlc, id)` (FR-014). SQLite
  needs a table rebuild for this, done in the migration's transaction.
- `category`, `article` and `shopping_list` gain `created_hlc TEXT NOT NULL`, the encoded HLC.
  Existing rows get the minimum HLC of the device (research R13).
- New tables:

```sql
CREATE TABLE pending_change (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id TEXT NOT NULL UNIQUE,
  hlc       TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('category','article','list','listItem')),
  entity_id TEXT NOT NULL,
  fields    TEXT NOT NULL,          -- JSON
  held_by   TEXT
);
CREATE INDEX pending_change_held ON pending_change(held_by);

CREATE TABLE sync_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  server_url    TEXT,
  server_id     TEXT,
  device_id     TEXT,
  last_seq      INTEGER NOT NULL DEFAULT 0,
  max_hlc       TEXT NOT NULL,
  last_sync_at  TEXT,
  snapshot_done INTEGER NOT NULL DEFAULT 0 CHECK (snapshot_done IN (0, 1))
);
```

- `list_item` is unchanged: a pulled `present = false` deletes the local row; a pulled
  `present = true` upserts it. `app_state.current_list_id` stays local and is never sent
  (FR-015); when a pulled list tombstone merges the current list away, the applier sets
  `current_list_id` to the survivor in the same transaction (research R8a).

### Remote effects (returned by `PulledRowsApplier.apply`, research R10a)

```text
RemoteEffects = {
  deletedArticles: ArticleId[]                       // tombstoned by this pull
  removedItems: Array<{ listId, articleId }>         // present = false by this pull
  merges: Array<{ kind, loserId, survivorId }>       // mergedInto set by this pull
}
```

Used by the store to close open forms on what was removed (FR-020a), to redirect a form's save
to a merge survivor, and to end an undo offer on an article deleted elsewhere (FR-008). Kept in
memory only.

## Server database (Pi SQLite)

```sql
CREATE TABLE meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  server_id TEXT NOT NULL,           -- random at creation (research R12)
  seq INTEGER NOT NULL DEFAULT 0     -- global change counter (research R7)
);

-- One table per kind. Each synced field has its value and the HLC that set it.
CREATE TABLE category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, name_hlc TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  position INTEGER NOT NULL, position_hlc TEXT NOT NULL,
  created_hlc TEXT NOT NULL,
  deleted_hlc TEXT, merged_into TEXT REFERENCES category(id),
  seq INTEGER NOT NULL
);
CREATE UNIQUE INDEX category_live_name ON category(normalized_name) WHERE deleted_hlc IS NULL;

CREATE TABLE article (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, name_hlc TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES category(id), category_hlc TEXT NOT NULL,
  created_hlc TEXT NOT NULL,
  deleted_hlc TEXT, merged_into TEXT REFERENCES article(id),
  seq INTEGER NOT NULL
);
CREATE UNIQUE INDEX article_live_name ON article(normalized_name) WHERE deleted_hlc IS NULL;

CREATE TABLE shopping_list (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, name_hlc TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_hlc TEXT NOT NULL,
  deleted_hlc TEXT, merged_into TEXT REFERENCES shopping_list(id),
  seq INTEGER NOT NULL
);
CREATE UNIQUE INDEX list_live_name ON shopping_list(normalized_name) WHERE deleted_hlc IS NULL;

CREATE TABLE list_item (
  list_id TEXT NOT NULL REFERENCES shopping_list(id),
  article_id TEXT NOT NULL REFERENCES article(id),
  present INTEGER NOT NULL, present_hlc TEXT NOT NULL,
  in_cart INTEGER NOT NULL, in_cart_hlc TEXT NOT NULL,
  quantity_amount REAL, quantity_unit TEXT, quantity_hlc TEXT NOT NULL,
  seq INTEGER NOT NULL,
  PRIMARY KEY (list_id, article_id)
);

CREATE INDEX category_seq ON category(seq);
CREATE INDEX article_seq ON article(seq);
CREATE INDEX list_seq ON shopping_list(seq);
CREATE INDEX list_item_seq ON list_item(seq);

CREATE TABLE applied_change (            -- idempotence (FR-006); kept forever, tiny
  change_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE device (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  credential_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of the device credential (research R11)
  created_at TEXT NOT NULL,
  last_sync_at TEXT,
  revoked_at TEXT
);

CREATE TABLE pairing_code (
  code_hash TEXT PRIMARY KEY,            -- SHA-256 of the 8-character code
  created_by TEXT REFERENCES device(id), -- NULL when created on the Pi itself
  expires_at TEXT NOT NULL,              -- created + 10 minutes
  used_at TEXT
);

CREATE TABLE pairing_failure (           -- rate limit (FR-019b): ≤ 5 in any 10-minute window
  at TEXT NOT NULL
);
CREATE INDEX pairing_failure_at ON pairing_failure(at);
```

Rules enforced by the server's domain (each with tests):

- Every applied change bumps `meta.seq` once, and every row it touches takes that `seq`.
- A field is written only through `mergeField` (incoming HLC clamped first).
- A change for an article with `deleted_hlc` set is acknowledged and ignored. A change for a
  merged id is redirected to `merged_into`, following the chain.
- A create or rename whose `normalized_name` matches a live row of the same kind triggers the
  merge of research R8 in the same transaction.
- A `listItem` change that creates an item refers to a live or merged list and article.
  Changes that arrive out of order (an item before its article) are applied in the order of
  the push, and the device always records the article's create before the item's.
- Pairing: a code is valid if its hash exists, `used_at` is `NULL` and `expires_at` is in the
  future. A successful claim sets `used_at` and creates the device in one transaction.
- Requests from a device with `revoked_at` set, or an unknown credential, are refused before
  any read.

## Read models (new)

```text
DeviceSummary = { id, name, lastSyncAt: string | null, isThisDevice: boolean }   // US4-8
SyncInfo      = { serverUrl, lastSyncAt, status, pendingCount, connection }      // US3, US4-8
```
