# Contract: UI screens and navigation of the tab navigation

Supersedes the navigation section of [001 ui-screens](../../001-shopping-lists/contracts/ui-screens.md) for routes, and the add and edit parts of [002](../../002-manage-articles/spec.md). Visual reference: `design/mockups/`.

## Navigation

```text
Tabs (bottom bar, opens on Courses)
├── Courses    shopping_cart          stack: CurrentList → AddArticles → CreateArticle (adds to the list)
├── Listes     format_list_bulleted   stack: Lists
├── Articles   grocery                stack: Catalog → CreateArticle (catalog only)
└── Réglages   settings               stack: Settings → Accounts, SignIn, ChoosePassword
```

| Route | Params | Stack |
| --- | --- | --- |
| `CurrentList` | none | Courses |
| `AddArticles` | `{ createdArticleId? }` (set when coming back from `CreateArticle`, see below) | Courses |
| `CreateArticle` | `{ name?, categoryId?, addToList }` (`true` in Courses, `false` in Articles) | Courses and Articles (same screen, one route per stack) |
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
- Rows are grouped under category headers (`CategoryHeader`, empty categories hidden); a row is a card with the name only (the category is not repeated), round toggle on the right. Not added: `add_circle` outline, label "Ajouter <name>". Added: `check_circle` filled, tinted card and border, label "<name>, dans la liste, toucher pour retirer" (no gender agreement).
- Tap: `add-article-to-list` with no quantity. Tap on an added row: the store action `removeItemQuietly` (see research.md, "Un-tap"): `remove-item-from-list`, then its held changes are released at once, with no `removedItem` undo offer and no snackbar.
- Hidden: articles on the list when the screen opened. Shown: those added during the visit, including an article created through "Créer « xyz »".
- No match: row "Créer « xyz »" -> `CreateArticle { name: 'xyz', addToList: true }` (`create-article-and-add-to-list`); on return the screen opens with `createdArticleId`, which is added to the visit set, so the row is shown marked as added and can be un-tapped.
- Match on a hidden article only: non-actionable text "« <name> » est déjà dans la liste".
- No edit, no delete, no cart icon at the start of rows.

## Lists (Listes)

- Row: list name, item count; current list has the chip "en cours" and the accessible label "<name>, liste en cours". No ⋮.
- Tap: `set-current-list`, then Courses tab reset to `CurrentList`.
- Extended FAB "Nouvelle liste" -> `CreateListDialog`. Bottom inset.

## Catalog (Articles)

- Search field on top; articles grouped by category (`CategoryHeader`), empty categories hidden.
- Row: name, badge with the number of lists (hidden at 0), ⋮ menu ("Actions pour <name>"). The counts of all rows come from one batch read (`get-article-usage-counts`), not one read per article. Badge accessible label: "<name>, dans 1 liste" (n = 1) or "<name>, dans <n> listes" (n > 1).
- Extended FAB "Nouvel article" -> `CreateArticle { addToList: false }`: the form has no quantity fields, creates the article in the catalog only (`create-article`, never on a list), and a name already used shows « <name> » existe déjà. with no "add to the list" offer. Bottom inset.
- Menu "Modifier" -> `EditArticleDialog`: name field, category picker ending with "+ Nouvelle catégorie" (`CreateCategoryDialog`), note (single source of the texts, mockup 22): "Ce changement s’applique à 1 liste." (n = 1), "Ce changement s’applique à <n> listes." (n > 1), "Cet article n’est dans aucune liste." (n = 0); save -> `edit-article`.
- Menu "Supprimer" -> `DeleteArticleDialog` (single source of the texts, mockup 24): title "Supprimer « <name> » ?", body "L’article sera retiré de 1 liste." (n = 1), "L’article sera retiré de <n> listes." (n > 1), "L’article n’est dans aucune liste." (n = 0); buttons "Annuler" and "Supprimer"; confirm -> `delete-article`, then `UndoSnackbar` "Annuler" -> `restore-deleted-article`.

## Screen states

Every data screen (CurrentList, AddArticles, Lists, Catalog) keeps the loading, empty, error, success and synchronization states of Principle IX, with the shared components.

## Required stories

New or changed story ids are added to `required-stories.ts`: `Screens/CurrentList/*` (with row menu open), `Screens/AddArticles/*` (NotAdded, Added, NoMatchCreate, AlreadyOnList, Empty, Loading, Error), `Screens/Lists/*` (WithCurrentChip), `Screens/Catalog/*` (Default, Search, Empty, Loading, Error, RowMenu), `Dialogs/EditArticle`, `Dialogs/DeleteArticle`, `Components/TabBar`; `Screens/CreateArticle/*` gains a catalog-only story (no quantity fields, name already used without the add offer).
