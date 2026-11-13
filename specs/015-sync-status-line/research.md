# Research: Sync Status Line

## R1. Where the line is mounted

- **Decision**: inside `NavigationTabBar` (`navigation.tsx`), as a column `[SyncStatusLine, TabBar]`.
- **Rationale**: it is the `tabBar` of the bottom-tab navigator, so it sits right above the tab bar by construction, appears on every screen of every stack, and shares the tab bar's keyboard rule (`useAndroidKeyboardShown`: the whole column returns null). The navigator lays the tab bar out in flow, so the screens' area shrinks by the line's height.
- **Alternatives**: an absolutely positioned overlay at the root (needs a height/inset computation and covers content); a line per screen (forbidden by Principle IX).

## R2. Hiding on Réglages only

- **Decision**: `NavigationTabBar` receives `state`; the line is hidden when the focused tab is `SettingsTab` and its nested focused route is `Settings` (or unset, the stack's initial route), using `getFocusedRouteNameFromRoute`.
- **Rationale**: the other Réglages stack screens (Accounts, SignIn, ChoosePassword, Changelog) must show the line.
- **Alternatives**: hide on the whole Settings tab (contradicts the spec).

## R3. Offsets of the FAB, the snackbars and the list clearance

- **Finding**: `ScreenFab` is positioned inside its screen (`bottom: 24`), and the screen ends above the in-flow tab bar, so a taller `tabBar` moves the FAB, and shrinks the list's viewport, with no offset change. `UndoSnackbar` and `NoticeSnackbar` are rendered at the root, outside the navigator, and use `ABOVE_SCREEN_FAB` / `ABOVE_UNDO_OFFER` measured from the screen bottom (they include `TAB_BAR_HEIGHT`): only these must grow.
- **Decision**: expose the line's current height (36 or 0) through a small React context (`SyncLineOffset`) provided by `Navigation`; the two snackbars add it to their `wrapperStyle.bottom`. `ABOVE_SCREEN_FAB` and `ABOVE_UNDO_OFFER` stay the constants for "no line" (their tests keep their values); helper `withSyncLine(offset, height)` returns the shifted style. `SCREEN_FAB_CLEARANCE` is expected to stay unchanged because the viewport shrinks (issue #216 asks to grow it: this is checked by a layout test and the E2E journey; if the FAB or last row proves hidden on a device, the constant is made line-aware instead).
- **Single source of the height**: `Navigation` tracks the focused route name (already read in `recordScreen`) in state and the keyboard hook, and derives `lineHeight`; `NavigationTabBar` reads the same context, so the line and the offsets cannot disagree.
- **Alternatives**: put the snackbars inside the navigator layout (large restructuring); a store field (UI state that is not store state).

## R4. Content mapping

- **Decision**: a pure `syncLine(slice): { icon, text, tone: 'error' | 'neutral', action?: 'retry' | 'reconnect' } | null` in `SyncStatusLine.tsx`, tested table-style. It is separate from `SyncStatusBar`'s `display()` because the texts differ (short texts here) and the banner is unchanged (YAGNI: no shared abstraction).
- **Actions**: reuse the banner's navigation calls: tap on the line `navigate('SettingsTab', { screen: 'Settings', pop: true })`; reconnect `navigate('SettingsTab', { screen: 'SignIn', initial: false })`; retry `store.retry()`. The line sits outside any screen, so it uses the root `useNavigation` available inside the navigator's tab bar (props `navigation`).
- **Label of the reconnect text**: "Se reconnecter" for `revoked`, "Se connecter" for `accountDeleted`.

## R5. Visual contract

36 dp high, full width, `surfaceContainer`; top hairline 1 dp `surfaceContainerHigh`, bottom border 1 dp `outlineVariant` (tokens only; the 36 dp includes both). Icon 18 dp; text 13 sp bold `onSurfaceVariant`, `numberOfLines={1}`, `ellipsizeMode="tail"`; action text button in `primary`, 48 dp touch target (hit slop beyond the 36 dp line via `minHeight: 48` with negative margin or `hitSlop`, to keep the line at 36 dp). Icon color `error` for error tone, `onSurfaceVariant` for suspended. A `13 sp bold` entry is added to `typeOverrides` (like `syncStrip`), since no scale token matches. The mockup image in the issue comments is the visual reference (not readable offline: values come from the issue text).

## R6. Accessibility and announcements

The line is a `TouchableRipple` with `accessibilityRole="button"` and `accessibilityLabel` = the full text; the action is a separate button with its own label ("Réessayer", "Se reconnecter", "Se connecter"). No live region. `SyncAnnouncer` is untouched (it already announces once per transition from the root); a test asserts the line adds no `accessibilityLiveRegion` and the announcer still fires once with the line mounted. Note: the announcer's spoken texts for signed out / suspended differ from the line's short texts; kept as they are (out of scope).

## R7. Removing the banner from the data screens

Remove `<SyncStatusBar />` from the five screens; drop the `'bar'` variant, keeping `SettingsScreen`'s `variant="strip"` unchanged (the prop and its default may be simplified once no caller uses `bar`: the strip becomes the only rendering). Stories `Components/SyncStatusBar/*` and `Screens/CurrentList/WithSyncStatus` are re-targeted (the latter becomes a screen story with the line). Existing screen tests asserting the banner are changed to assert its absence, which is a change of expected behavior (Principle I allows it).

## R8. E2E

`sync-unreachable.e2e.ts` asserts the absence of "Synchronisé" / "Synchronisation…" / "En attente…" on a fresh install (still true) and the Réglages explanation; it is extended to check that a problem state shows the line on a non-Réglages screen only if the journey can reach one (US4-6 unreachable server leaves the status waiting, so no line: the journey asserts that no line is shown while waiting). A failed-state journey is not reachable on a device without a server: unit tests cover the states, the journey covers the absence and the layout.
