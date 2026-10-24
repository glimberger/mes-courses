# Research: Bottom Tab Navigation and Tap-to-Add Flow

## Tab navigator

- **Decision**: `@react-navigation/bottom-tabs`, with a Material 3 tab bar built from the app theme (react-native-paper's `BottomNavigation.Bar` as the `tabBar` renderer), each tab holding a `createNativeStackNavigator`.
- **Rationale**: the app already uses React Navigation's native stack and react-native-paper; the bottom-tabs package is the matching official navigator and keeps per-tab history for free. It is the only new dependency (Principle IV justification).
- **Alternatives**: a hand-made tab bar over the single stack (loses per-tab history, more code); `react-native-paper` `BottomNavigation` as the navigator (own state, bypasses React Navigation linking and screen tracking).

## Tap-to-add state

- **Decision**: the visit set (ids added during the visit) lives in the add screen's state, not in the store. The screen computes its rows from the catalog, the current list items at mount time (frozen snapshot of ids already on the list) and the visit set.
- **Rationale**: the list is the source of truth (each tap calls `add-article-to-list` / `remove-item-from-list` at once); the visit set only decides which rows stay visible, so nothing extra is persisted or synchronized.
- **Un-tap**: tapping a marked row removes the item with the existing removal use case; no undo snackbar there (the toggle itself is the undo).

## Add without quantity

- **Decision**: `add-article-to-list` keeps its optional quantity and is called without one; `AlreadyOnList` cannot occur for visible rows (hidden when already on the list), and the screen treats it as "already added" if a race occurs.
- **Rationale**: no change of the use case contract is needed.

## Edit article as a dialog

- **Decision**: "Modifier" becomes a dialog (`EditArticleDialog`) built on the shared dialog components and `CategoryPicker`; the `EditArticle` route and screen are removed. Name and category changes use `edit-article`; the affected-lists count comes from `get-article-usage`.
- **Rationale**: matches the agreed decision (a dialog with name and category) and avoids a full screen for two fields.

## Pushed screens and the tab bar

- **Decision**: the tab bar stays visible inside every stack (default behaviour of nested stacks in tabs), except that the keyboard hides it on Android while typing.
- **Rationale**: the user can always switch tab; see Clarifications.

## Current list change while the add screen is open

- **Decision**: `Lists` calls `set-current-list`, then navigates to the Courses tab with its stack reset to `CurrentList`.
- **Rationale**: the add screen must never target another list than the one it opened with.
