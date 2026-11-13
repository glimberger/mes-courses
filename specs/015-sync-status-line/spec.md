# Feature Specification: Sync Status Line

**Feature Branch**: `feat/issue-216-sync-banner-settings-only-status-line`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Show the sync banner on Réglages only and sync problems in a status line above the tab bar: the full sync status stays on the Réglages screen, unchanged; every other screen shows only the problem states (failed, signed out, account deleted, update required, suspended) in a compact status line pinned right above the tab bar, hidden on Réglages only, not dismissible, with the floating button and the snackbars placed above it." (issue #216). Applies the rule amended in constitution Principle IX (v2.8.0, #218) and updates [003-server-sync](../003-server-sync/spec.md) FR-020.

## Clarifications

### Session 2026-11-13

Questions were answered from the decisions recorded in issue #216 (no interactive session).

- Q: Where does the full sync status live? -> A: On the Réglages screen only, unchanged: every state, with its actions.
- Q: Which states are shown elsewhere? -> A: Only the problem states of the table in FR-004. Saved, waiting, sending and not connected show nothing outside Réglages (offline is a normal status, Principle IX).
- Q: Which screens show the line? -> A: All screens, including the other screens of the Réglages stack (accounts, sign-in, choose password, changelog). It is hidden on the Réglages screen itself, which already shows the full status.
- Q: Can the user dismiss the line? -> A: No. It stays while the state lasts and disappears by itself.
- Q: Is a suspension shown as an error? -> A: No. A suspension is not an error (Principle VII): its icon and text use the neutral color, the other problem states use the error color.
- Q: Which retained design? -> A: The "version retenue" mockup in the comments of issue #216; the earlier comparison board (variants B and C) was not retained.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A sync problem is visible on any screen (Priority: P1)

A user works on a shopping list, the catalog or any other screen. When synchronization needs their attention (it failed, the device was signed out, the account was deleted, the app must be updated, the account is suspended), a discreet line appears just above the tab bar, telling them in one line what is wrong. When all is well, nothing is shown.

**Why this priority**: It is the point of the feature: problems stay visible app-wide while the normal states stop taking space.

**Independent Test**: Put the sync in each problem state and check, on each screen, that the line shows the expected text and icon, and that it is absent for the normal states.

**Acceptance Scenarios**:

1. **Given** the sync has failed, **When** the user is on any screen but Réglages, **Then** the line reads "Échec de la synchronisation" with an error-colored icon and a "Réessayer" action.
2. **Given** the device was signed out because it was revoked, **When** the user is on any screen but Réglages, **Then** the line reads "Appareil déconnecté" with a "Se reconnecter" action.
3. **Given** the account was deleted, **When** the user is on any screen but Réglages, **Then** the line reads "Compte supprimé" with a "Se connecter" action.
4. **Given** an app update is required to sync, **When** the user is on any screen but Réglages, **Then** the line reads "Mise à jour requise pour synchroniser", with no action.
5. **Given** the account is suspended, **When** the user is on any screen but Réglages, **Then** the line reads "Compte suspendu · listes conservées" in the neutral color (not the error color), with no action.
6. **Given** the sync is saved, waiting, sending or not connected, **When** the user is on any screen, **Then** no line is shown.
7. **Given** the problem is resolved (for example a retry succeeds), **When** the state changes, **Then** the line disappears by itself, without any user action.

---

### User Story 2 - Réglages keeps the full status, other screens lose the banner (Priority: P1)

The user opens Réglages and still sees the complete sync banner with all states and actions. The other data screens (current list, lists, catalog, add articles, accounts) no longer show the banner under their top bar, and so gain vertical space.

**Why this priority**: It removes the clutter that motivated the change and keeps one place for the full status.

**Independent Test**: Open each data screen in each sync state: no banner is rendered. Open Réglages: the banner is as before.

**Acceptance Scenarios**:

1. **Given** the sync is in any state, **When** the user opens the current list, lists, catalog, add articles or accounts screen, **Then** no sync banner is shown under the top bar.
2. **Given** the sync is in any state, **When** the user opens Réglages, **Then** the full-width banner is shown as before, with its actions, and the status line is hidden.
3. **Given** a problem state, **When** the user opens accounts, sign-in, choose password or changelog from Réglages, **Then** the status line is shown above the tab bar.

---

### User Story 3 - The line acts on the problem (Priority: P2)

From the line, the user can retry, sign in again, or open Réglages to see more.

**Why this priority**: The line is useful beyond information, but the information alone already delivers the value.

**Independent Test**: Tap each action and the line itself in the matching state and check the destination.

**Acceptance Scenarios**:

1. **Given** the failed state, **When** the user taps "Réessayer", **Then** a synchronization retry starts.
2. **Given** a signed-out or account-deleted state, **When** the user taps "Se reconnecter" or "Se connecter", **Then** the sign-in screen opens as a screen reached from the app (not as the first launch flow).
3. **Given** any problem state, **When** the user taps the line outside its action, **Then** the Réglages screen opens.

---

### User Story 4 - The line never hides content or controls (Priority: P2)

The floating add button, the undo snackbar and the notice snackbar are placed above the line when it is shown, and in their usual place otherwise. A list can be scrolled so that its last row is fully visible above the line. The line is hidden while the Android keyboard is open, as the tab bar is.

**Why this priority**: Without it the line would cover content; it is a quality requirement of the line, not a separate value.

**Independent Test**: Show the line on a list screen: the button, snackbars and last row stay reachable. Remove the problem: they return to their usual place. Open the keyboard on Android: the line is hidden.

**Acceptance Scenarios**:

1. **Given** the line is shown, **When** a screen shows the floating button or a snackbar, **Then** they sit above the line and the line stays visible.
2. **Given** the line is not shown, **When** the same screen is displayed, **Then** the button and snackbars are exactly where they are today.
3. **Given** the line is shown and a long list, **When** the user scrolls to the end, **Then** the last row is fully visible above the line.
4. **Given** the line would be shown, **When** the Android keyboard opens, **Then** the line is hidden, and it reappears when the keyboard closes.

---

### User Story 5 - The line is accessible and distinct (Priority: P3)

A screen reader user hears the line as a button with its full label, and its action has its own label. Each state change is announced once, as today. In light and dark themes, a visible separator divides the line from the tab bar.

**Why this priority**: Required by the project's accessibility rules but a refinement of the line.

**Independent Test**: Check the accessibility labels and roles, the number of announcements per transition, and the separator in both themes.

**Acceptance Scenarios**:

1. **Given** the failed state, **When** a screen reader focuses the line, **Then** it announces a button labeled "Échec de la synchronisation", and its action is a separate control with its own label.
2. **Given** a transition to a problem state, **When** it occurs, **Then** the existing announcer announces it exactly once (the line adds no live region).
3. **Given** the light or the dark theme, **When** the line is shown, **Then** a visible separator divides it from the tab bar.

---

### Edge Cases

- State changes while the user is on Réglages: the line is hidden there, and appears at once if the user leaves for another screen while the problem lasts.
- Long text on a narrow screen: the text stays on one line and is ellipsized; the action stays reachable.
- The problem state changes from one problem to another (for example failed to signed out): the line updates its text, icon and action in place.
- The line, the floating button and a snackbar are shown together: the stacking order is line, then button or snackbar above it; none overlaps another.
- A screen with no tab bar below it: none exists today (see the assumptions); the line is tied to the tab bar's place.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The full-width sync banner MUST be shown on the Réglages screen only, unchanged: all states, with their actions.
- **FR-002**: The current list, lists, catalog, add articles and accounts screens MUST NOT show the sync banner.
- **FR-003**: The app MUST show one sync status line, pinned at the bottom right above the tab bar, on every screen except the Réglages screen. This includes the other screens of the Réglages stack.
- **FR-004**: The line MUST show exactly these states, with these texts, icons (18 dp) and actions:

  | Sync state | Text | Icon | Action |
  |---|---|---|---|
  | Connected and failed | Échec de la synchronisation | `cloud_alert`, error color | Réessayer: retry the sync |
  | Signed out, device revoked | Appareil déconnecté | `cloud_off`, error color | Se reconnecter: open sign-in |
  | Signed out, account deleted | Compte supprimé | `cloud_off`, error color | Se connecter: open sign-in |
  | Update required | Mise à jour requise pour synchroniser | `update`, error color | none |
  | Suspended | Compte suspendu · listes conservées | `pause_circle`, neutral color | none |

- **FR-005**: The line MUST be hidden for the saved, waiting, sending and not-connected states.
- **FR-006**: The line MUST NOT be dismissible: it stays while the state lasts and disappears by itself when it ends.
- **FR-007**: A suspension MUST use the neutral color, not the error color (Principle VII).
- **FR-008**: The line MUST be 36 dp high and full width, with the tab bar's background; its text MUST be 13 sp bold, on one line and ellipsized; its action MUST be a text action, right-aligned, with a 48 dp touch target.
- **FR-009**: A visible separator MUST divide the line from the tab bar, in the light and dark themes: a 1 dp bottom border and a 1 dp hairline on top, in the colors of the retained mockup.
- **FR-010**: Tapping the line outside its action MUST open the Réglages screen, as the current banner does. "Se reconnecter" and "Se connecter" MUST open the sign-in screen as a screen reached from the app (not the first launch flow). "Réessayer" MUST start a retry.
- **FR-011**: The line MUST be hidden while the Android keyboard is shown, like the tab bar.
- **FR-012**: When the line is shown, the floating button, the undo snackbar and the notice snackbar MUST sit above it, and the bottom clearance of the lists MUST grow by the line's height, so that the last row is never hidden. When the line is not shown, all of these MUST be in their current place.
- **FR-013**: The line MUST be a button with its full label (for example "Échec de la synchronisation"), and its action MUST have its own label. The existing sync announcer MUST keep announcing each transition once; the line MUST NOT add a live region.
- **FR-014**: The line MUST be one component from the shared UI module (Principle V), rendered once at the navigation level, never re-implemented per screen (Principle IX).
- **FR-015**: Spec 003 FR-020 MUST be updated to the rule of constitution Principle IX v2.8.0: the full status on the Réglages screen, and the problem states on every other screen through the shared component.
- **FR-016**: Unit tests, component stories, the accessibility test and the affected end-to-end journeys MUST be updated to the new behavior, with at least one automated test per state of the line.

### Key Entities *(include if feature involves data)*

- **Sync status line**: the compact line above the tab bar; derived from the current sync state, it has a text, an icon, a color tone (error or neutral) and an optional action, and has no state of its own.
- **Sync state**: the existing status of the synchronization (saved, waiting, sending, not connected, failed, signed out with a reason, update required, suspended); unchanged by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every one of the five problem states, the line is visible on 100% of the screens but Réglages, and in none of the four normal states.
- **SC-002**: On the five data screens, the vertical space taken by sync information is zero in the normal states, and one 36 dp line in a problem state (instead of the former banner).
- **SC-003**: A user in a problem state can reach the matching recovery (retry, sign-in or Réglages) in one tap from any screen.
- **SC-004**: With the line shown, 100% of the floating button, snackbar and last-row placements checked remain fully visible and tappable.
- **SC-005**: Each state transition is announced to screen reader users exactly once.

## Assumptions

- The sync states, their detection and the announcer already exist (spec 003) and do not change.
- Every screen of the app is displayed with the tab bar below it, so one line at the navigation level covers all screens.
- The mockup "version retenue" of issue #216 is the visual reference for colors and the separator; the sizes in FR-008 and FR-009 come from the issue.
- The constitution amendment (#218, v2.8.0) is merged; this feature does not change it.
- Texts are French and written in the user interface adapter, like the rest of the app.
- Out of scope: any change to the sync behavior, to the Réglages banner, or to which states exist.
