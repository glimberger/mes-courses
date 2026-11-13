# Implementation Plan: Sync Status Line

**Branch**: `feat/issue-216-sync-banner-settings-only-status-line` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-sync-status-line/spec.md` (issue #216)

## Summary

The full sync banner (`SyncStatusBar`) stays on the Réglages screen only. Every other screen gets
the problem states (failed, signed out, account deleted, update required, suspended) through one
new shared component, `SyncStatusLine`, a 36 dp line rendered once at the navigation level, right
above the tab bar (inside the custom `NavigationTabBar`). The line is hidden on the Réglages root
screen and while the Android keyboard is shown. The app-wide snackbars (undo, notice), which are
positioned from the screen bottom, move up by the line's height when it is shown. Spec 003 FR-020
is aligned with constitution Principle IX v2.8.0. No domain, application, store or server change:
the line is derived from the existing `sync` slice.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js 24, React Native via Expo (existing)

**Primary Dependencies**: React Native Paper (Material 3), React Navigation (bottom tabs + native stacks), zustand store. No new dependency.

**Storage**: N/A (derived from the in-memory `sync` slice)

**Testing**: Jest + React Native Testing Library (fast suite), Storybook story tests (`required-stories.ts`), the accessibility test (`screens/accessibility.test.tsx`), Detox journeys (`tests/e2e/journeys`)

**Target Platform**: Android and iOS (Expo); the Android keyboard rule is Android only

**Project Type**: mobile-app (monorepo; only `apps/mobile` UI adapter changes)

**Performance Goals**: N/A (one derived selector, no extra render of the screens)

**Constraints**: offline-first unchanged (Principle VII); French text only, in the UI adapter (X); Material 3 tokens only, no hard-coded colors (V); one component, never per screen (IX); TDD, each test in the same task as its implementation (I)

**Scale/Scope**: 1 new component, 5 screens lose a line, navigation + 2 snackbars change, 1 spec edit, ~8 stories, 1 a11y case, 1 E2E journey update

## Constitution Check

*GATE: passes before Phase 0 and after Phase 1.*

| Principle | Status | How |
|---|---|---|
| I Test-first | Pass | Every task writes its failing test first, in the same task as the code. |
| II Executable spec | Pass | Each acceptance scenario of spec.md maps to a test (see quickstart.md table). |
| III Fast, deterministic | Pass | Component and navigation tests use the store test double; no timers. |
| IV Simplicity | Pass | No new dependency or abstraction beyond the one component and one offset context needed by the root snackbars. |
| V Single design system | Pass | Paper + theme tokens (`surfaceContainer`, `outlineVariant`, `surfaceContainerHigh`, `onSurfaceVariant`, `error`, `primary`); component in the shared module. |
| VI Hexagonal | Pass | UI adapter only; no domain/application import change. |
| VII Offline first | Pass | Reads the existing slice; offline stays a normal status, not surfaced. |
| VIII Observability | Pass | No new error path. |
| IX Explicit screen states | Pass | Implements the amended Synchronization bullet (v2.8.0). |
| X French, no i18n | Pass | Texts written in the component. |
| XI Monorepo | Pass | One workspace touched. |

No violation: Complexity Tracking is empty.

## Architecture Decisions

None. No decision outlives this feature. Choices (where the line is mounted, how the snackbars learn its height) are in [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/015-sync-status-line/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-sync-status-line.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
apps/mobile/src/adapters/ui/
├── components/
│   ├── SyncStatusLine.tsx            # new: line + pure `syncLine(slice)` mapping
│   ├── SyncStatusLine.stories.tsx    # new
│   ├── sync-status-line.test.tsx     # new
│   ├── SyncLineOffset.tsx            # new: context + hook giving the line's height (0 when hidden)
│   ├── SyncStatusBar.tsx             # 'bar' variant removed, only the Réglages strip remains
│   ├── UndoSnackbar.tsx, NoticeSnackbar.tsx   # bottom offset += line height
│   └── ScreenFab.tsx                 # offsets documented / extended (see research R3)
├── navigation.tsx                    # NavigationTabBar renders the line above TabBar; provides the offset
├── navigation.test.tsx               # line placement, Settings/keyboard hiding, snackbar offsets
├── required-stories.ts               # + SyncStatusLine stories, SyncStatusBar bar-only stories trimmed
└── screens/
    ├── CurrentListScreen / ListsScreen / CatalogScreen / AddArticlesScreen / AccountsScreen   # drop <SyncStatusBar />
    ├── accessibility.test.tsx        # + the line in a problem state
    └── *-screen.test.tsx             # banner assertions replaced by "no banner"
tests/e2e/journeys/sync-unreachable.e2e.ts   # affected journey(s)
specs/003-server-sync/spec.md                # FR-020 (and contracts/ui-screens.md note)
```

**Structure Decision**: the existing mobile workspace and its UI adapter layout; the line lives in `components/` (the shared UI module, Principle V) and is mounted only in `navigation.tsx`.

## Complexity Tracking

None.
