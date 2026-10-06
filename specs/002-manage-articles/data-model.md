# Data Model: Manage Articles

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

Builds on [001's data model](../001-shopping-lists/data-model.md). Only changes are listed.

## Entities

### Article (changed)

Same fields as in 001 (`id`, `name`, `categoryId`). Two transitions are added:

| Transition | Rules | Domain errors |
|---|---|---|
| Edit (name and category together) | Name rules of 001 (cleaned, non-blank, ≤ 60 characters). Unique by `normalizedName` among **other** articles: the article's own name with a different case or spacing is accepted (FR-002, US1-5). The category must exist (FR-008). Both are validated before anything is written (US3-3). | `NameRequired`, `NameTooLong`, `NameAlreadyUsed` (carries the other article), `CategoryNotFound`, `ArticleNotFound` |
| Delete | Removes the article and every list item that refers to it; its category and the lists stay (FR-005, FR-006). | `ArticleNotFound` |

`id` never changes, so list items keep pointing at the article through any edit, and their
`quantity` and `inCart` are untouched (FR-003, FR-008a).

### DeletedArticle (new, in memory only)

The snapshot returned by a deletion and kept while "Annuler" is offered (FR-006a).

```text
DeletedArticle = {
  article: { id, name, categoryId }
  items: Array<{ listId, inCart, quantity: Quantity | null }>
}
```

- Never stored on disk: it lives in the UI store's `pendingUndo` ([research.md](research.md) R5),
  so a killed app makes the deletion final.
- Restoring re-inserts the article with the same `id`, then each item as it was (US2-5, SC-006).

### ArticleUsage (new read model)

What the delete confirmation shows (FR-006, US2-3).

```text
ArticleUsage = {
  article: { id, name }
  lists: Array<{ id, name }>    // lists holding the article, sorted by name (French collator)
}
```

## State transitions

```text
Article
  { name, categoryId } --editArticle(name', categoryId')--> { name', categoryId' }   (both or neither)
  present --deleteArticle--> absent, its list items absent      returns DeletedArticle
  absent  --restoreDeletedArticle(DeletedArticle)--> present with same id, items restored

Pending undo (UI store, one slot for the whole app)
  none --removeItemFromList / deleteArticle succeeds--> offered(snapshot)
  offered --"Annuler"--> none (restore runs)
  offered --5 s elapse (no screen reader) | snackbar dismissed | any other write starts | app killed--> none (final)
  offered(A) --another undoable change--> offered(B)  (A becomes final)
```

## Read models

`CurrentListView`, `CatalogView` and `ListSummary` are unchanged. They read each article's
current name and category, so an edit shows everywhere on the next read and sorting follows the
new name (US1-8, US3-1, US3-2). A deletion lowers `remainingCount` and `itemCount` (US2-4).

## SQLite

No migration, and no synchronization column or table: those come with the sync feature
([research.md](research.md#r7-synchronization-deferred-principle-vii) R7). Writes use the existing schema:

- Edit: `UPDATE article SET name = ?, normalized_name = ?, category_id = ? WHERE id = ?`. The
  `UNIQUE` index on `normalized_name` is the safety net for R3.
- Delete: `DELETE FROM list_item WHERE article_id = ?`, then `DELETE FROM article WHERE id = ?`,
  in one transaction. The `NO ACTION` foreign key from `list_item` refuses the article deletion if
  an item were left behind ([research.md](research.md) R4).
- Restore: `INSERT` of the article, then of each list item, in one transaction.
