# Contract: Driving Ports (use cases)

The operations the application layer offers to the UI adapter (Principle VI). Each is an async
function in `apps/mobile/src/application/use-cases/`, built by the composition root from the driven ports in
[driven-ports.md](driven-ports.md). Types are defined in [../data-model.md](../data-model.md).

## Conventions

- Every failure of a business rule is returned as a value, never thrown: refused input, a
  missing record (`ItemNotOnList`, `ArticleNotFound`, ...) and the wrong state
  (`NothingInCart`, `AlreadyOnList`).
  `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`.
  Errors are tagged unions (`{ type: 'NameRequired' }`, `{ type: 'NameAlreadyUsed'; existing }`, ...).
  Domain functions follow the same rule: they return a `Result` for a broken business rule and
  throw nothing else. Use cases throw only technical failures (storage errors, a bug).
- Refused input (`NameError`, `NameAlreadyUsed`, `QuantityError`) and `AlreadyOnList` returned
  by `addArticleToList` (US2-8)
  are shown by the UI adapter in French (Principle X) and never reported: they are FR-030's
  expected situations. Every other returned error cannot come from the user's input in 001:
  the store shows the usual failed-save notice and reports it as an `UnexpectedResult` error
  whose code is the result's tag ([002 ui-state](../../002-manage-articles/contracts/ui-state.md)
  rule 4, the store contract's owner). Under sync (003) some of these states become reachable;
  a later feature may name them as its own expected situations (FR-030b), as 003 does for an
  article deleted on another device (a `restoreRemovedItem` returning `ArticleNotFound` shows
  its own notice, unreported). Every returned failure that no feature names stays reported.
- Thrown failures are unexpected (except `StorageFull` and `DataFromNewerVersion`, R12a and
  R18c). The UI adapter catches them, shows the error state or a French snackbar, and reports
  them through `ErrorReporter` (Principle VIII).
- Every write is committed to storage before the promise resolves (FR-028).
- `NameError = NameRequired | NameTooLong`;
  `QuantityError = AmountNotANumber | AmountNotPositive | AmountTooPrecise | AmountTooLarge |
  UnitWithoutAmount | UnitTooLong`.
  Quantities reach use cases already parsed: the UI adapter calls the domain's `parseQuantity`
  and shows its errors next to the fields.

## Startup

| Use case | Signature | Behavior |
|---|---|---|
| `initializeStore` | `(seed: { categoryNames: string[]; firstListName: string }) => Promise<void>` | When no list exists: creates the categories in order, the first list, and makes it current, in one transaction. Otherwise does nothing. (FR-020, FR-023, US3-1, US4-1) |

## Current list (User Story 1)

| Use case | Signature | Behavior |
|---|---|---|
| `getCurrentList` | `() => Promise<CurrentListView>` | Read model of the current list (FR-001, FR-003, FR-005, FR-006). |
| `toggleItemInCart` | `(listId, articleId) => Promise<Result<{ inCart: boolean }, ItemNotOnList>>` | Flips `inCart` (FR-004). |
| `finishShopping` | `(listId) => Promise<Result<void, NothingInCart>>` | Sets every item of the list to `inCart = false`; items and quantities kept (FR-007). The confirmation dialog is UI-only. |

## Editing a list (User Story 2)

Lists are edited only while current (FR-008): the UI adapter calls these use cases, and
`toggleItemInCart` and `finishShopping`, with the current list's id only. The use cases keep
their `listId` parameter, which their tests use to check that each list keeps its own items
(FR-026, US2-5).

| Use case | Signature | Behavior |
|---|---|---|
| `getCatalog` | `(listId, query?: string) => Promise<CatalogView>` | Catalog grouped by category with `onList` marks; filtered by `query` when given (FR-008, FR-009, FR-011). |
| `addArticleToList` | `(listId, articleId, quantity: Quantity \| null) => Promise<Result<void, AlreadyOnList \| ArticleNotFound>>` | Adds an unticked item (FR-012). `AlreadyOnList` carries the current quantity, so the UI can offer to change it (US2-8). |
| `createArticleAndAddToList` | `(listId, { name, categoryId }, quantity: Quantity \| null) => Promise<Result<{ articleId }, NameError \| NameAlreadyUsed \| CategoryNotFound>>` | Creates the article and adds it, in one transaction (US2-7). `NameAlreadyUsed.existing` is the matching article (US2-9). |
| `changeItemQuantity` | `(listId, articleId, quantity: Quantity \| null) => Promise<Result<void, ItemNotOnList>>` | Sets or clears the quantity of this list item only (FR-015, US2-3, US2-4, US2-5). |
| `removeItemFromList` | `(listId, articleId) => Promise<Result<RemovedItem, ItemNotOnList>>` | Deletes the item; the article stays in the catalog (FR-010). |
| `restoreRemovedItem` | `(removed: RemovedItem) => Promise<Result<void, AlreadyOnList \| ListNotFound \| ArticleNotFound>>` | Re-inserts the item with its `inCart` and quantity (US2-16). |

## Named lists (User Story 3)

| Use case | Signature | Behavior |
|---|---|---|
| `getLists` | `() => Promise<ListSummary[]>` | All lists, sorted by name with the French collator, each with its item count and current mark (US3-8). |
| `createList` | `(name: string) => Promise<Result<{ listId }, NameError \| NameAlreadyUsed>>` | Creates an empty list; does not make it current (US3-2, US3-5, US3-6). |
| `setCurrentList` | `(listId) => Promise<Result<void, ListNotFound>>` | Changes the current list (FR-025, US3-3). |

## Categories (User Story 4)

| Use case | Signature | Behavior |
|---|---|---|
| `getCategories` | `() => Promise<Array<{ id, name }>>` | Ordered by `position` (US4-1, US4-2). |
| `createCategory` | `(name: string) => Promise<Result<{ categoryId }, NameError \| NameAlreadyUsed>>` | Appends a category after the existing ones (US4-2, US4-3, US4-4). |

## Domain functions used directly by the UI adapter

Pure functions with no side effects, so calling them from the UI does not break Principle VI:

- `parseQuantity(amountText, unitText): Result<Quantity | null, QuantityError>`
- `validateName(text): Result<string, NameError>`: lets forms show errors before submitting.
  It returns the clean name (NFC, trimmed, inner spaces reduced, [../data-model.md](../data-model.md#name-articles-categories-lists)).
