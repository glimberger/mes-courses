# Contract: Screens and User-Facing Text

The UI adapter (`apps/mobile/src/adapters/ui/`) as the user meets it: screens, their states, actions,
accessibility labels and French text. UI tests assert this text exactly (Principles II and X).
Wording may be polished during implementation; when it changes, this contract and the tests
change together.

Every screen is built only from React Native Paper components and the shared components in
`apps/mobile/src/adapters/ui/components/` (Principle V). Every data region renders one `ScreenState`
(`loading | empty | error | success`) through the shared `LoadingState`, `EmptyState` and
`ErrorState` components (Principle IX). Screens read and change data through the application
store (Zustand, [research.md](../research.md) R10,
[002 ui-state contract](../../002-manage-articles/contracts/ui-state.md)); snackbars are rendered
once at the app root from the store.

## Navigation

```text
CurrentList (initial)
 ├─ Lists          (Appbar title or "Mes listes" action)
 └─ AddArticles    (FAB "Ajouter")
     └─ CreateArticle (from empty search / empty category / "Nouvel article")
```

Dialogs (Paper `Dialog` in a `Portal`): QuantityDialog, FinishShoppingDialog, CreateListDialog,
CreateCategoryDialog.

## Shared components

| Component | Role |
|---|---|
| `LoadingState` | Centered `ActivityIndicator`, accessibility label "Chargement". |
| `EmptyState` | Message and optional action button. |
| `ErrorState` | Message and "Réessayer" button. |
| `ListItemRow` | Tappable row: checkbox, name, quantity, trailing actions; ticked style = check mark + struck-through text + muted color; min height 48 dp; text wraps. |
| `ArticleRow` | Catalog row with optional "Déjà dans la liste" chip. |
| `QuantityFields` | Two `TextInput`s ("Quantité", "Unité") with `HelperText` errors; numeric keyboard with decimal separator. |
| `NameField` | `TextInput` with 60-character limit and `HelperText` error. |
| `ScreenStateView` | Renders a `ScreenState` with the three components above. |
| `UndoSnackbar`, `NoticeSnackbar` | App-wide snackbars rendered from the store's `pendingUndo` and `notice`. |
| `formatQuantity(q)` | `Intl.NumberFormat('fr-FR')` amount + optional unit, for example "1,5 kg". |

## CurrentList

| State | Shown |
|---|---|
| loading | `LoadingState` (US1-11) |
| error | "Impossible de charger la liste." + "Réessayer"; error reported (US1-12) |
| empty | Title = list name; "Votre liste est vide" + "Ajouter des articles" (US1-10) |
| success | Title = list name; subtitle "{n} article(s) restant(s)" ("3 articles restants", "1 article restant", "Tout est dans le caddie" when 0); one section per category, heading = category name; rows per [data-model](../data-model.md) order (US1-1, US1-6, US1-7) |

| Action | Behavior |
|---|---|
| Tap a row | Tick or untick immediately (optimistic); on save failure revert, snackbar "La modification n'a pas pu être enregistrée.", report. (US1-2, US1-3) |
| Row action "Modifier la quantité" | Opens QuantityDialog prefilled. |
| Row action "Retirer de la liste" | Removes at once; snackbar "« {name} » retiré de la liste" with action "Annuler" (US2-6, US2-16), offered per [Undo offer](#undo-offer). |
| Appbar action "Terminer les courses" | Shown only when `hasItemsInCart`. Opens FinishShoppingDialog (US1-8, US1-9). |
| Appbar action "Mes listes" | Opens Lists (SC-005: 2 taps with the list choice). |
| FAB "Ajouter" | Opens AddArticles. |

Row accessibility (FR-032): role `checkbox`, `checked` state, label
"{name}[, {quantity}], {dans le caddie | pas dans le caddie}", for example
"Lait, 2 L, dans le caddie". Accessibility actions: "Modifier la quantité", "Retirer de la liste".

## FinishShoppingDialog

"Terminer les courses ?" / "Tous les articles seront décochés et resteront dans la liste." /
buttons "Annuler" and "Terminer".

## AddArticles

Appbar title "Ajouter des articles", `Searchbar` with placeholder "Rechercher un article".

| State | Shown |
|---|---|
| loading | `LoadingState` (US2-17) |
| error | "Impossible de charger les articles." + "Réessayer"; reported (US2-18) |
| success, no query | Every category as a section (US2-15 for empty ones: "Aucun article dans cette catégorie" + "Créer un article") |
| success, query, matches | Matching articles grouped by category (US2-10) |
| empty, query, no match | "Aucun article ne correspond à « {query} »" + "Créer « {query} »" (US2-14) |

Search filters the catalog already loaded on this screen, so it has no loading or error state of
its own (FR-029).

| Action | Behavior |
|---|---|
| Tap an article not on the list | Opens QuantityDialog in "add" mode; "Ajouter" with empty fields adds without quantity (SC-003: tap + "Ajouter"). |
| Tap an article marked "Déjà dans la liste" | QuantityDialog in "already on list" mode: message "« {name} » est déjà dans la liste.", fields prefilled, buttons "Fermer" and "Modifier la quantité" (US2-8). |
| "Nouvel article" (Appbar action) or empty-state action | Opens CreateArticle, name prefilled with the query if any. |

The screen stays open after adding, so several articles can be added in a row; a snackbar
confirms "« {name} » ajouté". Back returns to CurrentList, already reloaded by the store after the
write.

## QuantityDialog

Title = article name. `QuantityFields`. Field errors (FR-016):

| Domain error | Text |
|---|---|
| `AmountNotANumber`, `AmountNotPositive` | "La quantité doit être un nombre positif." |
| `UnitWithoutAmount` | "Indiquez une quantité pour cette unité." |
| `UnitTooLong` | "L'unité ne peut pas dépasser 15 caractères." |

Edit mode adds "Effacer la quantité" (US2-4).

## CreateArticle

Appbar title "Nouvel article". `NameField` "Nom", category picker (radio list of categories plus
"Nouvelle catégorie" opening CreateCategoryDialog, new category preselected on success),
`QuantityFields` (optional), button "Créer et ajouter".

| Domain error | Text |
|---|---|
| `NameRequired` | "Indiquez un nom." (US2-11) |
| `NameTooLong` | "Le nom ne peut pas dépasser 60 caractères." |
| `NameAlreadyUsed` | "« {existing.name} » existe déjà." + button "Ajouter « {existing.name} »", which adds the existing article (US2-9) |
| No category chosen | "Choisissez une catégorie." |

Success: back to AddArticles, snackbar "« {name} » ajouté" (US2-7).

## CreateCategoryDialog

Title "Nouvelle catégorie", `NameField`, buttons "Annuler" / "Créer".
`NameAlreadyUsed` → "Cette catégorie existe déjà." (US4-3); `NameRequired` → "Indiquez un nom."
(US4-4).

## Lists

Appbar title "Mes listes".

| State | Shown |
|---|---|
| loading | `LoadingState` (US3-7) |
| error | "Impossible de charger vos listes." + "Réessayer"; reported (US3-7) |
| success | One row per list: name, "{n} article(s)", "Liste actuelle" mark (check icon + text) on the current one (US3-8) |

At least one list always exists, so there is no empty state.

| Action | Behavior |
|---|---|
| Tap a list | Makes it current and returns to CurrentList (US3-3). |
| FAB "Nouvelle liste" | Opens CreateListDialog. |

Row accessibility: "{name}, {n} articles[, liste actuelle]".

## CreateListDialog

Title "Nouvelle liste", `NameField`, buttons "Annuler" / "Créer".
`NameAlreadyUsed` → "Une liste porte déjà ce nom." (US3-5); `NameRequired` → "Indiquez un nom."
(US3-6).

## Undo offer

The `UndoSnackbar` is rendered once at the app root from the store's `pendingUndo`, so moving
between screens does not end the offer (FR-010):

- it is dismissed after 5 s, unless a screen reader is on: then it stays until the user
  dismisses it or makes another change;
- any other write, including a new removal or a change of the current list, ends the offer
  first, so only the last removal can be undone;
- it is never stored, so closing the app ends it.

A removal whose offer has ended is final.

## Unexpected write failures (edge case "storage fails")

Any write that throws: the change is not shown as saved, snackbar
"La modification n'a pas pu être enregistrée.", error reported with `{ operation, screen }`.
