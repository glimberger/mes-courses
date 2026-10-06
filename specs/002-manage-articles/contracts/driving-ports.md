# Contract: Driving Ports (use cases)

New use cases offered to the UI adapter, in `apps/mobile/src/application/use-cases/`. Conventions (`Result`,
tagged errors, thrown unexpected failures, commit before resolving) are those of
[001's driving ports](../../001-shopping-lists/contracts/driving-ports.md). Types are in
[../data-model.md](../data-model.md).

| Use case | Signature | Behavior |
|---|---|---|
| `editArticle` | `(articleId, { name: string; categoryId }) => Promise<Result<void, NameError \| NameAlreadyUsed \| CategoryNotFound \| ArticleNotFound>>` | Validates the name (001 rules, uniqueness among other articles) and the category, then saves both in one transaction; on any error nothing changes (FR-001, FR-002, FR-008, FR-008a, US1-1…US1-6, US3-1…US3-3). |
| `getArticleUsage` | `(articleId) => Promise<Result<ArticleUsage, ArticleNotFound>>` | The article and the lists holding it, sorted by name, for the delete confirmation (FR-006, US2-3). |
| `deleteArticle` | `(articleId) => Promise<Result<DeletedArticle, ArticleNotFound>>` | Removes the article's list items, then the article, in one transaction; returns the snapshot (FR-004…FR-006, US2-1, US2-4). |
| `restoreDeletedArticle` | `(deleted: DeletedArticle) => Promise<void>` | Re-inserts the article with its id, name and category, then each list item with its quantity and ticked state, in one transaction (FR-006a, US2-5). The UI ends the undo offer at the next write, so no business conflict can occur; a failure is unexpected and throws (edge case "undoing fails"). |

## Driven port changes

Added to [001's repositories](../../001-shopping-lists/contracts/driven-ports.md), each with its
in-memory fake, SQLite implementation and shared contract tests:

```ts
interface ArticleRepository {
  // existing: all, findById, findByNormalizedName, add
  update(article: Article): Promise<void>;          // name, normalized name, category
  remove(id: ArticleId): Promise<void>;             // fails if a list item still refers to it
}

interface ListItemRepository {
  // existing: forList, find, save, remove, takeAllOutOfCart
  forArticle(articleId: ArticleId): Promise<ListItem[]>;
  removeAllForArticle(articleId: ArticleId): Promise<void>;
}
```

`ErrorReporter` contexts used by this feature: `{ operation: 'editArticle' | 'getArticleUsage' |
'deleteArticle' | 'restoreDeletedArticle', screen: 'AddArticles' | 'EditArticle' }`. No article
or list name is ever attached (FR-011).
