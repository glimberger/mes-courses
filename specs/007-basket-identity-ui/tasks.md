---
description: "Task list for feature 007-basket-identity-ui"
---

# Tasks: Basket-Identity UI Refresh

**Input**: Design documents from `specs/007-basket-identity-ui/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-identity.md`,
`quickstart.md`, and the current green fast suite on the feature branch `feat/007-basket-identity-ui`.

**Tests**: Tests are required by the constitution (Principles I, II, III) and by the feature's success
criteria (SC-005, SC-006, SC-009). There is no test-only task: every task below carries its own
test and its implementation. Inside a task, write the failing test first, observe the expected failure,
implement the minimum code, then refactor with the whole suite green. Every commit leaves the fast
suite, the Storybook required-story test, the architecture test and the TypeScript checks green.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated
independently. The refresh is presentational only (FR-020): no domain, application, navigation,
storage or synchronization code changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story this task belongs to (`US1` … `US11`)
- Every task names the exact file(s) it touches
- Screens keep layout-only styling (spacing tokens); every visual choice lives in a shared
  component or a theme/token module

## Path conventions

- Design assets and tokens: `design/material-theme.json`, `apps/mobile/assets/`, `apps/mobile/assets/fonts/`
- Theme/token modules: `apps/mobile/src/adapters/ui/theme/{theme,theme-provider,spacing,shape,used-color-pairs}.ts`
- Shared UI components: `apps/mobile/src/adapters/ui/components/`
- Screens and dialogs: `apps/mobile/src/adapters/ui/screens/`
- Stories and tests: `*.stories.tsx`, `*.test.tsx`, next to the code they cover
- Root application shell: `apps/mobile/App.tsx`, `apps/mobile/app.config.ts`

## Rules that apply to every task

- **Single color source**: `design/material-theme.json` stays the only color source; no color
  literal is introduced anywhere else, and `react-native/no-color-literals` stays green (Principle V).
  Every new foreground/background draw is added to `usedColorPairs` and passes the WCAG test in
  `theme.test.ts` in light and dark.
- **Single design system**: screens are composed only of Material 3 and shared components; a screen
  never defines a one-off visual component or uses style keys beyond the layout set enforced by ESLint.
- **Branded identity**: primary action surfaces resolve to `primaryContainer` (`#FFDE3F`) with
  `onPrimaryContainer` (`#3A3000`) text; the brand yellow never dims between appearances; contrast
  is preserved by text color only.
- **Tokens, not literals**: radii come from the new `shape` module; spacing from `spacing`;
  typography from the bundled Nunito theme.
- **French and accessibility unchanged**: user-facing copy, accessible labels, roles and testID
  values do not change; interactive targets stay at least 48 dp; text wraps at 200% text size.
- **No second UI system**: `shape.ts` joins `spacing.ts` as the shared radius home; no radius or
  shadow literal lands in a screen.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the design tokens and assets every story consumes. No user story work
depends on anything beyond this phase plus Phase 2.

- [x] T001 Confirm the working branch is `feat/007-basket-identity-ui` created from
  `origin/<default>`, and that `git log origin/<default>..HEAD` and
  `git diff --stat origin/<default>...HEAD` list only this feature's work. Run the quality gates
  once before any change (`yarn workspace @mes-courses/mobile typecheck`, `yarn lint`,
  `yarn format:check`, `yarn workspace @mes-courses/mobile test`, `yarn test:architecture`) and
  record a green baseline. No file change.
- [x] T002 Update `design/material-theme.json` so both light and dark schemes carry the vibrant
  logo yellow `#FFDE3F` as `primaryContainer` and `#3A3000` as `onPrimaryContainer` (research R1).
  Leave `primary` (olive) and every other role unchanged. Update the color roles table's “Changed”
  column mentally only; `data-model.md` already documents the target values. *(No test; the theme
  test in Phase 2 pins the derived and contrast behavior.)*
- [x] T003 [P] Add the four bundled Nunito TTF files under
  `apps/mobile/assets/fonts/`: `Nunito_400Regular.ttf`, `Nunito_600SemiBold.ttf`,
  `Nunito_700Bold.ttf` and `Nunito_800ExtraBold.ttf` (decision R2). No new dependency; `expo-font`
  is already present in `apps/mobile/package.json`. Confirm `yarn install` is not needed (no
  `package.json` change) and that the TTF names match the registered family names used by the
  theme (R2/R4).
- [x] T004 [P] Create `apps/mobile/src/adapters/ui/theme/shape.ts` exporting the Material 3
  shape scale `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 28`, `pill: 9999`, with
  `as const` and the same JSDoc style as `spacing.ts` (decision R3). Paper's `roundness` stays
  `4`, so dialogs keep `7 × 4 = 28` dp automatically.
- [x] T005 Add a `shape` test (depends on T004) to `apps/mobile/src/adapters/ui/theme/theme.test.ts` (or a new
  `shape.test.ts` beside it) asserting the six tokens and their 4-dp divisibility where applicable,
  mirroring the existing `spacing tokens` block. Run it and confirm it passes once T004 lands; a
  failing test is the entry point for T004.
- [x] T006 [P] Configure Paper's `fonts` map in `apps/mobile/src/adapters/ui/theme/theme.ts` from
  the four bundled Nunito weights: regular 400 for display/headline/titleLarge/body, semibold 600
  for titleMedium/titleSmall and medium labels, bold 700 for dialog headings, extra-bold 800 for
  appbar titles (decision R4). Family names are registered names, not CSS names.
- [x] T007 Wire font loading in `apps/mobile/App.tsx` (or its `ThemeProvider`) with `expo-font`,
  loading the four TTFs by registered name, without introducing a second readiness gate or changing
  the `starting → ready/failed/tooOld` lifecycle. The splash stays the startup presentation while
  fonts settle, so the font does not gate composition (research R2). Keep `App.test.tsx` green;
  no component test may render blank.
- [x] T008 [P] Extend `apps/mobile/src/adapters/ui/theme/used-color-pairs.ts` with every new draw
  introduced by the refresh (research R10): the checked marker (`onPrimaryContainer` on
  `primaryContainer`, already listed), brand-yellow circular settings/dialog icons
  (`primary` on `surfaceContainerHigh`, acting as the soft brand surface proxy; document this proxy in data-model.md), the sync status strip text, the green
  "Déjà dans la liste" chip (`onTertiaryContainer` on `tertiaryContainer`), dialog icon circles and
  the empty/error icon circle. Add chip text pairs for filled-tonal buttons on cream surfaces.
- [x] T009 [P] Update `apps/mobile/src/adapters/ui/theme/navigation-theme.ts` if it derives any
  font or color role by hand, so it consumes the same Nunito theme and brand color; if it already
  delegates to `lightTheme`/`darkTheme`, record “no change” in the commit body and add no code.

**Checkpoint**: design tokens and fonts are in place, the theme test passes in light and dark
(including contrast), and the fast suite is still green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Restyle the shared UI components every screen consumes, so no screen work can start
until the shared module carries the brand. These tasks are independent by file and may run in
parallel, except `CategoryHeader`/`SettingsRow` depend on `shape.ts` from T004.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T010 [P] Write failing style, light/dark and accessibility tests in
  `apps/mobile/src/adapters/ui/components/screen-state.test.tsx` (and in the `EmptyState`/
  `ErrorState`/`LoadingState` stories) for the soft brand-toned circular icon, hierarchical title
  and message, and recovery action, then restyle `EmptyState.tsx`, `ErrorState.tsx`,
  `LoadingState.tsx`, `StateMessage.tsx` and `StateLayout.tsx` with `surfaceContainerHigh` icon
  circles, Nunito typography and spacing tokens (decisions R5, R11). Keep state types and messages
  untouched (Principle IX).
- [x] T011 [P] Restyle `ListItemRow.tsx` into a rounded, elevated card: surface
  `surfaceContainerLowest`, `shape.lg` (16 dp) and elevation 1; generous vertical spacing between
  cards; keep strikethrough and muted `onSurfaceVariant` for checked; make the brand-yellow
  selection marker resolve through `primaryContainer` (contract colors). Update
  `list-item-row.test.tsx` and `ListItemRow.stories.tsx` (`NotInCart`, `InCart`,
  `WithQuantity`, `LongName`) so clip/wrap assertions pass.
- [x] T012 [P] Update `ArticleRow.tsx` so the already-on-list indicator is a green "Déjà dans la
  liste" chip driven by the tertiary family (`tertiaryContainer`/`onTertiaryContainer`) with
  `mode="flat"` (decision R6). Update `article-row.test.tsx` and `ArticleRow.stories.tsx`
  (`Default`, `AlreadyOnList`) for the chip color and absence of a duplicate add action.
- [x] T013 [P] Turn `SearchField.tsx` into a rounded stadium control on a neutral surface
  (`surfaceContainer`) with `shape.pill`, using Nunito and keeping the 48 dp clear button. Update
  `NameField.tsx` and `QuantityFields.tsx` for rounded `shape.lg` fields and a visually secondary
  tertiary action; their existing screen-level coverage (`add-articles-screen.test.tsx` and `AddArticlesScreen.stories.tsx`) must keep passing; add SearchField stories/tests only if the component needs direct coverage.
- [x] T014 [P] Create a new shared `CategoryHeader` component in
  `apps/mobile/src/adapters/ui/components/CategoryHeader.tsx` rendering the 4 dp
  (`shape.xs`) brand-yellow bar followed by the category name in `onSurfaceVariant` semibold, and
  expose it from the shared module (decision R7). Add a story and tests covering light/dark
  rendering and long category names.
- [x] T015 [P] Create a new shared `SettingsRow` component in
  `apps/mobile/src/adapters/ui/components/SettingsRow.tsx` with a 44 dp (minimum 48 dp after touch
  target) circular `primaryContainer`-soft leading icon, title and optional subtitle, grouped into
  a `Surface` card (`shape.lg`, elevation 1) (decision R8). Style the sync status strip with
  `surfaceContainer`, `shape.md` and a sync indicator. Add a story and tests.
- [x] T016 [P] Restyle `SyncStatusBar.tsx` to the distinct rounded strip contract and update
  `sync-status-bar.test.tsx` plus `SyncStatusBar.stories.tsx` (`Saved`, `Waiting`, `Sending`,
  `Failed`, `UpdateRequired`, signed-out states); keep all status text and 003 account states.
- [x] T017 [P] Restyle `ListSummaryRow.tsx` as a rounded, elevated card (`shape.lg`,
  elevation 1) and change the "Liste actuelle" badge to the brand yellow (`primaryContainer`/
  `onPrimaryContainer`) with a `check` icon, replacing the current `primary` text/icon (contract).
  Rely on `lists-screen.test.tsx` and `ListsScreen.stories.tsx` for row coverage; add component-level stories/tests for `ListSummaryRow` only if direct coverage is needed.
- [x] T018 [P] Restyle `ScreenFab.tsx` so its radius comes from `shape.lg` (instead of the
  ad hoc `spacing.md` value) and its elevation is 3; no logic change. Its existing behavior
  (primaryContainer background, onPrimaryContainer label) now resolves to the brand yellow from
  T002. Update its visual expectations in the FAB tests, if any.
- [x] T019 [P] Restyle `Button.tsx` content target and the 48 dp touch target so the wrapper keeps
  working with Paper's tonal mode after the refresh; add Nunito-aware typography through the
  theme only. No change to its props. Keep `button` behavior tests green.
- [x] T020 [P] Update `apps/mobile/src/adapters/ui/screens/FullScreen.tsx` and
  `apps/mobile/src/adapters/ui/components/StateLayout.tsx` for the warm cream/dark shell and safe
  area consistency; no new visual style keys beyond layout allowed by the lint rule.

**Checkpoint**: all shared components render the brand in light and dark in Storybook, the
required-story test covers the refreshed components, the theme WCAG test passes and the fast suite
is green.

---

## Phase 3: User Story 1 — Recognize the brand everywhere (Priority: P1) 🎯 MVP

**Goal**: Primary action controls, the FAB and selected indicators use the brand yellow with dark
text; titles use Nunito; surfaces stay on the warm cream family in light.

**Independent Test** (from `spec.md`): open the primary screens and confirm that sign-in, create,
save and finish actions, the FAB and selected indicators use `primaryContainer` with dark text,
that headings use Nunito, and that light surfaces stay on the cream family (no olive/muddy yellow).

### Implementation for User Story 1

- [x] T021 [US1] Convert the five `mode="contained"` primary action buttons to
  `mode="contained-tonal"` so they paint from `primaryContainer` (brand yellow) with dark text:
  `SignInScreen.tsx` (`Se connecter`), `CreateArticleScreen.tsx` (creation action),
  `EditArticleScreen.tsx` (save action), `ChoosePasswordScreen.tsx` (confirmation),
  `SettingsScreen.tsx` (`Se connecter`). Do not hard-code any color.
- [x] T022 [US1] Verify that appbar titles, dialog/screen headings, body and buttons resolve to
  the Nunito weights configured in T006; do not reconfigure `theme.ts`. Add a theme test asserting
  the `fontFamily` of each role.
- [x] T023 [P] [US1] Update the screen stories that exercise the converted buttons so their titles
  show the brand yellow button: `SignInScreen.stories.tsx`, `CreateArticleScreen.stories.tsx`,
  `EditArticleScreen.stories.tsx`, `ChoosePasswordScreen.stories.tsx` and
  `SettingsScreen.stories.tsx`. Keep all existing story ids and args.
- [x] T024 [US1] Update the button screen tests for the new mode where they assert a color or mode:
  `sign-in-screen.test.tsx`, `create-article-screen.test.tsx`, `edit-article-screen.test.tsx`,
  `choose-password` screen test if present, and `settings-screen.test.tsx`/`settings-account.test.tsx`.
  Accessible labels and testIDs remain unchanged (FR-015).
- [x] T025 [US1] Add Storybook entries and, where missing, verify the refreshed shared components
  (`Button`, `ScreenFab`, surfaces) render in light and dark without console warnings; extend
  `requiredStories` only if a new story id is added (none expected here).

**Checkpoint**: User Story 1 is independently testable on the 6 primary screens; brand yellow
actions and Nunito titles are visible in light and dark.

---

## Phase 4: User Story 2 — Scan a shopping list as rounded cards (Priority: P1)

**Goal**: Each article is a distinct rounded, elevated card with wrapping text; checked rows keep
strikethrough and muted treatment with a brand-yellow marker; category headings are bold, muted and
introduced by a 4 dp brand-yellow accent.

**Independent Test** (from `spec.md`): open a list with several articles across categories;
verify rounded elevated cards and spacing; long names wrap with a comfortable row height;
checked rows keep strikethrough and muted treatment with a filled brand-yellow marker; category
headings are bold and muted with a small brand-yellow accent; the FAB adds an article in yellow.

### Implementation for User Story 2

- [x] T026 [US2] Integrate `CategoryHeader` in `CurrentListScreen.tsx` (inside `renderSectionHeader`)
  instead of `List.Subheader`, keeping the `accessibilityRole="header"` behavior and passing the
  existing section title. Keep screen styling layout-only.
- [x] T027 [US2] Update `CurrentListScreen.tsx` card spacing and the list's bottom clearance so
  no row sits under the FAB; replace any ad hoc radius/spacing literals with `spacing` tokens and
  the now-shared card surfaces from `ListItemRow`.
- [x] T028 [P] [US2] Update `CurrentListScreen.stories.tsx` (`Loading`, `Error`, `Empty`,
  `Success`, `AllInCart`, `WithSyncStatus`) to exercise long article names, wrapped text, dark
  appearance and the `LongName` row, and add a story for the category header with a long category
  name.
- [x] T029 [US2] Update `current-list-screen.test.tsx` and `current-list-offline.test.tsx` for
  the rounded card, category accent, long-name wrapping and FAB clearance assertions; keep
  accessibility labels/tests IDs unchanged and the offline rendering expectations green.
- [x] T030 [P] [US2] Add a `Screens/CurrentList/LongNames` story id to `requiredStories.ts` only
  if a new story is added; otherwise leave the list unchanged. Record the decision in the commit.

**Checkpoint**: User Story 2 is independently reviewable through `CurrentListScreen.stories.tsx`
in light and dark at 100% and 200% text size.

---

## Phase 5: User Story 3 — Browse my lists with a brand badge (Priority: P2)

**Goal**: Each list is a rounded, elevated card and the current list is clearly badged with a
brand-yellow "Liste actuelle" badge.

**Independent Test** (from `spec.md`): open the lists screen with at least two lists, one current;
verify rounded cards and a brand-yellow "Liste actuelle" badge; verify the empty state offers
creating the first list.

### Implementation for User Story 3

- [ ] T031 [US3] Update `ListSummaryRow.tsx` and its wrapping in `ListsScreen.tsx` so the row is a
  rounded card with elevation 1 (from T017), and the current-list badge uses the brand yellow/
  dark text treatment (not the former `primary` link color).
- [ ] T032 [US3] Confirm `ListsScreen.tsx` keeps its empty state (friendly message + "Nouvelle
  liste" action via the FAB) and wraps inside `ScreenStateView`; no empty-state duplication.
- [ ] T033 [P] [US3] Update `ListsScreen.stories.tsx` (`Loading`, `Error`, `Success`) with a
  multi-list current/non-current case, a one-list case, and an empty-lists case; keep story ids.
- [ ] T034 [US3] Update `lists-screen.test.tsx` for the current-list badge color/label, card
  shape and the empty-list action; keep accessible labels and identifiers unchanged.

**Checkpoint**: User Story 3 passes its screen test and its stories render in light and dark.

---

## Phase 6: User Story 4 — Add articles with a green "already in list" indicator (Priority: P2)

**Goal**: Already-present candidates show a green "Déjà dans la liste" indicator instead of an add
action; others offer an add action; the search field is a rounded stadium on a neutral surface.

**Independent Test** (from `spec.md`): open Add articles with some candidates already in the list;
verify the green chip and absence of an add action; verify candidates not yet present offer an add
action; verify the stadium search field with the brand typeface.

### Implementation for User Story 4

- [ ] T035 [US4] Finalize `ArticleRow.tsx` so the on-list chip is green tertiary (from T012), is
  `accessibilityElementsHidden` and is part of the row's accessible label; candidates not on the
  list keep the existing add affordance.
- [ ] T036 [US4] Make `SearchField.tsx`'s default `style` a rounded stadium on `surfaceContainer`
  (shape.pill, Nunito) so screens do not pass styling; update `AddArticlesScreen.tsx` to drop any
  search-field style override and rely on the shared default.
- [ ] T037 [P] [US4] Update `AddArticlesScreen.stories.tsx` (`Loading`, `Error`, `NoQuery`,
  `SearchMatches`, `SearchNoMatch`) to include at least one already-on-list candidate in the
  matches story and a scrolled/wrapped case.
- [ ] T038 [US4] Update `add-articles-screen.test.tsx` for the green chip, missing add action,
  add action for new candidates and stadium search field rendering.

**Checkpoint**: User Story 4 tests pass and its stories render in light and dark.

---

## Phase 7: User Story 5 — Recognize the brand at sign-in (Priority: P2)

**Goal**: The sign-in screen displays the basket brand illustration and application name at the
top and uses a brand-yellow sign-in button with dark text.

**Independent Test** (from `spec.md`): open sign-in; verify the basket illustration and app name at
the top; verify the yellow button with dark text; verify account actions stay secondary.

### Implementation for User Story 5

- [ ] T039 [US5] Add the basket brand illustration and a "Mes Courses" title at the top of
  `SignInForm` in `SignInScreen.tsx`, using the existing basket artwork
  (`apps/mobile/assets/splash-screen.png` or a basket-on-cream image asset) and Nunito typography,
  with a fallback to the application name on a themed background if the image fails to render. Keep
  layout-only style keys in the screen.
- [ ] T040 [US5] Ensure the `Se connecter` button is tonal brand yellow with dark text (through
  T021) and that `Mot de passe oublié ?` / `Créer un compte`-style actions remain text mode with
  `primary` color and stay secondary. Keep the button's 48 dp target.
- [ ] T041 [P] [US5] Update `SignInScreen.stories.tsx` (`Default`, `InvalidCredentials`,
  `TemporaryPasswordExpired`, `AccountSuspended`, `TooManyAttempts`, `ServerUnreachable`,
  `UntrustedServer`) to show the refreshed header and button in light and dark.
- [ ] T042 [US5] Update `sign-in-screen.test.tsx` for the illustration presence/alt text, the app
  name and the brand-yellow button treatment, without changing accessibility labels or identifiers.

**Checkpoint**: User Story 5 tests pass in both appearances.

---

## Phase 8: User Story 6 — Browse settings in grouped brand cards (Priority: P3)

**Goal**: Account, devices and sync status are grouped into rounded cards with a tonal brand icon
and a distinct sync status strip.

**Independent Test** (from `spec.md`): open settings; verify grouped rounded cards, a sync status
row in a distinct rounded strip with a sync indicator, and leading brand-toned circular icons.

### Implementation for User Story 6

- [ ] T043 [US6] Refactor `SettingsView` in `SettingsScreen.tsx` to wrap the account, server,
  devices and actions sections into rounded `Surface` cards (`shape.lg`, elevation 1) using the
  shared `SettingsRow` component, while preserving every existing prop, label and testID.
- [ ] T044 [US6] Style the sync status strip as a distinct rounded strip (`surfaceContainer`,
  `shape.md`) hosting `SyncStatusBar` and a stable sync indicator; keep the failed-sync recovery
  action working as before.
- [ ] T045 [US6] Replace the leading `List.Item` icons with the circular brand-toned icon
  containers from `SettingsRow` (`primary` icon on a soft brand container) and preserve the
  account row text for screen readers.
- [ ] T046 [P] [US6] Update `SettingsScreen.stories.tsx` (`Connected`, `SignedIn`,
  `SignedInAdministrator`, `DevicesLoading/…`, `NotSignedIn`) for grouped cards, sync strip and
  dark appearance.
- [ ] T047 [US6] Update `settings-screen.test.tsx`, `settings-account.test.tsx` and
  `settings-devices-screen.test.tsx` and `settings-own-account.test.tsx` for the new grouping
  without changing the accessibility tree or test identifiers.

**Checkpoint**: User Story 6 tests pass and its stories render in both appearances.

---

## Phase 9: User Story 7 — Use rounded, brand-styled dialogs (Priority: P3)

**Goal**: Dialogs have 28 dp rounded corners, Nunito titles, brand-yellow confirmation for
non-destructive actions and error styling for destructive ones.

**Independent Test** (from `spec.md`): open each main dialog; verify 28 dp corners, brand
typeface titles, brand styling for non-destructive and error styling for destructive actions.

### Implementation for User Story 7

- [ ] T048 [US7] Restyle dialog titles, content and actions in all dialog screens:
  `QuantityDialog.tsx`, `FinishShoppingDialog.tsx`, `DeleteArticleDialog.tsx`,
  `CreateListDialog.tsx`, `CreateCategoryDialog.tsx`, `ChangePasswordDialog.tsx`,
  `DeleteMyAccountDialog.tsx`, `InviteAccountDialog.tsx`, `ForgotPasswordDialog.tsx`,
  `SignOutDialog.tsx` and `SignedOutNoticeDialog.tsx`. Keep Paper's roundness at 4 (28 dp corners),
  use Nunito titles and `spacing` margins.
- [ ] T048a [US7] Extend the dialog restyle to the account and device dialogs that also render `Dialog`: `AccountActionDialogs.tsx`, `DeleteAccountDialog.tsx`, `DeviceDialog.tsx`, `RenameDeviceDialog.tsx`, `ResendCredentialsDialog.tsx`, `RevokeDeviceDialog.tsx` and `SuspendAccountDialog.tsx`. Keep Paper's 28 dp corners, Nunito titles, and apply brand-yellow styling for non-destructive confirmations and the error family for destructive ones, preserving French copy and testIDs.

- [ ] T049 [US7] `QuantityDialog.tsx`: rounded `shape.lg` fields, and make the tertiary action
  visually secondary (outlined/text mode in `primary`).
- [ ] T050 [US7] `FinishShoppingDialog.tsx`: render the confirmation in a brand-toned circular
  icon (`primaryContainer` glyph on a soft `primaryContainer`-soft circle).
- [ ] T051 [US7] `DeleteArticleDialog.tsx`: render its icon and confirm button in the error family
  (never brand yellow), with the existing destructive copy and caution semantics.
- [ ] T052 [US7] `CreateListDialog.tsx` and `CreateCategoryDialog.tsx`: make the create action
  contained-tonal so it paints brand yellow with dark text.
- [ ] T053 [P] [US7] Update the dialog stories for the refreshed styling:
  `QuantityDialog.stories.tsx`, `FinishShoppingDialog.stories.tsx`, `CreateListDialog.stories.tsx`,
  `CreateCategoryDialog.stories.tsx`, `ChangePasswordDialog.stories.tsx`,
  `DeleteArticleDialog.stories.tsx`, `DeleteMyAccountDialog.stories.tsx`, `InviteAccountDialog.stories.tsx`,
  `ForgotPasswordDialog.stories.tsx`, `SignOutDialog.stories.tsx` and
  `SignedOutNoticeDialog.stories.tsx` (corners are Paper's, no explicit radius).
- [ ] T053a [P] [US7] Add/refresh stories for the dialogs newly covered by T048a: `AccountActionDialogs`, `DeleteAccountDialog`, `DeviceDialog`, `RenameDeviceDialog`, `ResendCredentialsDialog`, `RevokeDeviceDialog` and `SuspendAccountDialog`, in light and dark, keeping story IDs aligned with `required-stories.ts`.

- [ ] T054 [US7] Update the dialog tests (`quantity-dialog.test.tsx`, `finish-shopping-dialog.test.tsx`,
  `create-list-dialog.test.tsx`, `create-category-dialog.test.tsx`, `delete-article-dialog.test.tsx`,
  `change-password` test if present) to assert the new treatment; keep French copy and testIDs.

- [ ] T054a [US7] Add or update tests for the same dialogs, asserting corner/title treatment, brand vs destructive coloring, and unchanged French copy/testIDs.

**Checkpoint**: User Story 7 tests pass and the dialog stories render in light and dark.

---

## Phase 10: User Story 8 — Friendly empty and error states (Priority: P3)

**Goal**: Empty and error states present a soft brand icon, hierarchically styled title and
message, and an available recovery action; loading, empty, error and content each render through
their dedicated shared component.

**Independent Test** (from `spec.md`): trigger empty and error states; verify the soft brand
icon, hierarchical title and message and a recovery action; verify each state renders through its
dedicated shared component.

### Implementation for User Story 8

- [ ] T055 [US8] Finalize `EmptyState`, `ErrorState`, `LoadingState`, `ScreenStateView` and
  `StateMessage` interactions so every data screen keeps using its dedicated component
  (Principle IX), wrapping internal padding/layout in `spacing` tokens and the brand icon circle
  from T010.
- [ ] T056 [P] [US8] Add/update the state stories (`EmptyState.stories.tsx`,
  `ErrorState.stories.tsx`, `LoadingState.stories.tsx`) with light/dark and action/no-action cases,
  adding the refreshed visual treatment; keep story ids stable or update `requiredStories`
  accordingly.
- [ ] T057 [US8] Update `screen-state.test.tsx` and the emptied screens' tests for the soft icon,
  recovery action and the dedicated-component rule; do not change French copy.

**Checkpoint**: User Story 8 stories render in light/dark and its tests pass.

---

## Phase 11: User Story 9 — Keep the brand in dark appearance (Priority: P2)

**Goal**: Every core screen keeps the brand yellow and rounded surfaces in dark appearance, with
legible contrast.

**Independent Test** (from `spec.md`): switch the device to dark; verify brand yellow, rounded
surfaces and Nunito persist with legible text on all core screens.

### Implementation for User Story 9

- [ ] T058 [US9] Audit every shared component and screen for dark-only regressions: ensure no
  surface uses a hard-coded light color, default elevations stay readable and Nunito still applies
  under `MD3DarkTheme`. Fix any `useColorScheme`-dependent cast or fallback introduced in Phase 1.
- [ ] T059 [US9] Verify `UsedColorPairs` passes in dark for all pairs added in T008/T010-T017
  (`theme.test.ts`); add any missing pair and re-run until green. Do not weaken contrast thresholds
  (FR-017).
- [ ] T060 [P] [US9] Render the full Storybook gallery in dark via `required-stories` and fix
  warnings/errors caused by the dark theme (font, elevation, icon contrast).
- [ ] T061 [US9] Add a focused regression test (in `theme.test.ts` or a new
  `dark-appearance.test.tsx`) asserting `primaryContainer` is `#FFDE3F` in both themes and that
  surfaces use the dark family when `dark` is true; document dark screenshots in the PR.

**Checkpoint**: `stories.test.tsx` passes every registered story in the dark scheme without
console errors.

---

## Phase 12: User Story 10 — Remain accessible at any text size (Priority: P1)

**Goal**: All refreshed components keep accessible labels, minimum 48 dp touch targets and
readability at 200% text size.

**Independent Test** (from `spec.md`): enable 200% text size and a screen reader; verify no
clipping, 48 dp touch targets and unchanged labels/identifiers across the refreshed screens.

### Implementation for User Story 10

- [ ] T062 [US10] Audit all refreshed components (`ListItemRow`, `ArticleRow`, `ListSummaryRow`,
  `SearchField`, `NameField`, `QuantityFields`, `Button`, `ScreenFab`, `EmptyState`, `ErrorState`,
  `SettingsRow`, `CategoryHeader`) for `minHeight: 48` / 48 dp touch targets and for text that
  wraps rather than clips; update style tokens where a target falls below 48 dp.
- [ ] T063 [US10] Confirm every screen at 200% font scale either wraps or scrolls (no `numberOfLines`
  that clips a required label except where the existing contract allowed and the affected value is
  reviewed); add a test utility or story for the `LongName` case where needed.
- [ ] T064 [P] [US10] Add 200%-scale Storybook stories for `Components/ListItemRow/LongName`,
  `Components/ArticleRow/Default` and the `Screens/CurrentList/Success` screen, and assert no
  console warning/error under `stories.test.tsx`.
- [ ] T065 [US10] Update accessibility tests (`accessibility.test.tsx`, the screen tests and
  `screen-state.test.tsx`) to keep passing after the visual changes; ensure testID and accessible
  label values remain byte-identical.

**Checkpoint**: User Story 10 tests pass at 100% and the long-name stories render at 200%.

---

## Phase 13: User Story 11 — Launch with the brand identity (Priority: P3)

**Goal**: Home-screen icon and startup splash reflect the basket brand on cream on both production
and staging builds.

**Independent Test** (from `spec.md`): install a staging and a release build; verify both show the
basket-on-cream icon, remain distinguishable, and the splash keeps its automatic network-free
transition.

### Implementation for User Story 11

- [ ] T066 [US11] Replace the production and staging launcher assets with basket-on-cream
  artwork: `apps/mobile/assets/icon.png`, `apps/mobile/assets/staging/icon.png`,
  `apps/mobile/assets/android-icon-foreground.png`,
  `apps/mobile/assets/staging/android-icon-foreground.png`,
  `apps/mobile/assets/android-icon-monochrome.png` and
  `apps/mobile/assets/staging/android-icon-monochrome.png`, preserving file paths and `appVariant`.
  Keep `apps/mobile/assets/splash-screen.png` as the existing basket-on-cream splash from 006.
- [ ] T067 [US11] Update the staging badge so production and staging remain visually
  distinguishable while both keep the basket identity (per `build-config/app-variant.cjs`).
- [ ] T068 [US11] Do not change `apps/mobile/app.config.ts`, `build-config/app-variant.cjs` or the
  splash transition logic; verify them unchanged in review and only replace.asset files.
- [ ] T069 [US11] Update `StartupSplash.tsx`/its stories/tests (from feature 006) so the startup
  screen keeps the basket-on-cream visual in both light and dark, with the automatic offline
  transition unchanged. Keep `StartupSplash.test.tsx` green.

**Checkpoint**: User Story 11 assets are in place; `StartupSplash.test.tsx` and appearance tests pass.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete refresh, quality gates and review artifacts (SC-003, SC-005,
SC-006, SC-009).

- [ ] T070 [P] Run the fast suite against the changed components and screens:
  `yarn workspace @mes-courses/mobile test` (must be fully green) and fix only defects in the
  feature paths.
- [ ] T071 [P] Run `yarn workspace @mes-courses/mobile typecheck` and `yarn lint` against the
  changed files; confirm the screen layout rule, `no-color-literals` and `no-inline-styles` remain
  satisfied despite the new card styling.
- [ ] T072 [P] Run `yarn format:check` and `yarn test:architecture`; resolve only formatting or
  dependency-cruiser findings from this change.
- [ ] T073 Verify `usedColorPairs` against `theme.test.ts` in both light and dark; add any missing
  pair discovered by review; ensure no threshold is relaxed (FR-017, SC-003).
- [ ] T074 Verify `required-stories` in
  `apps/mobile/src/adapters/ui/required-stories.ts` still matches Storybook stories after the
  refresh; add updates only if a new required story id was introduced. Run `stories.test.tsx`.
- [ ] T075 Re-run the Storybook rendering test and the required-story test across all stories in
  light and dark; fix any console error/warning before merge (SC-009).
- [ ] T076 Re-run the theme and shape tests (`theme.test.ts` plus the shape test) and the
  contrast suite; keep the brand yellow (`#FFDE3F`) marked as unchanged between appearances.
- [ ] T077 Review `quickstart.md` paths/commands against the final implementation; update asset,
  story and test references where a path changed, keeping the manual visual/accessibility/native
  checks executable (SC-001..SC-009).
- [ ] T078 Produce the PR review artifacts: screenshots of every refreshed shared component and
  screen, in both appearances, through the project's Storybook flow; attach them to the PR body
  for SC-009. Run the `gl-pr-screenshots` flow if available.
- [ ] T079 Note the milestone in the daily journal at
  `~/WORKSPACE/VAULT/1_JOURNAL/...` (one French line in the `## 🗒️ Notes` section under the
  `#### mes-courses` heading) mentioning the basket-identity UI refresh, per `AGENTS.md`. Do not
  ask first; just mention it in the delivery reply.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: runs first; T002 (color) and T003/T004/T006 (assets/token/typography) can be
  parallel.
- **Phase 2 Foundational**: depends on Phase 1 and blocks every user story. T010 … T020 are
  parallel except T014/T015 depend on T004 (`shape.ts`).
- **Phase 3+ User Stories**: depend on Phases 1 and 2. The foundational color (`primaryContainer`)
  already resolves to the brand yellow, so story code (buttons) consumes it without new tokens.
- **Polish**: depends on the stories being merged; asset staging (Phase 13) can run while tests
  are finishing, but native screenshot review (T078) needs the builds.

### User Story Dependencies

- **US1** (P1): can start as soon as Phase 2 is done; no dependency on other stories.
- **US2** (P1): depends on `ListItemRow` (T011) and `CategoryHeader` (T014).
- **US3** (P2): depends on `ListSummaryRow` (T017).
- **US4** (P2): depends on `ArticleRow` (T012) and `SearchField` (T013).
- **US5** (P2): depends on the button conversion (T021) and font loading (T007).
- **US6** (P3): depends on `SettingsRow` (T015) and `SyncStatusBar` (T016).
- **US7** (P3): depends on Phase 2 visual tokens only.
- **US8** (P3): depends on T010 (empty/error components).
- **US9** (P2): depends on Phase 2 and T002, and runs after the component restyles.
- **US10** (P1): runs after the component restyles, validating their touch targets and wrapping.
- **US11** (P3): independent at the asset level; keep `app.config.ts` untouched.

### Within each story

- Write the failing test (or update it) before the code.
- Shared component changes before screen integration.
- Screen changes before stories/tests for that screen.
- Merge one story at a time when possible (MVP first).

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006, T007, T008, T009 second T002.
- Phase 2: all ten T010–T019, with T020 after the surface layout decisions.
- User stories: after Phase 2, US1, US7, US8 can run in parallel; US2/US3/US4 follow their
  shared component; US9/US10 come after the refresh exists (US9 in parallel with US11).

### Parallel Examples

#### Phase 2 shared components

```text
Developer A: T010 EmptyState/ErrorState/LoadingState
Developer B: T011 ListItemRow
Developer C: T012 ArticleRow
Developer D: T014 CategoryHeader
Developer E: T017 ListSummaryRow
```

#### Brand actions and dark mode

```text
Developer A: US1 (T021–T025)
Developer B: US7 (T048–T054)
Developer C: US11 (T066–T069)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1.
2. Complete Phase 2 (shared components).
3. Complete Phase 3 (US1): brand actions, Nunito titles, cream surfaces.
4. Stop and validate on the 6 primary screens in light and dark; run `stories.test.tsx`,
   `theme.test.ts` and the fast suite.
5. Demo/review before continuing.

### Incremental Delivery

1. Setup + Foundational: tokens, fonts, shapes, refreshed shared components.
2. Add US1: brand recognition everywhere (MVP).
3. Add US2: shopping list as cards.
4. Add US3/US4: lists and add-articles identities.
5. Add US5/US6: sign-in and settings.
6. Add US7/US8/US9/US10: polish, dark, accessibility.
7. Finish with US11 assets and the review/pr artifacts.

### Parallel Team Strategy

With multiple developers:

1. The team completes Phases 1 and 2 together.
2. Then split:
   - Developer A: US1 and US10
   - Developer B: US2 and US3
   - Developer C: US4 and US5
   - Developer D: US6 and US7
   - Developer E: US8, US9 and US11
3. Each story is independently testable before integration.

---

## Notes

- `[P]` marks tasks that can run in parallel without editing the same incomplete implementation.
- `[US1]` … `[US11]` map to the priorities in `specs/007-basket-identity-ui/spec.md`.
- No persisted entity, server, sync, navigation, accessible-label or identifier change is introduced.
- Every dialog radius comes from Paper's `roundness` (`7 × 4 = 28` dp); components use `shape.*`
  tokens otherwise; screens use only layout style keys.
- Inside each task, verify the test fails before implementing and keep every commit green.