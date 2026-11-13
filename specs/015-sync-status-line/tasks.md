# Tasks: Sync Status Line

**Input**: design documents in `specs/015-sync-status-line/` (plan.md, spec.md, research.md, data-model.md, contracts/ui-sync-status-line.md, quickstart.md)

**TDD (Principle I)**: inside each task, write the failing test first and see it fail, then implement. A task is one commit-sized unit that leaves the fast suite green. Paths are under `apps/mobile/src/adapters/ui/` unless they start with `tests/`, `specs/`, `design/` or `docs/`.

## Format: `- [ ] T### [P?] [Story] Description with file path`

## Phase 1: Foundational (blocking prerequisites)

- [x] T001 [P] Add a `syncLine` entry (13 sp, bold, same family as `syncStrip`) to `theme/typography.ts` `typeOverrides`, with its assertion in the existing typography test.
- [x] T002 [P] Create `components/SyncLineOffset.tsx`: a React context holding the line's current height (default 0), `SyncLineOffsetProvider`, `useSyncLineHeight()` and `SYNC_LINE_HEIGHT = 36`; test first in `components/sync-line-offset.test.tsx` (default 0, the provider's value is read).

## Phase 2: User Story 1 - A sync problem is visible on any screen (P1)

**Goal**: the line shows the five problem states, nothing otherwise. **Independent test**: render `SyncStatusLine` in each state of the `sync` slice (data-model.md mapping).

- [x] T003 [US1] Create `components/SyncStatusLine.tsx` with the pure `syncLine(slice)` mapping of data-model.md and the component (contract `contracts/ui-sync-status-line.md`: texts, 18 dp icons, error tone vs neutral tone for `suspended`, 36 dp, 13 sp bold one line ellipsized, `testID="sync-status-line"`), test first in `components/sync-status-line.test.tsx`: one test per problem state (text, icon, tone), nothing for `saved`, `waiting`, `sending` and `notConnected`, and the line disappears when the state recovers (scenarios US1-1 to US1-7). Depends on T001, T002.
- [x] T004 [US1] Mount the line in `navigation.tsx`: `NavigationTabBar` renders a column `[SyncStatusLine, TabBar]`; `Navigation` provides `SyncLineOffsetProvider` with 36 when the line is shown, else 0 (research R1, R3); tests first in `navigation.test.tsx`: the line is above the tab bar in a problem state, absent otherwise, on every tab. Depends on T002, T003.

**Checkpoint**: problem states visible app-wide (the old banner is still on the screens until Phase 3).

## Phase 3: User Story 2 - Réglages keeps the full status, other screens lose the banner (P1)

**Goal**: banner on Réglages only; line hidden on the Réglages root only. **Independent test**: open each screen in each sync state.

- [ ] T005 [US2] Hide the line on the Réglages root in `navigation.tsx` (focused tab `SettingsTab` and nested route `Settings` or unset, via `getFocusedRouteNameFromRoute`, research R2) and drive the provider's height from the same condition (route name tracked in state from `onStateChange`); tests first in `navigation.test.tsx`: hidden on Settings in every problem state, shown on Accounts, SignIn, ChoosePassword and Changelog, shown again when leaving Settings (US2-2, US2-3, edge case). Depends on T004.
- [ ] T006 [P] [US2] Remove `<SyncStatusBar />` and its import from `screens/CurrentListScreen.tsx`, `ListsScreen.tsx`, `CatalogScreen.tsx`, `AddArticlesScreen.tsx` and `AccountsScreen.tsx`; tests first in `screens/current-list-screen.test.tsx`, `lists-screen.test.tsx`, `catalog-screen.test.tsx`, `add-articles-screen.test.tsx` and `accounts-screen.test.tsx`: no `sync-status-bar` in any sync state (replacing the assertions of the banner, a change of expected behavior) (US2-1).
- [ ] T007 [US2] Reduce `components/SyncStatusBar.tsx` to the Réglages strip (drop the unused `'bar'` variant and its styles, keep texts, actions and look unchanged); update `components/sync-status-bar.test.tsx` and `screens/settings-screen.test.tsx` (strip unchanged, all states, with actions) and check `components/sync-announcer.test.tsx` still passes. Depends on T006.

## Phase 4: User Story 3 - The line acts on the problem (P2)

- [ ] T008 [US3] In `components/SyncStatusLine.tsx` wire the actions (research R4): "Réessayer" calls `retry()`, "Se reconnecter" / "Se connecter" call `navigate('SettingsTab', { screen: 'SignIn', initial: false })`, a tap on the line outside the action calls `navigate('SettingsTab', { screen: 'Settings', pop: true })`; the action has a 48 dp touch target while the line stays 36 dp; tests first in `components/sync-status-line.test.tsx` (US3-1 to US3-3), plus an integration case in `navigation.test.tsx` that reaching SignIn from the line keeps the Settings root under it. Depends on T003.

## Phase 5: User Story 4 - The line never hides content or controls (P2)

- [ ] T009 [US4] Hide the line (the whole column) with the tab bar while the Android keyboard is shown and bring it back after: test first in `navigation.test.tsx` next to the existing keyboard tests; the provided height is 0 while hidden (US4-4). Depends on T005.
- [ ] T010 [US4] Make `components/UndoSnackbar.tsx` add `useSyncLineHeight()` to its bottom offset (keep `ABOVE_SCREEN_FAB` and `ABOVE_UNDO_OFFER` as the no-line constants, add a small `withSyncLine` helper next to them in `components/ScreenFab.tsx`); tests first in `components/undo-snackbar.test.tsx`: unchanged place without the line, 36 dp higher with it (US4-1, US4-2). Depends on T002.
- [ ] T011 [US4] Same for `components/NoticeSnackbar.tsx`, in both its places (`ABOVE_SCREEN_FAB` and `ABOVE_UNDO_OFFER`); tests first in `components/notice-snackbar.test.tsx` (the existing `172 + 60 + 8` assertion stays for no line). Depends on T010.
- [ ] T012 [US4] Check the in-flow case of research R3 (floating button and last row of a list above the line): add a `navigation.test.tsx` case that the line and the tab bar share the tab bar slot so the screen area shrinks; if the device check of T018 shows the button or the last row hidden, make `SCREEN_FAB_CLEARANCE` and the FAB offset line-aware in `components/ScreenFab.tsx` with their tests instead. Depends on T004.

## Phase 6: User Story 5 - The line is accessible and distinct (P3)

- [ ] T013 [US5] In `components/SyncStatusLine.tsx` and `components/sync-status-line.test.tsx`: the line is a button labeled with its full text ("Échec de la synchronisation"), the action has its own label, no `accessibilityLiveRegion` anywhere, the separator uses `surfaceContainerHigh` (1 dp top) and `outlineVariant` (1 dp bottom) from the theme in light and dark; and in `components/sync-announcer.test.tsx` the announcer still announces each transition once with the line mounted (US5-1 to US5-3). Depends on T003.
- [ ] T014 [US5] Extend `screens/accessibility.test.tsx` with the app in a problem state (for example failed): the line is a labeled button with its action, and no accessibility violation is reported on a screen showing it. Depends on T008, T013.

## Phase 7: Polish and cross-cutting

- [ ] T015 Add `components/SyncStatusLine.stories.tsx` (`Failed`, `SignedOutRevoked`, `SignedOutAccountDeleted`, `UpdateRequired`, `Suspended`, `FailedDark`) built through the store's actions like `SyncStatusBar.stories.tsx`, re-target `Screens/CurrentList/WithSyncStatus` to a screen story showing the line above the tab bar (`Screens/CurrentList/WithSyncLine`), keep only the `SyncStatusBar` stories that still apply to the strip, and update `required-stories.ts` accordingly; `stories.test.tsx` must pass. Depends on T003, T007.
- [ ] T016 [P] Update the E2E journey `tests/e2e/journeys/sync-unreachable.e2e.ts`: while the unreachable server leaves the status "waiting", no line and no banner appear on Courses, Listes and Articles, and the banner is on Réglages; adjust any other journey that reads the banner (search `Synchronisé`, `En attente de synchronisation`, `sync-status-bar` under `tests/e2e`). Device suite runs in CI, one suite at a time locally.
- [ ] T017 [P] Update the specs and docs: `specs/003-server-sync/spec.md` FR-020 to the rule of constitution Principle IX v2.8.0 (the full status on the Réglages screen, the problem states on every other screen through the shared component), with a note in `specs/003-server-sync/contracts/ui-screens.md` (SyncStatusBar section) pointing to `specs/015-sync-status-line/spec.md`; add `SyncStatusLine` to `design/figma/FIGMA_COMPONENTS.md` and `FIGMA_SCREENS.md`, and to `docs/design.md` if it lists the shared components.
- [ ] T018 Run the quickstart: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:architecture`; on an Android emulator or device check the line above the tab bar, the floating button and snackbars above it, the last list row reachable, and no line on Réglages (decides T012's fallback). Depends on all.

## Dependencies and order

- Phase 1 (T001, T002 in parallel) before everything.
- US1 (T003, T004) is the MVP; US2 (T005 to T007) follows (T006 is independent of T005); US3 (T008) after T003; US4 (T009 to T012) after T004/T005; US5 (T013, T014) after T008.
- T015 after T003 and T007; T016 and T017 are independent of code; T018 last.

## Parallel examples

- T001 and T002; T006 with T005; T010 with T009; T016 with T017.

## Implementation strategy

MVP is Phase 1 + US1 (the line mounted and correct), then US2 removes the old banner; US1 and US2 land in the same PR so the banner and the line never show together on a released build. Everything ships in one PR for issue #216.
