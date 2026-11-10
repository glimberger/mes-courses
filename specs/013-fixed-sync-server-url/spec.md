# Feature Specification: Fixed Sync Server URL

**Feature Branch**: `feat/issue-197-make-the-sync-server-url-fixed-and-remove-it-from-the-app-ui`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Make the sync server URL fixed: set at build time through `EXPO_PUBLIC_DEFAULT_SERVER_URL` (now required, no hard-coded URL), never shown or editable in the app. Remove the server address field from the sign-in screen, the address line and the \"Modifier l'adresse\" button from Settings, and the change-server-url use case. Keep the `serverId` guard. A device with a previously stored URL uses the fixed one. Update docs." (issue #197). Builds on [003-server-sync](../003-server-sync/spec.md) and [004-multi-user](../004-multi-user/spec.md), where the user typed and could change the server address (both now lifted).

## Clarifications

### Session 2026-11-10

Questions were answered with the recommended option (no interactive session).

- Q: What does the app do at start-up when `EXPO_PUBLIC_DEFAULT_SERVER_URL` is missing or invalid? -> A: It stops with a clear, explicit configuration error naming the variable, instead of starting with a broken sync. The CI workflow fails earlier with the same message, so a delivered APK never lacks it.
- Q: Does the app keep reading or writing `sync_state.serverUrl` on a device already signed in? -> A: The stored value is never read to connect; the fixed URL always wins. Existing stored values are left in place and ignored (no migration, no data loss, no sign-out).
- Q: What does a `serverId` mismatch mean now that the URL is fixed? -> A: Unchanged: if the fixed server answers with a `serverId` different from the stored one, the existing "server mismatch" outcome is reported and sync does not proceed.
- Q: Is sign-in still possible offline or against an unreachable server? -> A: Behavior is unchanged from 004: sign-in needs the server; the existing unreachable-server message is shown.
- Q: Are insecure URLs treated differently? -> A: No change: release builds refuse `http://`; dev builds accept it only when `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1`. The check applies to the fixed URL at start-up.
- Q: Is there a replacement for changing the address when the server moves? -> A: No in-app way. A new build with a new `EXPO_PUBLIC_DEFAULT_SERVER_URL` is the only way (the point of the feature).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with e-mail and password only (Priority: P1)

The shopper opens the app and signs in. They are asked only for e-mail and password; the sync server is not mentioned.

**Why this priority**: It removes the friction that motivates the feature.

**Independent Test**: Render the sign-in screen with a build-time URL configured: no server address field; submitting valid credentials signs in against the build-time URL.

**Acceptance Scenarios**:

1. **Given** the sign-in screen, **When** it is shown, **Then** it has an e-mail field and a password field and no "Adresse du serveur" field.
2. **Given** valid credentials, **When** the shopper submits, **Then** sign-in is attempted against the build-time URL and succeeds as before.
3. **Given** the server is unreachable, **When** the shopper submits, **Then** the existing unreachable-server message is shown.

---

### User Story 2 - Settings no longer exposes the server address (Priority: P1)

The shopper opens Settings: no server address is shown and no way to change it is offered.

**Why this priority**: Required for the address to be truly fixed.

**Independent Test**: Render Settings: no address line, no "Modifier l'adresse" button, no dialog.

**Acceptance Scenarios**:

1. **Given** the Settings screen, **When** it is shown, **Then** it shows no server address and no "Modifier l'adresse" button.

---

### User Story 3 - Existing devices keep working (Priority: P1)

A device already signed in, with an address stored from an earlier version, keeps syncing without any action.

**Why this priority**: Prevents breaking installed devices.

**Independent Test**: With a stored `serverUrl` different from the build-time one, connect: the request goes to the build-time URL; a different `serverId` yields the server-mismatch outcome.

**Acceptance Scenarios**:

1. **Given** a stored `sync_state.serverUrl`, **When** the app connects, **Then** it uses the build-time URL and ignores the stored one.
2. **Given** the server's `health` returns a `serverId` different from the stored one, **When** the app connects, **Then** the server mismatch is reported as before.

---

### User Story 4 - A build without the URL fails clearly (Priority: P2)

A maintainer who forgets the variable learns it immediately.

**Why this priority**: Protects against shipping an unusable app; secondary to user-facing behavior.

**Independent Test**: Run the start-up check without the variable (error naming it); run the CI workflow without `server-url` (fails with a clear message).

**Acceptance Scenarios**:

1. **Given** `EXPO_PUBLIC_DEFAULT_SERVER_URL` is missing or empty, **When** the app starts, **Then** it stops with a clear configuration error naming the variable.
2. **Given** the `server-url` input of `.github/workflows/android-apk.yml` is empty, **When** the workflow runs, **Then** it fails with a clear message before building.
3. **Given** a release build, **When** the URL is `http://`, **Then** it is refused; **Given** a dev build, **Then** `http://` is accepted only with `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1`.

---

### Edge Cases

- Variable set to blank spaces or a malformed URL: treated as invalid, same error as missing.
- Stored `serverUrl` present but the fixed server has a different `serverId`: mismatch reported, no silent re-pairing.
- A device never signed in: nothing stored; the fixed URL is used directly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The sync server URL MUST come only from the build variable `EXPO_PUBLIC_DEFAULT_SERVER_URL`; no URL is hard-coded.
- **FR-002**: The sign-in screen MUST ask only for e-mail and password, with no server address field.
- **FR-003**: The Settings screen MUST NOT show the server address nor offer any way to change it.
- **FR-004**: `ChangeServerUrlDialog`, the `change-server-url` use case, its store action (`device-actions.ts`), their tests and stories (including `required-stories.ts` entries and `tests/sync/src/change-server-url.test.ts`) MUST be removed, with lint, type-check, dependency-cruiser and the story-coverage test passing.
- **FR-005**: The app MUST stop at start-up with a clear error naming the variable when it is missing, blank or invalid; the CI workflow MUST fail with a clear message when `server-url` is empty.
- **FR-006**: The stored `sync_state.serverUrl` MUST NOT be read for connecting; the fixed URL always wins.
- **FR-007**: The `serverId` guard MUST remain: a `serverId` differing from the stored one is reported as a server mismatch at connection time.
- **FR-008**: Release builds MUST refuse `http://` URLs; dev builds MUST accept them only with `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1`.
- **FR-009**: `docs/sync-server.md` and the README MUST describe a user flow without address typing and the variable as required.

### Key Entities

- **Fixed server URL**: build-time configuration value, immutable at runtime, not user-visible.
- **Stored sync state**: still holds the server identity (`serverId`); its legacy `serverUrl` is ignored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sign-in requires 2 inputs (e-mail, password) instead of 3.
- **SC-002**: No screen of the app displays or edits the server address.
- **SC-003**: 100% of devices signed in before the change keep syncing after updating, with no user action.
- **SC-004**: A build or app start without the variable fails with a message naming it, in 100% of cases.
- **SC-005**: Updated tests (sign-in, settings, composition, sync) and the quality gates are green.

## Assumptions

- There is a single production server; changing it means shipping a new build.
- The legacy `serverUrl` column stays in the local database (no migration needed).
- Behavior of authentication and sync other than address selection is unchanged.
