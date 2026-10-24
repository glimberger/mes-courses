# Research: Bottom Tab Navigation and Tap-to-Add Flow

## Tab navigator

- **Decision**: `@react-navigation/bottom-tabs`, with a Material 3 tab bar built from the app theme (react-native-paper's `BottomNavigation.Bar` as the `tabBar` renderer), each tab holding a `createNativeStackNavigator`.
- **Rationale**: the app already uses React Navigation's native stack and react-native-paper; the bottom-tabs package is the matching official navigator and keeps per-tab history for free. It is the only new dependency (Principle IV justification).
- **Alternatives**: a hand-made tab bar over the single stack (loses per-tab history, more code); `react-native-paper` `BottomNavigation` as the navigator (own state, bypasses React Navigation linking and screen tracking).

## Tap-to-add state

- **Decision**: the visit set (ids added during the visit) lives in the add screen's state, not in the store. The screen computes its rows from the catalog, the current list items at mount time (frozen snapshot of ids already on the list) and the visit set.
- **Rationale**: the list is the source of truth (each tap calls `add-article-to-list` / `remove-item-from-list` at once); the visit set only decides which rows stay visible, so nothing extra is persisted or synchronized.
- **Un-tap**: checked against the code: the store's `removeItem` (`edit-list-actions.ts`) always sets a `removedItem` undo offer (the global "Annuler" snackbar), and the `remove-item-from-list` use case holds the removed item's changes until the offer ends, so calling the use case directly would leave them held with nothing to release them. Decision: a new store action `removeItemQuietly(articleId)` runs the same removal (`ItemNotOnList` still expected), then releases the held changes at once (`releaseOffer` with the returned `removed`) and never sets `pendingUndo`. The Courses row menu keeps `removeItem` with its undo snackbar. The toggle itself is the undo on the add screen.
- **Created through "Créer « xyz »"**: `CreateArticleScreen` puts the article on the list, so it is in neither the snapshot nor the visit set. It goes back to `AddArticles` with `createdArticleId`; the screen adds it to the visit set, so it is shown as added and can be un-tapped.

## Create an article in the catalog only

- **Decision**: `CreateArticleScreen` today only calls `createArticleAndAddToList` and offers "add the existing article to the list" on a duplicate name. A new use case `create-article` (name cleaned, unique name, category must exist, one transaction, same errors as `create-article-and-add-to-list`, no list item) and a store action `createArticle` serve the Articles tab. The route param `addToList` selects the mode: `true` (Courses) keeps today's behavior; `false` (Articles) hides the quantity fields, creates the article only, and on `NameAlreadyUsed` shows « <name> » existe déjà. with no add-to-list offer.
- **Rationale**: tidying the catalog must not change the shopping list.

## Usage counts for the Articles badges

- **Decision**: a new read use case `get-article-usage-counts` returns the number of lists holding each article in one unit of work (one query over the list items), used by `CatalogScreen` on each load and refresh. `get-article-usage` (one article, with the lists) stays for the edit and delete dialogs.
- **Rationale**: one `get-article-usage` per article would open one transaction per article (300 for a 300-article catalog) on each refresh and after each sync.

## Add without quantity

- **Decision**: `add-article-to-list` keeps its optional quantity and is called without one; `AlreadyOnList` cannot occur for visible rows (hidden when already on the list), and the screen treats it as "already added" if a race occurs.
- **Rationale**: no change of the use case contract is needed.

## Edit article as a dialog

- **Decision**: "Modifier" becomes a dialog (`EditArticleDialog`) built on the shared dialog components and `CategoryPicker`; the `EditArticle` route and screen are removed. Name and category changes use `edit-article`; the affected-lists count comes from `get-article-usage`; the dialog texts (singular and plural) are defined only in the contract.
- **Rationale**: matches the agreed decision (a dialog with name and category) and avoids a full screen for two fields.

## Pushed screens and the tab bar

- **Decision**: the tab bar stays visible inside every stack (default behaviour of nested stacks in tabs), except that the keyboard hides it on Android while typing.
- **Rationale**: the user can always switch tab; see Clarifications.

## Current list change while the add screen is open

- **Decision**: `Lists` calls `set-current-list`, then navigates to the Courses tab with its stack reset to `CurrentList`.
- **Rationale**: the add screen must never target another list than the one it opened with.
