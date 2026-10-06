# Contract: Screens and User-Facing Text

Changes to [001's screens](../../001-shopping-lists/contracts/ui-screens.md) for this feature.
UI tests assert this text exactly (Principles II and X). Every component comes from React Native
Paper or the shared module `apps/mobile/src/adapters/ui/components/` (Principle V); data comes from the store
([ui-state.md](ui-state.md)).

## Navigation

```text
CurrentList
 └─ AddArticles (catalog)
     ├─ CreateArticle
     └─ EditArticle        (new: row menu "Modifier")
```

New dialog: DeleteArticleDialog. New app-wide component: UndoSnackbar.

## Shared components (new or changed)

| Component | Role |
|---|---|
| `ArticleRow` (changed) | Adds a trailing icon button, label "Plus d'actions pour « {name} »", opening a `Menu` with "Modifier" and "Supprimer". The same two actions are accessibility actions of the row. Tapping the row itself still opens QuantityDialog (001). |
| `CategoryPicker` (extracted from CreateArticle) | Radio list of all categories by position, plus "Nouvelle catégorie" (CreateCategoryDialog); a new category is preselected (US3-4). |
| `UndoSnackbar` (new) | Rendered once at the app root from `pendingUndo`; text per kind (below), action "Annuler", dismissed after 5 s, or only by the user while a screen reader is on ([001 Undo offer](../../001-shopping-lists/contracts/ui-screens.md#undo-offer)). |
| `NoticeSnackbar` (new) | Rendered once at the app root from `notice`. |

## AddArticles (changed)

States are unchanged. Row menu actions:

| Action | Behavior |
|---|---|
| "Modifier" | Opens EditArticle for this article (FR-001). |
| "Supprimer" | Loads the article's usage, then opens DeleteArticleDialog. If loading fails: `writeFailed` notice, reported. |

After an edit or a deletion the catalog shows the change (search results included, US1-3,
US2-1); a category left empty shows 001's empty-category state (US2-8).

## EditArticle (new screen)

Appbar title "Modifier l'article", back action. `NameField` "Nom" prefilled with the current name,
`CategoryPicker` with the current category selected, button "Enregistrer".

| Outcome | Shown |
|---|---|
| Success | Back to AddArticles; no snackbar (the change is visible). |
| `NameRequired` | "Indiquez un nom." (US1-6) |
| `NameTooLong` | "Le nom ne peut pas dépasser 60 caractères." (US1-6) |
| `NameAlreadyUsed` | "Un article « {existing.name} » existe déjà." (US1-4) |
| `CategoryNotFound`, `ArticleNotFound`, unexpected failure | Screen stays open, `writeFailed` snackbar "La modification n'a pas pu être enregistrée.", reported. |

Back without saving changes nothing (US1-7). After a refused save, the field keeps what the user
typed so they can correct it, and the stored name is unchanged (US1-6).

## DeleteArticleDialog (new)

Title "Supprimer « {name} » ?". Body by usage (FR-006, US2-3):

| Usage | Body |
|---|---|
| No list | "L'article sera retiré du catalogue." |
| One list | "Il est dans la liste « {list} » et en sera retiré." |
| Several lists | "Il est dans les listes « {list1} », « {list2} » et « {list3} » et en sera retiré." (French list join with "et") |

Buttons "Annuler" (closes, nothing changes, US2-2) and "Supprimer" (deletes, closes, US2-1,
US2-4). An unexpected failure on delete: dialog closes, nothing changes, `writeFailed` snackbar,
reported.

## UndoSnackbar

| `pendingUndo.kind` | Text | Action |
|---|---|---|
| `deletedArticle` | "« {name} » supprimé" | "Annuler" restores the article and its list items (US2-5). |
| `removedItem` (001) | "« {name} » retiré de la liste" | "Annuler" restores the item (001 US2-16). |

Shown on whatever screen is displayed, for 5 s (no timeout while a screen reader is on), or
until the next write (US2-6). Undo failure:
the change stays, `writeFailed` snackbar, reported.

## Accessibility

- Row menu button and actions have the French labels above; the menu items are 48 dp high (Paper
  default).
- The dialog's buttons and the snackbar's action are reachable by screen readers; the snackbar
  text is announced (Paper `Snackbar` live region).

## Stories and end-to-end journeys

Additions to [001's validation contract](../../001-shopping-lists/contracts/ui-validation.md)
(001 research R22, R23).

| Story id | Shows | Scenarios |
|---|---|---|
| `Components/CategoryPicker/Default`, `.../NewCategorySelected` | categories by position; a new category preselected | US3-4 |
| `Components/UndoSnackbar/DeletedArticle` | "« Lait » supprimé" with "Annuler" | US2-5 |
| `Screens/EditArticle/Default` | name and category prefilled | US1-1 |
| `Screens/EditArticle/NameAlreadyUsed`, `.../NameRequired` | the field errors | US1-4, US1-6 |
| `Dialogs/DeleteArticleDialog/NoList`, `.../OneList`, `.../SeveralLists` | the three bodies | US2-3 |

| File | Journey | Scenarios |
|---|---|---|
| `rename-article.e2e.ts` | Create "Lait", add it to "Ma liste" ticked and to "Barbecue"; rename it "Lait demi-écrémé" from the catalog menu; both lists show the new name with ticked state and quantity kept; terminate and relaunch: still renamed. | US1-1, US1-2, SC-005 |
| `delete-article.e2e.ts` | Delete "Lait" from the catalog: the dialog names both lists; confirm; the lists no longer show it; tap "Annuler" on the current list: it is back on both, same state. | US2-1, US2-3, US2-5 |
