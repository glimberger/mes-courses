# Data Model: Shopping Lists

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

The domain model is in `apps/mobile/src/domain/` (pure TypeScript). Its storage in SQLite is in
`apps/mobile/src/adapters/sqlite/`. Names of types and errors below are the contract between layers; French
text appears only in the UI adapter (Principle X).

## Shared value rules

### Name (articles, categories, lists)

| Rule | Source | Domain error |
|---|---|---|
| Cleaned before use and storage: NFC, trimmed, inner runs of white space reduced to one space | FR-021, FR-022 | – |
| Not empty after cleaning | FR-022, US2-11, US3-6, US4-4 | `NameRequired` |
| At most 60 characters after cleaning, counted in Unicode code points | FR-022 | `NameTooLong` |
| Unique within its kind, comparing `normalizedName` | FR-021, FR-024 | `NameAlreadyUsed` (carries the existing entity) |

- `cleanName(text) = text.normalize('NFC').replace(/[\u200B-\u200D\u2060\uFEFF]/gu, '').trim().replace(/\s+/gu, ' ')`: invisible characters (zero-width space, non-joiner and
  joiner, word joiner, byte order mark) are removed, and JavaScript's `trim()` and `\s` cover
  every Unicode space, non-breaking ones included, tabs and line breaks (FR-022).
- `normalizedName(name) = foldLetters(cleanName(name).toLocaleLowerCase('fr'))`, where
  `foldLetters` replaces "œ" with "oe", "æ" with "ae" and the curly apostrophe "’" (U+2019) with
  "'": case, outer and repeated inner spaces, composed or decomposed accents, these ligatures and
  the apostrophe style are ignored, so "Oeufs" = "Œufs" and "Pâte d'amande" = "Pâte d’amande";
  accents themselves are kept, so "Pâte" ≠ "Pâté" (FR-021, [research.md](research.md) R6).
- `searchForm(text) = normalizedName(text)` without diacritics (`NFD`, combining marks removed),
  so "oeuf" and "œuf" have the same search form, and so do "d'amande" and "d’amande" (FR-009).
- The name is stored cleaned ("Houmous"; "Pommes  de terre" is stored "Pommes de terre");
  `normalizedName` is stored next to it.
- The length is counted as `[...name].length`, the unit SQLite's `length()` counts, so the
  domain rule and the `CHECK` constraint agree.

### Quantity (value object)

```text
Quantity = { amount: number; unit: string | null }
```

| Rule | Source | Domain error |
|---|---|---|
| Amount text is digits with at most one `,` or `.` decimal separator, digits on both sides (`^-?\d+([.,]\d+)?$`); spaces, `+`, exponents and other text refused | FR-014, FR-016, FR-017, edge case | `AmountNotANumber` |
| `amount > 0` (a leading `-` or zero) | FR-016, US2-12 | `AmountNotPositive` |
| At most 3 digits after the separator, as typed | FR-016 | `AmountTooPrecise` |
| `amount <= 9999` | FR-016 | `AmountTooLarge` |
| `unit` cleaned like a name (`cleanName`: NFC, invisible characters removed, trimmed, inner spaces reduced); a unit empty after cleaning becomes `null` | FR-014, FR-022 | – |
| A unit requires an amount | FR-016, US2-13 | `UnitWithoutAmount` |
| `unit` at most 15 characters | FR-022 | `UnitTooLong` |

`parseQuantity(amountText, unitText)` returns `null` (no quantity) when both texts are blank,
a `Quantity`, or the first error above, in table order. Formatting ("1,5 kg") is done by the UI
adapter: decimal comma, no trailing zeros ("1,50" → "1,5", "2,0" → "2"), no digit grouping
([research.md](research.md) R7).

## Entities

### Category

| Field | Type | Notes |
|---|---|---|
| `id` | `CategoryId` (UUID string) | From `IdGenerator`. |
| `name` | `string` | Name rules. |
| `position` | `number` (integer ≥ 0) | Display order. Defaults take 0..10 in the order of the spec's Assumptions; each user-created category takes `max(position) + 1`. |

Default categories (seeded by `initializeStore`, names supplied by the UI adapter): Fruits et
légumes, Boucherie et poissonnerie, Crèmerie, Boulangerie, Épicerie salée, Épicerie sucrée,
Surgelés, Boissons, Hygiène et beauté, Entretien, Divers.

### Article (catalog entry)

| Field | Type | Notes |
|---|---|---|
| `id` | `ArticleId` | |
| `name` | `string` | Name rules; unique in the catalog. |
| `categoryId` | `CategoryId` | Exactly one; must exist (`CategoryNotFound` otherwise). |

No quantity (FR-013). The catalog is the set of all articles; it starts empty.

### ShoppingList

| Field | Type | Notes |
|---|---|---|
| `id` | `ListId` | |
| `name` | `string` | Name rules; unique among lists. |

Lists are never deleted in this feature, so at least one always exists.

### ListItem

Items are created, changed and removed only on the current list (FR-008); the use cases take
a `listId`, and the UI adapter always passes the current list's id.

| Field | Type | Notes |
|---|---|---|
| `listId` | `ListId` | Identity is the pair (`listId`, `articleId`): an article appears at most once per list (FR-011). |
| `articleId` | `ArticleId` | |
| `inCart` | `boolean` | `false` when added (FR-012). |
| `quantity` | `Quantity \| null` | Belongs to this item only (FR-013, US2-5). |

### Current list (application state)

A single value `currentListId: ListId`, always set after `initializeStore` (FR-002). Kept across
restarts (FR-025).

## Read models (returned by query use cases)

```text
CurrentListView = {
  list: { id, name }
  remainingCount: number                    // items with inCart = false (FR-006)
  totalCount: number
  hasItemsInCart: boolean                   // shows "Terminer les courses"; the store updates it with each optimistic tick (FR-007)
  sections: Array<{
    category: { id, name }
    items: Array<{ articleId, name, inCart, quantity }>
  }>
}
```

- Sections only for categories holding at least one item of the list (FR-003, US4-5), ordered by
  `position`.
- Within a section: items with `inCart = false` first, then `inCart = true` (FR-005); each group
  sorted by `name` with `compareNames`, the French collator comparing numbers by value, so
  "Lait 2 L" comes before "Lait 10 L" (Assumptions, [research.md](research.md) R6). Every other
  name sort (catalog, lists) uses the same function.

```text
CatalogView = {
  sections: Array<{
    category: { id, name }
    articles: Array<{ id, name, onList: boolean, quantity: Quantity | null }>   // quantity on the target list
  }>
}
```

- The query is cleaned first (`cleanName`); a query empty after cleaning counts as no query
  (FR-009, US2-10).
- Without a query: every category, ordered by `position`, including empty ones (US2-15).
- With a query: only articles whose `searchForm(name)` contains `searchForm(query)` (FR-009),
  still grouped by category, with empty categories omitted; no section at all means "no match"
  (US2-14).
- `onList` marks articles already on the target list (FR-011, US2-8).

```text
ListSummary = { id, name, itemCount: number, isCurrent: boolean }   // US3-8
RemovedItem = { listId, articleId, inCart, quantity }                // undo snapshot (FR-010)
```

## State transitions

```text
ListItem
  (absent) --addArticleToList / createArticleAndAddToList--> { inCart: false, quantity? }
  { inCart: false } --toggleItemInCart--> { inCart: true }
  { inCart: true }  --toggleItemInCart--> { inCart: false }
  any               --changeItemQuantity(q | null)--> same inCart, quantity = q
  any               --removeItemFromList--> (absent)        returns RemovedItem
  (absent)          --restoreRemovedItem(RemovedItem)--> previous inCart and quantity
  all items of list --finishShopping--> every inCart = false (quantities kept, items kept)

Current list
  L1 --setCurrentList(L2)--> L2      (L2 must exist: ListNotFound otherwise)
```

`finishShopping` on a list with no item in the cart changes nothing and succeeds. The UI does
not offer the action then, but a finish queued behind the only tick can meet that case when
the tick's save fails (FR-007).

## SQLite schema (migration 1)

This schema is the device's local replica (constitution v2.0.0, Principle VII). It has no
synchronization column or table: those come with the sync feature's own migration
([research.md](research.md#r19-synchronization-deferred-principle-vii) R19).

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;     -- set by openDatabase before migrating (research R4)
PRAGMA synchronous = FULL;     -- every commit synced to storage: survives a power cut (FR-028)

CREATE TABLE category (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  normalized_name TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL UNIQUE
);

CREATE TABLE article (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  normalized_name    TEXT NOT NULL UNIQUE,
  category_id TEXT NOT NULL REFERENCES category(id)
);

CREATE TABLE shopping_list (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  normalized_name TEXT NOT NULL UNIQUE
);

CREATE TABLE list_item (
  list_id         TEXT NOT NULL REFERENCES shopping_list(id),
  article_id      TEXT NOT NULL REFERENCES article(id),
  in_cart         INTEGER NOT NULL DEFAULT 0 CHECK (in_cart IN (0, 1)),
  quantity_amount REAL CHECK (quantity_amount IS NULL OR (quantity_amount > 0 AND quantity_amount <= 9999)),
  quantity_unit   TEXT CHECK (quantity_unit IS NULL OR length(quantity_unit) BETWEEN 1 AND 15),
  PRIMARY KEY (list_id, article_id),
  CHECK (quantity_unit IS NULL OR quantity_amount IS NOT NULL)
);

CREATE INDEX list_item_article ON list_item(article_id);

CREATE TABLE app_state (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  current_list_id TEXT NOT NULL REFERENCES shopping_list(id)
);
```

- `PRAGMA user_version` records the applied migration number; migrations run in one transaction at
  startup before `initializeStore`. A failed migration rolls back and leaves the earlier schema
  and data untouched; the database file is never deleted or recreated to recover (FR-039,
  [research.md](research.md) R18a).
- Later migrations (002, 003) keep every stored list, item, tick, quantity, article, category
  and the current list; each is tested on a database filled with the previous schema (FR-040).
  A `user_version` above the highest known migration means the data comes from a newer version:
  nothing runs and the app asks to be updated ([research.md](research.md) R18c).
- `length()` counts characters, matching the domain's 60 / 15 limits. The domain validates first;
  the constraints are the safety net, and a constraint failure is an unexpected error (reported).
- The `app_state` single row enforces "exactly one current list" (FR-002).
- Foreign keys use the default `NO ACTION`; deleting articles is specified in
  [002-manage-articles](../002-manage-articles/spec.md), which removes list items explicitly
  before the article and needs no migration.
