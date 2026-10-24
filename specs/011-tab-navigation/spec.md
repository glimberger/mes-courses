# Feature Specification: Bottom Tab Navigation and Tap-to-Add Flow

**Feature Branch**: `docs/issue-170-specification-011-and-mockups-of-the-tab-navigation`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "Redesign the navigation and UX of the mobile app: a bottom tab bar with four tabs (Courses, Listes, Articles, Réglages), each with its own stack; the add screen becomes a fast tap-to-add catalog; catalog management (edit, delete, categories) moves to the Articles tab" (issue #170, epic #169). Builds on [001-shopping-lists](../001-shopping-lists/spec.md) and [002-manage-articles](../002-manage-articles/spec.md); the shared look comes from [008-mockup-fidelity-ui](../008-mockup-fidelity-ui/spec.md) and `design/mockups/`.

## Clarifications

### Session 2026-10-24

Questions were answered with the recommended option (no interactive session; the maintainer agreed the decisions of issue #170 beforehand).

- Q: On which screens is the tab bar visible? -> A: On the root screen of every tab and on the screens pushed inside a tab (add screen, article creation, accounts, sign-in, password choice), so the user can always switch tab; the active tab is highlighted. Full-screen start-up states (splash, startup error, update required, crash) have no tab bar.
- Q: What does a tab do when it is tapped while already selected? -> A: It goes back to the root screen of its stack (Courses: the current list), the usual mobile convention.
- Q: When "Terminer les courses" empties the list or the last list is removed, what do the tabs show? -> A: The Courses tab shows the existing empty state of the current list, with the "Ajouter" FAB; nothing else changes.
- Q: What does the Articles tab show for an article that is on no list? -> A: The row with no badge (a badge of 0 is never drawn).
- Q: Does the badge count lists that are archived or finished? -> A: It counts the lists that currently hold the article, as `get-article-usage` already returns them; no new rule.
- Q: What happens when an article is renamed to a name another article already has? -> A: The edit dialog refuses it with the existing duplicate-name message of feature 002, and keeps the dialog open.
- Q: In the add screen, what if the user taps an article added during this visit and the network or the sync is down? -> A: Same as any other change: it is applied to the local replica at once and synchronized later (Principle VII).
- Q: When "Créer « xyz »" opens article creation and the user goes back without saving? -> A: Nothing is created and nothing is added; the add screen is shown as it was, search text kept.
- Q: Does the row menu of the Courses tab also offer the check (in cart) action? -> A: No; ticking stays on the square checkbox of the row. The menu has exactly two entries.
- Q: Do the entries of the Articles menu and the add toggle need touch targets of 48 dp? -> A: Yes, as for every control of the app (feature 008); the accessible labels name the article.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move between the app's four areas with a bottom tab bar (Priority: P1)

Today "Mes listes" and "Réglages" are small icons in the header of the current list, and every screen is pushed on one stack. The shopper wants a bottom tab bar with four tabs, "Courses", "Listes", "Articles" and "Réglages", each keeping its own history, so any area is one tap away.

**Why this priority**: Every other story lives in a tab; without the tab bar none of them has a home.

**Independent Test**: Open the app: it shows the Courses tab. Tap each tab and check its content and highlight. In Courses, open the add screen, switch to Listes and back to Courses: the add screen is still there.

**Acceptance Scenarios**:

1. **Given** the app opens, **When** the start-up finishes, **Then** the Courses tab (`shopping_cart` icon) is selected and shows the current list, and the bar shows "Courses", "Listes", "Articles" (`grocery` icon) and "Réglages".
2. **Given** any tab is selected, **When** the shopper taps another tab, **Then** that tab is shown and highlighted.
3. **Given** the shopper is on the add screen of the Courses tab, **When** they switch to another tab and back, **Then** the add screen is shown again, not the list.
4. **Given** a tab is selected, **When** the shopper taps it again, **Then** its stack returns to its root screen.
5. **Given** the current list screen, **When** it is shown, **Then** its header has no "Mes listes" and no "Réglages" icon, and "Terminer les courses" is still there.
6. **Given** the Réglages tab, **When** the shopper opens accounts, sign-in or the choice of a password, **Then** these screens are in the Réglages stack and the tab bar stays visible.
7. **Given** a screen reader is on, **When** the tab bar is read, **Then** each tab has an accessible label and announces whether it is selected.
8. **Given** an undo or notice snackbar is shown, **When** it appears, **Then** it sits above the tab bar.

---

### User Story 2 - Shop from the current list and manage a row from its menu (Priority: P1)

On the Courses tab the shopper ticks articles as they go into the cart, sets a quantity, or takes an article off the list, without leaving the list.

**Why this priority**: It is the screen used in the shop; the quantity and removal actions move here from the add screen.

**Independent Test**: With a list holding three articles, open the ⋮ menu of a row, set "2 kg" with "Quantité…", then take another row off with "Retirer de la liste" and undo.

**Acceptance Scenarios**:

1. **Given** a current list, **When** it is shown, **Then** an extended FAB "Ajouter" is displayed and opens the add screen.
2. **Given** a row, **When** the shopper opens its ⋮ menu, **Then** it offers exactly "Quantité…" and "Retirer de la liste", with accessible labels naming the article.
3. **Given** the menu is open, **When** the shopper chooses "Quantité…", **Then** the quantity dialog (amount and unit) opens for this row only, and saving sets or clears the quantity of this item only.
4. **Given** the menu is open, **When** the shopper chooses "Retirer de la liste", **Then** the item leaves this list only, with no confirmation, and the "Annuler" snackbar brings it back with its quantity and tick.
5. **Given** an item is in the cart, **When** the row is shown, **Then** a square checkbox is on the left and the name is struck through.
6. **Given** a long list, **When** the shopper scrolls to the end, **Then** the last row and its ⋮ are fully visible above the FAB.
7. **Given** the list is empty or loading or in error, **When** the screen is shown, **Then** the existing state components are used (Principle IX) and the FAB stays reachable where it applies.

---

### User Story 3 - Add articles with one tap each (Priority: P1)

Adding several articles used to need one quantity dialog per article. The shopper wants to tap the articles they need and be done.

**Why this priority**: It is the main flow change of the feature.

**Independent Test**: Open the add screen on a list that already holds Lait, tap Carotte and Pain, tap Pain again, go back: the list holds Lait and Carotte, with no quantity.

**Acceptance Scenarios**:

1. **Given** the add screen is open (back arrow ← to the list), **When** the shopper taps an article, **Then** it is added to the current list at once, with no quantity and no dialog, and its row shows the added mark.
2. **Given** an article added during this visit, **When** the shopper taps it again, **Then** it is taken off the list and shows the not-added mark.
3. **Given** the screen has no confirm button, **When** the shopper presses the back arrow, **Then** the list shows what was added.
4. **Given** articles already on the list when the screen opened, **When** the catalog is shown, **Then** they are hidden; those added during the visit stay shown, marked as added.
5. **Given** the search field on top, **When** the shopper types text matching shown articles, **Then** only those are listed.
6. **Given** the search matches no article, **When** the result is shown, **Then** a "Créer « xyz »" row opens article creation with the name filled in, and on return the new article is on the list.
7. **Given** the search matches only an article hidden because it is already on the list, **When** the result is shown, **Then** the text "« Lait » est déjà dans la liste" is shown with no action.
8. **Given** a row, **When** it is shown, **Then** the added mark is a round toggle on the right (`add_circle` outline, then `check_circle` filled), with a tinted card and border once added, distinct from the square cart checkbox, and no cart icon starts the row.
9. **Given** a screen reader, **When** a row is focused, **Then** it reads "Ajouter Carotte", or "Carotte ajoutée, toucher pour retirer" once added.
10. **Given** the add screen, **When** it is shown, **Then** it offers no edit and no delete of an article.

---

### User Story 4 - Pick the current list in the Listes tab (Priority: P2)

The shopper wants to see which list is current, switch to another and create a new one.

**Why this priority**: Needed to switch lists, but a single list already works with stories 1 to 3.

**Independent Test**: With two lists, check the "en cours" chip on the current one, tap the other: the Courses tab opens on it.

**Acceptance Scenarios**:

1. **Given** the Listes tab, **When** it is shown, **Then** only the current list carries an "en cours" chip, and a screen reader announces that list as current.
2. **Given** another list, **When** the shopper taps it, **Then** it becomes the current list and the Courses tab is shown with it.
3. **Given** the rows, **When** they are shown, **Then** they have no ⋮ menu.
4. **Given** the extended FAB "Nouvelle liste", **When** tapped, **Then** the existing creation dialog opens, and the new list is created as before.
5. **Given** a long list of lists, **When** the shopper scrolls to the end, **Then** the last row is fully visible above the FAB.

---

### User Story 5 - Manage the catalog globally in the Articles tab (Priority: P2)

Editing or deleting an article changes it on every list, so it belongs on a dedicated tab, away from the quick add screen.

**Why this priority**: It must exist before the add screen drops its edit and delete, but shopping works without it.

**Independent Test**: Search "lait", rename it with "Modifier" (the dialog says how many lists are affected), then delete another article with "Supprimer" and undo.

**Acceptance Scenarios**:

1. **Given** the Articles tab, **When** it is shown, **Then** a search field is on top and the articles are grouped by category; categories with no article are hidden.
2. **Given** an article held by N lists (N > 0), **When** its row is shown, **Then** a badge shows N, and the badge is part of the row's accessible label; at 0 no badge is shown.
3. **Given** the extended FAB "Nouvel article", **When** tapped, **Then** article creation opens in the Articles stack.
4. **Given** a row, **When** the shopper opens its ⋮ menu, **Then** it offers "Modifier" and "Supprimer".
5. **Given** "Modifier", **When** chosen, **Then** a dialog with the name and the category opens and says how many lists are affected; saving applies the change to every list.
6. **Given** "Supprimer", **When** chosen, **Then** a confirmation says how many lists are affected; on confirmation the article leaves the catalog and every list, and the existing "Annuler" restores it.
7. **Given** the category picker (new article and edit), **When** opened, **Then** its last entry is "+ Nouvelle catégorie", which opens the existing category creation dialog; the created category is selected at once.
8. **Given** a long catalog, **When** the shopper scrolls to the end, **Then** the last row is fully visible above the FAB.
9. **Given** the catalog is empty, loading or in error, **When** the tab is shown, **Then** the shared state components are used (Principle IX).

---

### Edge Cases

- The shopper taps an article in the add screen and the app is offline: the change is local and synchronized later; nothing waits for the network.
- An article added during the visit is deleted from another device meanwhile: the next synchronization removes it from the screen like any remote change.
- The search matches both a shown and a hidden article: the shown one is listed, and the "déjà dans la liste" text is not shown.
- The search text has surrounding spaces or a different case: it matches as in feature 002.
- Article creation from the add screen fails or is cancelled: nothing is added.
- The last list is removed or no list exists: the Courses tab shows its empty state; the Listes tab offers "Nouvelle liste".
- A list is made current while the add screen is open in the Courses stack: the Courses stack returns to its root so the add screen never targets another list.
- An article is edited while it is hidden on the add screen: no effect on the add screen until it is reopened.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST show a bottom tab bar of four tabs, "Courses" (`shopping_cart`), "Listes", "Articles" (`grocery`) and "Réglages", each with its own native stack, and MUST open on Courses.
- **FR-002**: Each tab MUST keep its own history when the shopper switches tabs, and tapping the selected tab MUST return to its root screen.
- **FR-003**: The Courses stack MUST hold the current list, the add screen and article creation; the Listes stack the lists; the Articles stack the catalog and its article creation; the Réglages stack the settings, accounts, sign-in and password choice.
- **FR-004**: The "Mes listes" and "Réglages" icons MUST be removed from the current list header; "Terminer les courses" MUST stay there.
- **FR-005**: The shared snackbars MUST show above the tab bar, each screen MUST keep its error boundary, and the error reporter MUST still receive the route name of the visible screen.
- **FR-006**: Tab bar items MUST have accessible labels and a selected state.
- **FR-007**: The current list MUST show an extended FAB "Ajouter" that opens the add screen.
- **FR-008**: Each row of the current list MUST have a ⋮ menu with "Quantité…" (the existing quantity dialog: amount and unit) and "Retirer de la liste" (this list only, existing "Annuler" snackbar, no confirmation); it MUST NOT offer rename or category.
- **FR-009**: Items in the cart MUST show a square checkbox on the left and a struck-through name.
- **FR-010**: On the add screen, tapping an article MUST add it to the current list at once with no quantity; tapping an article added during the visit MUST take it off; there MUST be no confirm button and no quantity dialog.
- **FR-011**: The add screen MUST hide the articles that were on the list when it opened, and keep the ones added during the visit shown and marked.
- **FR-012**: The add screen MUST have a search field on top; with no match it MUST offer "Créer « xyz »" that opens article creation with the name filled in and adds the new article to the list on return; when the search matches a hidden article it MUST show "« name » est déjà dans la liste" with no action.
- **FR-013**: The add mark MUST be a round toggle on the right (`add_circle` outline, `check_circle` filled), with a tinted card and border once added, and no cart icon at the start of the row; its accessible label MUST be "Ajouter <name>" and, once added, "<name> ajoutée, toucher pour retirer".
- **FR-014**: The add screen MUST NOT offer editing or deleting an article.
- **FR-015**: The Listes tab MUST show an "en cours" chip on the current list only (announced to screen readers), MUST make a tapped list current and switch to the Courses tab, MUST have no ⋮ menu, and MUST keep the extended FAB "Nouvelle liste".
- **FR-016**: The Articles tab MUST have a search field, group articles by category with empty categories hidden, show on each row a badge counting the lists holding the article (none at 0, included in the accessible label), and an extended FAB "Nouvel article".
- **FR-017**: The Articles row menu MUST offer "Modifier" (dialog with name and category, applies to every list, says how many lists are affected) and "Supprimer" (global, confirmation saying how many lists are affected, existing undo).
- **FR-018**: The category picker of article creation and of "Modifier" MUST end with "+ Nouvelle catégorie", which opens the existing category creation dialog and selects the new category.
- **FR-019**: Every scrolling list under an extended FAB (current list, Listes, Articles) MUST have a bottom inset so the last row scrolls fully above the FAB.
- **FR-020**: Every screen and dialog added or changed MUST work offline and with the server unreachable, use the shared UI components and tokens, French text and the explicit screen states (Principles V, VII, IX, X), and have stories, tests and a Detox journey covering it.
- **FR-021**: The `design/mockups/` pages MUST show the four tab screens and the new dialogs (row menus, article edit, delete confirmation) and be linked from `design/mockups/index.html`.

### Key Entities

- **Tab**: one of Courses, Listes, Articles, Réglages; owns a stack of screens and its history.
- **Current list**: the shopping list shown by the Courses tab; chosen from the Listes tab.
- **List item**: an article on a list, with an optional quantity (amount and unit) and a cart tick; removed from one list only by "Retirer de la liste".
- **Article**: a catalog entry with a name and a category; editing or deleting it applies to every list.
- **Visit set**: the articles added during one visit of the add screen; they stay shown and marked until the screen closes.
- **List usage**: the number of lists holding an article, shown as the badge and in the edit and delete texts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A shopper adds three articles to the current list in three taps plus one back press, with no dialog.
- **SC-002**: Any of the four areas is reachable in one tap from any screen that shows the tab bar.
- **SC-003**: 100% of global article changes (edit, delete) are announced with the number of lists affected before they apply.
- **SC-004**: 100% of the screens and dialogs added or changed have a story, and every journey of the feature has a Detox test passing on Android.
- **SC-005**: On every list under a FAB, the last row can be scrolled fully above the FAB.

## Assumptions

- Features 001, 002 and 008 are in place; their use cases (`set-current-list`, `add-article-to-list`, `change-item-quantity`, `remove-item-from-list`, `restore-removed-item`, `edit-article`, `delete-article`, `restore-deleted-article`, `get-article-usage`, `get-categories`, `create-category`, `create-article-and-add-to-list`) are reused; new behavior in the application layer is limited to what tap-to-add needs.
- Renaming an article on one list only, and a menu on "Mes listes" (rename or delete a list), are out of scope.
- The iOS build is not delivered (see project memory); navigation is verified on Android and in stories.
- Screen text is French as given in this document; this specification is in English.
