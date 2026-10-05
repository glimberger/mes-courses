# Implementation Plan: Shopping Lists

**Branch**: `feat/001-shopping-lists` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-shopping-lists/spec.md`

## Summary

Build the first version of Mes courses: an offline mobile app that opens on the current shopping
list, ticks items in and out of the cart, edits lists from a catalog of articles grouped by
category (with optional per-item quantities), and manages several named lists.

This is the project's first feature, so the plan also sets up the stack and the project's
foundations: React Native with Expo (Android and iOS, TypeScript), React Native Paper for
Material 3 themed from `design/material-theme.json`, Zustand for the application state, SQLite on
the device as the local replica every read and write goes to first, a hexagonal layout (domain → application → adapters) enforced by an architecture test,
Sentry behind an error reporting port, and a blocking GitHub Actions CI.
Synchronization with the Raspberry Pi server, the source of truth since constitution v2.0.0
(Principle VII), is deferred to a dedicated feature that brings 001 and 002 in line; this plan
keeps every choice compatible with it ([research.md](research.md#r19-synchronization-deferred-principle-vii)).
The decisions and their alternatives are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React Native (New Architecture, Hermes) through
Expo SDK 57, Node.js 24 LTS for tooling

**Primary Dependencies**: Expo, React Native Paper 5 (Material 3), React Navigation 7 (native
stack), Zustand 5, expo-sqlite, expo-crypto, @sentry/react-native 8 (full list and justification in
[research.md](research.md#new-dependencies-principle-iv))

**Storage**: SQLite on the device via expo-sqlite; hand-written SQL, migrations by
`PRAGMA user_version` ([data-model.md](data-model.md#sqlite-schema-migration-1))

**Testing**: Jest 30 (`jest-expo` preset), React Native Testing Library for UI, `node:sqlite`
for SQLite adapter tests, dependency-cruiser for the architecture test

**Target Platform**: Android and iOS phones (versions supported by Expo SDK 57)

**Project Type**: mobile app (single Expo project)

**Performance Goals**: current list usable within 2 s of launch (SC-001); tick feedback
within 100 ms (SC-002); 200-item list scrolls without visible lag (SC-008)

**Constraints**: fully offline, no network on any path (FR-027, Principle VII); no server
synchronization in this feature (deferred, R19, Complexity Tracking); every change
committed to storage before it is shown as saved (FR-028); French-only UI with no i18n layer
(Principle X); accessibility per FR-032 to FR-035; no list content in error reports
(Principle VIII)

**Scale/Scope**: one user, one device; 4 screens and 4 dialogs; hundreds of articles at most,
around 200 items per list at most; 5 tables

No NEEDS CLARIFICATION remains: the stack was chosen by the maintainer (React Native with Expo),
and every other unknown is resolved in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies | Status |
|---|---|---|---|
| I | Test-First (non-negotiable) | Every task in `tasks.md` puts a failing test before the code it drives. Domain and use cases are driven by fast unit tests; SQLite adapter by contract tests; screens by RNTL tests. Scaffolding (config files, CI) is not production behavior; the first behavior commits start with a red test. | ✅ |
| II | Tests as executable specification | Each acceptance scenario (US1-1 … US4-5) maps to at least one test named after the behavior, with the scenario id in its name for traceability. UI tests query by role and French label, not internals. | ✅ |
| III | Fast, deterministic, isolated | Driven ports for IDs (no randomness), no clock needed, in-memory fakes, `node:sqlite` in-memory databases per test, Jest fake timers for the undo snackbar. No network in tests. | ✅ |
| IV | Simplicity (YAGNI) | No ORM, no FlashList, no Expo Router, no E2E framework; each new dependency is justified in [research.md](research.md#new-dependencies-principle-iv), including Zustand for the application state, chosen by the maintainer for the whole app (R10, [002 research](../002-manage-articles/research.md) R1); no Zustand middleware ([002 research](../002-manage-articles/research.md#r1b-no-zustand-middleware) R1b). Ports are those required by Principle VI only. | ✅ |
| V | Single design system | React Native Paper (MD3) only; theme built from `design/material-theme.json` (light + dark) and checked by a test; shared components in `src/adapters/ui/components/`; spacing tokens; ESLint bans color literals and inline styles. | ✅ |
| VI | Hexagonal architecture | `src/domain` → `src/application` (use cases + ports) → `src/adapters` (sqlite, ui, error-reporting) + `src/composition` (wiring). The Zustand store is part of the UI adapter. dependency-cruiser test fails on any outward import, and on `zustand` imported outside `src/adapters/ui` ([research.md](research.md) R15). | ✅ |
| VII | Remote source of truth, offline first | Local first and offline: every read and write goes to SQLite, no feature touches the network, an offline UI test runs the full scenario with `fetch` throwing, quickstart checks airplane mode on a device. **Not met**: no synchronization with the Pi server and no reconciliation rule (the spec excludes synchronization, FR-027); deferred to a dedicated sync feature (R19), justified in Complexity Tracking. Choices kept sync-compatible: device-generated UUIDs, ids never change, each change is one `UnitOfWork` transaction. | ⚠️ deviation |
| VIII | Observability | `ErrorReporter` port; Sentry adapter with global handlers, offline cache, source maps through EAS Build, `sendDefaultPii: false`, content-free context; console reporter when no DSN; `RecordingErrorReporter` in tests. | ✅ |
| IX | Explicit screen states | One `ScreenState` union per data region, held in the store, rendered by shared `LoadingState` / `EmptyState` / `ErrorState`; each state tested ([contracts/ui-screens.md](contracts/ui-screens.md)). No synchronization status yet: no data is synchronized until the sync feature (R19), which adds it to every data screen. | ✅ (sync status deferred with VII) |
| X | French interface, no i18n | French text only in `src/adapters/ui/`; domain and use cases return tagged errors; seed names passed in from the UI adapter; tests assert French text; `Intl` formats quantities with a decimal comma. | ✅ |
| QG | Quality gates and CI | `typecheck`, `lint` (+ Prettier check), `test` (+ architecture), `build` (`expo export`) on every PR and push to `main`, in place before the first application code is merged; no PR merged until `gh pr checks` shows every job green (no branch protection on this GitHub plan). "Works with the server unreachable" holds trivially: no code path reaches a server. | ✅ |
| WF | Development workflow | The spec states offline behavior (FR-027) but excludes synchronization and reconciliation; deferred with VII (R19). | ⚠️ deviation |

**Gate result before research**: one deviation, Principle VII (and the matching workflow rule):
the feature does not synchronize with the server. It is justified in Complexity Tracking.

**Second check, after Phase 1 design**: no new violation; the Principle VII deviation stands as
justified. The design adds no layer, port or dependency beyond those above. Points checked:

- `ErrorReporter` is declared in `src/application/ports/` but called from the UI adapter. That
  matches Principle VIII (adapters depend on application ports; domain and application never
  import the SDK).
- The UI adapter calls two pure domain functions (`parseQuantity`, `validateName`) for form
  validation. Adapters may depend inward, so this is allowed.
- Nothing in the design blocks the sync feature: ids are device UUIDs that never change, each
  change is one `UnitOfWork` transaction (where a later outbox write can join it), and no read
  model assumes the device holds the only copy. The open questions for that feature (first-launch
  seed on several devices, concurrent ticks, the current list, deletions) are listed in R19.

## Project Structure

### Documentation (this feature)

```text
specs/001-shopping-lists/
├── plan.md              # This file
├── research.md          # Phase 0: stack and design decisions
├── data-model.md        # Phase 1: entities, rules, read models, SQLite schema
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── driving-ports.md # Use cases offered to the UI
│   ├── driven-ports.md  # Repositories, IdGenerator, ErrorReporter
│   └── ui-screens.md    # Screens, states, French text, accessibility
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
App.tsx                          # Expo entry: builds the composition root, renders the UI
app.config.ts                    # Expo config (Sentry and SQLite plugins)
src/
├── domain/                      # Pure TypeScript, no imports outside this folder
│   ├── name.ts                  # validateName, normalizedName, searchForm
│   ├── quantity.ts              # Quantity, parseQuantity
│   ├── category.ts
│   ├── article.ts
│   ├── shopping-list.ts
│   ├── list-item.ts             # transitions: add, toggle, change quantity, finish
│   ├── current-list-view.ts     # grouping and sorting rules (FR-003, FR-005, FR-006)
│   ├── catalog-view.ts          # search and onList marks (FR-009, FR-011)
│   ├── result.ts
│   └── *.test.ts
├── application/
│   ├── ports/                   # UnitOfWork, repositories, IdGenerator, ErrorReporter
│   ├── use-cases/               # one file per use case (contracts/driving-ports.md) + tests
│   └── testing/                 # in-memory fakes, RecordingErrorReporter, repository contract suites
├── adapters/
│   ├── sqlite/                  # SqlDatabase interface, migrations, repositories, UnitOfWork + tests
│   ├── error-reporting/         # Sentry and console reporters + tests
│   ├── id/                      # expo-crypto IdGenerator
│   └── ui/
│       ├── theme/               # material-theme.json → Paper MD3 themes, spacing tokens + test
│       ├── state/               # Zustand store: createAppStore, AppStoreProvider, useAppStore + tests
│       ├── testing/             # renderWithStore
│       ├── components/          # shared UI module (Principle V): states, rows, fields, formatQuantity, snackbars
│       ├── screens/             # CurrentList, AddArticles, CreateArticle, Lists (+ dialogs) + tests
│       ├── navigation.tsx
│       ├── seed.ts              # French default category names and "Ma liste"
│       └── offline.test.tsx     # full scenario with fetch throwing (Principle VII)
└── composition/                 # wires adapters into use cases; dev-only hooks (seed 200 items, Sentry smoke test)
test/
└── sqlite/                      # node:sqlite wrapper implementing SqlDatabase for adapter tests
.dependency-cruiser.cjs          # architecture rules (research R15)
eslint.config.mjs, .prettierrc, tsconfig.json, jest.config.js, .nvmrc
.github/workflows/ci.yml         # typecheck, lint, test, build
```

**Structure Decision**: a single Expo project at the repository root. Source code is split by
hexagonal layer under `src/`, and the composition root is the only place that knows every
adapter. Tests sit next to the code they cover (`*.test.ts(x)`). The only shared test helper
outside `src/` is the `node:sqlite` wrapper, which must stay out of the app bundle.

## Implementation notes for `/speckit-tasks`

- **Foundations first** (before any story): Expo scaffold, TypeScript strict, ESLint/Prettier,
  Jest, dependency-cruiser architecture test, CI workflow, README install/run/test
  sections, `.gitignore` additions (`.expo/`, `ios/`, `android/`, `*.jks`, `.env*`).
- **Then shared foundations**: `Result`, name and quantity rules, ports and fakes, SQLite
  migration and `SqlDatabase`, theme and shared UI components with their state tests,
  `initializeStore`, Sentry adapter, then the application store ([002 ui-state contract](../002-manage-articles/contracts/ui-state.md)) with its tests before any screen.
- **Then stories in priority order**: US1 and US2 (P1) together make the MVP; US3 (P2);
  US4 (P3). Each story goes domain → use case → SQLite contract tests → screen tests.
- No task touches the network or the server: synchronization belongs to the sync feature (R19).
- The Sentry project is in place (done by the maintainer). The Sentry DSN and build credential
  live in EAS environment variables, set by the maintainer, and are never committed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle VII and its workflow rule: no synchronization with the Pi server, no reconciliation rule in the spec (FR-027 excludes synchronization) | Constitution v2.0.0 was adopted after this spec; the spec defines a single-device app. A dedicated sync feature (next `/speckit-specify`) defines the server port, the queue of offline changes, reconciliation and the synchronization status for 001 and 002 together. | Adding sync here would invent reconciliation rules the spec does not state and need the server's technology and API, still undecided. Holding the first feature until sync is specified delays the foundations (stack, CI, local storage, screens) that sync builds on and does not change. |
