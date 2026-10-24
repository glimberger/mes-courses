# Implementation Plan: Bottom Tab Navigation and Tap-to-Add Flow

**Branch**: `docs/issue-170-specification-011-and-mockups-of-the-tab-navigation` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-tab-navigation/spec.md`

## Summary

Replace the single native stack of `apps/mobile` with a bottom tab navigator of four tabs, each with its own native stack (Courses, Listes, Articles, Réglages). The current list gains a row menu and an "Ajouter" FAB; the add screen becomes a tap-to-add catalog; the Listes tab gets an "en cours" chip and tap-to-make-current; the Articles tab becomes the one place for global catalog management (search, grouped list, usage badge, edit dialog, delete confirmation, category creation from the picker). Almost everything reuses existing use cases; the work is in the UI adapter. See [research.md](research.md), [contracts/ui-screens.md](contracts/ui-screens.md).

## Technical Context

**Language/Version**: TypeScript 6, React Native with Expo (existing `apps/mobile`)

**Primary Dependencies**: React Navigation (native stack, existing), react-native-paper (existing); new: `@react-navigation/bottom-tabs` (matching the installed React Navigation major), justified in research.md

**Storage**: unchanged (local SQLite replica, synchronized)

**Testing**: Jest with React Native Testing Library; stories and story screenshot tests; Detox E2E on Android (iOS dropped for now)

**Target Platform**: Android (iOS code paths kept, not delivered)

**Project Type**: mobile app workspace (hexagonal) inside the pnpm monorepo

**Performance Goals**: a tap on an article reflects in the row without waiting for the network or a dialog

**Constraints**: offline first (Principle VII); French UI text (X); Material 3 tokens only (V); all screens implement explicit states (IX)

**Scale/Scope**: 4 tabs, 5 screens touched, 2 dialogs new, 1 route removed

## Constitution Check

| Principle | Verdict |
| --- | --- |
| I Test-First / II / III | Pass. Each task writes its test first; navigation tests use in-memory doubles; Detox journeys per story. |
| IV Simplicity | Pass with one justified dependency (`@react-navigation/bottom-tabs`); no new store, no new use case unless tap-to-add proves it needs one. |
| V Single design system | Pass. Tab bar, round toggle, usage badge, chip and FAB reuse or extend the shared UI module and tokens; mockups updated first. |
| VI Hexagonal | Pass. Changes are in the UI adapter; the architecture test still applies. |
| VII Offline first | Pass. Every action goes through existing use cases on the local replica. |
| VIII Error tracking | Pass. Per-screen error boundary kept; the reporter still gets the route name. |
| IX Explicit states | Pass. See the contract. |
| X French interface | Pass. All text is in the UI adapter. |
| XI Monorepo | Pass. Only `apps/mobile` and its tests change (plus the dependency in its manifest and the lockfile). |

No violation; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/011-tab-navigation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-screens.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/mobile/src/adapters/ui/
├── navigation.tsx (+ test)            # tab navigator, four stacks, snackbars above the bar, screen tracking
├── routes.ts                          # RootTabParamList + per-stack param lists; EditArticle removed
├── required-stories.ts                # new story ids
├── components/                        # TabBar, AddToggle (round), UsageBadge, RowMenu if not shared yet
└── screens/
    ├── CurrentListScreen.tsx          # no header icons, FAB "Ajouter", row menu
    ├── ListsScreen.tsx                # "en cours" chip, tap to make current
    ├── CatalogScreen.tsx              # new: Articles tab
    ├── EditArticleDialog.tsx          # replaces EditArticleScreen
    ├── DeleteArticleDialog.tsx        # adds the affected-lists count
    └── AddArticlesScreen.tsx          # tap-to-add
apps/mobile/package.json               # @react-navigation/bottom-tabs
tests/e2e/                             # Detox suites per story
design/mockups/                        # delivered by #170, before the code
```

**Structure Decision**: stay in the existing UI adapter folders; one new screen (`CatalogScreen`) and one dialog (`EditArticleDialog`).

## Delivery Phases (one sub-issue of epic #169 each)

| Phase | Sub-issue | Wave | Content |
| --- | --- | --- | --- |
| 1 | #170 | 1 | This specification and the mockups |
| 2 | #171 | 2 | Tab navigation: four tabs with nested stacks |
| 3 | #172 | 3 | Courses tab: row menu, FAB, bottom inset |
| 4 | #173 | 3 | Listes tab: chip and tap to make current |
| 5 | #174 | 3 | Articles tab: global catalog management |
| 6 | #175 | 4 | Tap-to-add on the add screen |

Phases 3, 4 and 5 can run in parallel after phase 2; phase 6 waits for phase 5 (both edit `AddArticlesScreen`, and management must exist in the Articles tab before leaving the add screen).

## Complexity Tracking

No violations.
