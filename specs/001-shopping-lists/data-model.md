# Data Model: Shopping Lists

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

The domain model is in `src/domain/` (pure TypeScript). Its storage in SQLite is in
`src/adapters/sqlite/`. Names of types and errors below are the contract between layers; French
text appears only in the UI adapter (Principle X).

## Shared value rules

### Name (articles, categories, lists)

| Rule | Source | Domain error |
|---|---|---|
| Trimmed before use and storage | FR-022 | – |
| Not empty after trimming | FR-022, US2-11, US3-6, US4-4 | `NameRequired` |
| At most 60 characters after trimming | FR-022 | `NameTooLong` |
| Unique within its kind, comparing `normalizedName` | FR-021, FR-024 | `NameAlreadyUsed` (carries the existing entity) |

- `normalizedName(name) = name.trim().toLocaleLowerCase('fr')` (accents kept).
- `searchForm(text) = normalizedName(text)` without diacritics (`NFD`, combining marks removed).
- The name is stored as typed after trimming ("Houmous"); `normalizedName` is stored next to it.

### Quantity (value object)

```text
Quantity = { amount: number; unit: string | null }
```

| Rule | Source | Domain error |
|---|---|---|
| `amount` is a finite number; `,` or `.` accepted as decimal separator when parsing | FR-014, FR-017, edge case | `AmountNotANumber` |
| `amount > 0` | FR-016, US2-12 | `AmountNotPositive` |
| `unit` trimmed; empty unit becomes `null` | FR-014 | – |
| A unit requires an amount | FR-016, US2-13 | `UnitWithoutAmount` |
| `unit` at most 15 characters | FR-022 | `UnitTooLong` |

`parseQuantity(amountText, unitText)` returns `null` (no quantity) when both texts are blank,
a `Quantity`, or one of the errors above. Formatting ("1,5 kg") is done by the UI adapter.

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
  hasItemsInCart: boolean                   // enables "Terminer les courses"
  sections: Array<{
    category: { id, name }
    items: Array<{ articleId, name, inCart, quantity }>
  }>
}
```

- Sections only for categories holding at least one item of the list (FR-003, US4-5), ordered by
  `position`.
- Within a section: items with `inCart = false` first, then `inCart = true` (FR-005); each group
  sorted by `name` with the French collator (Assumptions).

```text
CatalogView = {
  sections: Array<{
    category: { id, name }
    articles: Array<{ id, name, onList: boolean, quantity: Quantity | null }>   // quantity on the target list
  }>
}
```

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

`finishShopping` on a list with no item in the cart returns `NothingInCart` and changes nothing
(edge case); the UI does not offer the action in that case.

## SQLite schema (migration 1)

```sql
PRAGMA foreign_keys = ON;

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
  quantity_amount REAL CHECK (quantity_amount IS NULL OR quantity_amount > 0),
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
  startup before `initializeStore`.
- `length()` counts characters, matching the domain's 60 / 15 limits. The domain validates first;
  the constraints are the safety net, and a constraint failure is an unexpected error (reported).
- The `app_state` single row enforces "exactly one current list" (FR-002).
- Foreign keys use the default `NO ACTION`; deleting articles is specified in
  [002-manage-articles](../002-manage-articles/spec.md) and will add its own migration.
