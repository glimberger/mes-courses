# Contract: UI screens and navigation of the tab navigation

Supersedes the navigation section of [001 ui-screens](../../001-shopping-lists/contracts/ui-screens.md) for routes, and the add and edit parts of [002](../../002-manage-articles/spec.md). Visual reference: `design/mockups/`.

## Navigation

```text
Tabs (bottom bar, opens on Courses)
├── Courses    shopping_cart          stack: CurrentList → AddArticles → CreateArticle
├── Listes     format_list_bulleted   stack: Lists
├── Articles   grocery                stack: Catalog → CreateArticle
└── Réglages   settings               stack: Settings → Accounts, SignIn, ChoosePassword
```

| Route | Params | Stack |
| --- | --- | --- |
| `CurrentList` | none | Courses |
| `AddArticles` | none | Courses |
| `CreateArticle` | `{ name?, categoryId? }` | Courses and Articles (same screen, one route per stack) |
| `Lists` | none | Listes |
| `Catalog` | none | Articles |
| `Settings`, `Accounts`, `SignIn`, `ChoosePassword` | as today | Réglages |

The `EditArticle` route disappears (replaced by `EditArticleDialog`). The reported screen name is the route name of the visible screen.

Tab bar: labels "Courses", "Listes", "Articles", "Réglages"; accessible role tab, selected state announced; hidden only on full-screen start-up states.

## CurrentList (Courses)

- Header: title, sync status, "Terminer les courses"; no "Mes listes", no "Réglages".
- Extended FAB "Ajouter" -> `AddArticles`. Bottom inset under the list.
- Row: square checkbox on the left (struck-through name when in cart), name, quantity, ⋮ menu (accessible label "Actions pour <name>").
- Menu: "Quantité…" -> `QuantityDialog`; "Retirer de la liste" -> `remove-item-from-list`, then `UndoSnackbar` "Annuler" -> `restore-removed-item`. No confirmation.

## AddArticles (Courses)

- Back arrow ← to the list; no confirm button; search field on top.
- Row: card with name and category, round toggle on the right. Not added: `add_circle` outline, label "Ajouter <name>". Added: `check_circle` filled, tinted card and border, label "<name> ajoutée, toucher pour retirer".
- Tap: `add-article-to-list` with no quantity; tap on an added row: `remove-item-from-list`.
- Hidden: articles on the list when the screen opened. Shown: those added during the visit.
- No match: row "Créer « xyz »" -> `CreateArticle { name: 'xyz' }`; on return the new article is on the list (`create-article-and-add-to-list`).
- Match on a hidden article only: non-actionable text "« <name> » est déjà dans la liste".
- No edit, no delete, no cart icon at the start of rows.

## Lists (Listes)

- Row: list name, item count; current list has the chip "en cours" and the accessible label "<name>, liste en cours". No ⋮.
- Tap: `set-current-list`, then Courses tab reset to `CurrentList`.
- Extended FAB "Nouvelle liste" -> `CreateListDialog`. Bottom inset.

## Catalog (Articles)

- Search field on top; articles grouped by category (`CategoryHeader`), empty categories hidden.
- Row: name, badge with the number of lists (hidden at 0; accessible label "<name>, dans <n> listes"), ⋮ menu ("Actions pour <name>").
- Extended FAB "Nouvel article" -> `CreateArticle`. Bottom inset.
- Menu "Modifier" -> `EditArticleDialog`: name field, category picker ending with "+ Nouvelle catégorie" (`CreateCategoryDialog`), text "Ce changement s'applique à <n> liste(s)." ; save -> `edit-article`.
- Menu "Supprimer" -> `DeleteArticleDialog`: "Supprimer « <name> » ? L'article sera retiré de <n> liste(s)." ; confirm -> `delete-article`, then `UndoSnackbar` "Annuler" -> `restore-deleted-article`.

## Screen states

Every data screen (CurrentList, AddArticles, Lists, Catalog) keeps the loading, empty, error, success and synchronization states of Principle IX, with the shared components.

## Required stories

New or changed story ids are added to `required-stories.ts`: `Screens/CurrentList/*` (with row menu open), `Screens/AddArticles/*` (NotAdded, Added, NoMatchCreate, AlreadyOnList, Empty, Loading, Error), `Screens/Lists/*` (WithCurrentChip), `Screens/Catalog/*` (Default, Search, Empty, Loading, Error, RowMenu), `Dialogs/EditArticle`, `Dialogs/DeleteArticle`, `Components/TabBar`.
