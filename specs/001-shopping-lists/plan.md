# Implementation Plan: Shopping Lists

**Branch**: `feat/001-shopping-lists` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-shopping-lists/spec.md`

## Summary

Build the first version of Mes courses: an offline mobile app that opens on the current shopping
list, ticks items in and out of the cart, edits lists from a catalog of articles grouped by
category (with optional per-item quantities), and manages several named lists.

This is the project's first feature, so the plan also sets up the stack and the project's
foundations: React Native with Expo (Android and iOS, TypeScript), React Native Paper for
Material 3 themed from `design/material-theme.json`, SQLite on the device as the only source of
truth, a hexagonal layout (domain → application → adapters) enforced by an architecture test,
Sentry behind an error reporting port, and a blocking GitHub Actions CI with branch protection.
The decisions and their alternatives are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React Native (New Architecture, Hermes) through
Expo SDK 57, Node.js 24 LTS for tooling

**Primary Dependencies**: Expo, React Native Paper 5 (Material 3), React Navigation 7 (native
stack), expo-sqlite, expo-crypto, @sentry/react-native 8 (full list and justification in
[research.md](research.md#new-dependencies-principle-iv))

**Storage**: SQLite on the device via expo-sqlite; hand-written SQL, migrations by
`PRAGMA user_version` ([data-model.md](data-model.md#sqlite-schema-migration-1))

**Testing**: Jest 30 (`jest-expo` preset), React Native Testing Library for UI, `node:sqlite`
for SQLite adapter tests, dependency-cruiser for the architecture test

**Target Platform**: Android and iOS phones (versions supported by Expo SDK 57)

**Project Type**: mobile app (single Expo project)

**Performance Goals**: current list usable within 2 s of launch (SC-001); tick feedback
within 100 ms (SC-002); 200-item list scrolls without visible lag (SC-008)

**Constraints**: fully offline, no network on any path (FR-027, Principle VII); every change
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
| IV | Simplicity (YAGNI) | No ORM, no global state library, no FlashList, no Expo Router, no E2E framework; each new dependency is justified in [research.md](research.md#new-dependencies-principle-iv). Ports are those required by Principle VI only. | ✅ |
| V | Single design system | React Native Paper (MD3) only; theme built from `design/material-theme.json` (light + dark) and checked by a test; shared components in `src/adapters/ui/components/`; spacing tokens; ESLint bans color literals and inline styles. | ✅ |
| VI | Hexagonal architecture | `src/domain` → `src/application` (use cases + ports) → `src/adapters` (sqlite, ui, error-reporting) + `src/composition` (wiring). dependency-cruiser test fails on any outward import ([research.md](research.md) R15). | ✅ |
| VII | Offline first | SQLite is the only data source; no feature touches the network; an offline UI test runs the full scenario with `fetch` throwing; quickstart checks airplane mode on a device. | ✅ |
| VIII | Observability | `ErrorReporter` port; Sentry adapter with global handlers, offline cache, source maps through EAS Build, `sendDefaultPii: false`, content-free context; console reporter when no DSN; `RecordingErrorReporter` in tests. | ✅ |
| IX | Explicit screen states | One `ScreenState` union per data region, rendered by shared `LoadingState` / `EmptyState` / `ErrorState`; each state tested ([contracts/ui-screens.md](contracts/ui-screens.md)). No synchronized data, so no sync status yet. | ✅ |
| X | French interface, no i18n | French text only in `src/adapters/ui/`; domain and use cases return tagged errors; seed names passed in from the UI adapter; tests assert French text; `Intl` formats quantities with a decimal comma. | ✅ |
| QG | Quality gates and CI | `typecheck`, `lint` (+ Prettier check), `test` (+ architecture), `build` (`expo export`) on every PR and push to `main`; set as required checks with `enforce_admins` before the first application code is merged. | ✅ |

**Gate result before research**: no violation.

**Second check, after Phase 1 design**: still no violation. The design adds no layer, port or dependency beyond
those above. Two points checked:

- `ErrorReporter` is declared in `src/application/ports/` but called from the UI adapter. That
  matches Principle VIII (adapters depend on application ports; domain and application never
  import the SDK).
- The UI adapter calls two pure domain functions (`parseQuantity`, `validateName`) for form
  validation. Adapters may depend inward, so this is allowed.

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
│       ├── components/          # shared UI module (Principle V): states, rows, fields, formatQuantity
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
  `initializeStore`, Sentry adapter.
- **Then stories in priority order**: US1 and US2 (P1) together make the MVP; US3 (P2);
  US4 (P3). Each story goes domain → use case → SQLite contract tests → screen tests.
- Branch protection on `main` and the Sentry project are in place (done by the maintainer).
  The CI job names must match the required checks. The Sentry DSN and build credential live in
  EAS environment variables, set by the maintainer, and are never committed.

## Complexity Tracking

No constitution violation to justify.
