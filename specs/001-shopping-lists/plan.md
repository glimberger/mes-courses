# Implementation Plan: Shopping Lists

**Branch**: `feat/001-shopping-lists` | **Date**: 2026-10-05 (amended 2026-10-06 for constitution
v2.1.0, monorepo, then for Storybook and Detox, then for constitution v2.1.1, then for the
data clarifications, the failure-flow clarifications, the data checklist review, the
observability clarifications, the two rounds of performance clarifications and the CI and
delivery clarifications) |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-shopping-lists/spec.md`

## Summary

Build the first version of Mes courses: an offline mobile app that opens on the current shopping
list, ticks items in and out of the cart, edits lists from a catalog of articles grouped by
category (with optional per-item quantities), and manages several named lists.

This is the project's first feature, so the plan also sets up the stack and the project's
foundations: React Native with Expo (Android and iOS, TypeScript), React Native Paper for
Material 3 themed from `design/material-theme.json`, Zustand for the application state, SQLite on
the device as the local replica every read and write goes to first, a hexagonal layout (domain → application → adapters) enforced by an architecture test,
Sentry behind an error reporting port, and a blocking GitHub Actions CI. Screens are validated in
an on-device Storybook catalog, where every screen state has a story that a Jest test renders,
and Detox journeys run the release build on a device, Android in CI and iOS locally
([research.md](research.md#r22-screen-validation-with-storybook) R22,
[R23](research.md#r23-end-to-end-tests-with-detox)). The repository is set up
as a Yarn workspaces monorepo from the start (Principle XI): the app is the `apps/mobile/`
workspace, and the server and shared packages of later features join it under `apps/` and
`packages/` ([research.md](research.md#r20-monorepo-layout-principle-xi)).
Synchronization with the Raspberry Pi server, the source of truth since constitution v2.0.0
(Principle VII), is deferred to a dedicated feature that brings 001 and 002 in line; this plan
keeps every choice compatible with it ([research.md](research.md#r19-synchronization-deferred-principle-vii)).
The decisions and their alternatives are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React Native (New Architecture, Hermes) through
Expo SDK 57, Node.js 24 LTS and Yarn 4 (through Corepack, `nodeLinker: node-modules`) for
tooling, all provided by a Nix flake dev shell ([research.md](research.md) R21)

**Primary Dependencies**: Expo, React Native Paper 5 (Material 3), React Navigation 7 (native
stack), Zustand 5, expo-sqlite, expo-crypto, @sentry/react-native 8 (full list and justification in
[research.md](research.md#new-dependencies-principle-iv))

**Storage**: SQLite on the device via expo-sqlite; hand-written SQL, migrations by
`PRAGMA user_version` ([data-model.md](data-model.md#sqlite-schema-migration-1))

**Testing**: Jest 30 (`jest-expo` preset), React Native Testing Library for UI, `node:sqlite`
for SQLite adapter tests, dependency-cruiser for the architecture test; Storybook for React
Native 10 for the screen catalog, with every story rendered by a Jest test (portable stories,
R22); Detox 20 with its own Jest 29 for end-to-end journeys in the test-only `tests/e2e/`
workspace (R23)

**Target Platform**: Android and iOS phones (versions supported by Expo SDK 57)

**Project Type**: mobile app, the first workspace (`apps/mobile/`) of a Yarn workspaces monorepo,
plus the test-only `tests/e2e/` workspace

**Performance Goals**: current list fully drawn and accepting taps within 2 s of a cold start, in
9 of 10 launches with existing data, the tester's reaction time not counted, no target for the
first launch or the first launch after an update (SC-001); 95% of 50 ticks shown within 100 ms,
tapped about 3 per second on different items (SC-002); a 200-item list scrolled and ticked at 55 frames per second or more on average,
with at most 5% of frames dropped, the screen set to 60 Hz (SC-008); the add screen showing a
1 000-article catalog within 1 s of opening, in 9 of 10 openings, and search results updated
within 300 ms of 95% of letters typed, whole words at about 3 letters per second (SC-011, R11a); all four on one `preview` build filled by
the measurement seed, on an entry-level Android phone about five years old and the maintainer's
iPhone, a miss on either phone blocking the release (R11). No other action has a time target,
and none is promised above the measurement sizes; no target for memory, battery or download
size (spec Assumptions)

**Constraints**: fully offline, no network on any path (FR-027, Principle VII); no server
synchronization in this feature (deferred, R19, Complexity Tracking); every change
committed to storage before it is shown as saved (FR-028); French-only UI with no i18n layer
(Principle X); accessibility per FR-032 to FR-035; no list content in error reports
(Principle VIII); stored data never deleted or reset to recover from a startup failure
(FR-039); data kept across updates and never opened by an older version (FR-040); data kept
in the system backup, not encrypted beyond the system's own (Assumptions); no storage error
text in reports (FR-030); sync compatibility kept for 003: ids are generated on the device and
never change (R5), and each user action is one `UnitOfWork` transaction (FR-028); every commit synced to storage so it survives a power cut (R4); a full storage shown
with its own message and not reported (R12a); no user, installation or device identifier in
reports, except the random installation id of a native crash, and sessions off (R13); the same
failure sent once per opening, only from `production` and `preview` builds, with the version
and build number (FR-030, R13); the same rules for every feature's reports (FR-030b); email
alerts on new and returning `production` failures, set in Sentry (FR-030c); every report in
Sentry within 1 minute (SC-010), measured by hand; reports raised offline kept on
the device, at most 30 (FR-030a); a screen failing while drawing replaced by a full-screen error
that restarts the app (FR-039a, R13a); a release is a `production` build, sent to Google Play
internal testing and TestFlight with no public listing, gated by every pre-release check,
versioned by hand (1.0.0 for this feature), refusing to build with a test-only option set, and
fixed forward, never rolled back (R24)

**Scale/Scope**: one user, one device; 4 screens and 4 dialogs; up to 1 000 articles in the
catalog, 20 lists and 200 items per list (spec Assumptions), with SC-001, SC-002, SC-008 and SC-011
measured at that size (measurement sizes, not limits), on data shaped like real use (R11); 5 tables

No NEEDS CLARIFICATION remains: the stack was chosen by the maintainer (React Native with Expo),
and every other unknown is resolved in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies | Status |
|---|---|---|---|
| I | Test-First (non-negotiable) | Every task in `tasks.md` puts a failing test before the code it drives. Domain and use cases are driven by fast unit tests; SQLite adapter by contract tests; screens by RNTL tests. Scaffolding (config files, CI) is not production behavior; the first behavior commits start with a red test. Each story's Detox journey is written first and fails, as the outer loop; the inner unit and screen tests drive the code until it turns green (R23). Stories are fixtures, not production code, so they need no test of their own beyond the story test. | ✅ |
| II | Tests as executable specification | Each acceptance scenario (US1-1 … US4-5) and each functional requirement (FR-001 … FR-040, with FR-030a and FR-039a) maps to at least one test named after the behavior, with the scenario or FR id in its name; the success criteria and requirements the spec lists as manual checks are covered by [quickstart.md](quickstart.md) §5 and §6 instead, and a traceability test fails on any id cited nowhere (T138). UI tests query by role and French label, not internals. Detox journeys find elements by French text and accessibility label, no `testID`, and name the scenarios they cover ([contracts/ui-validation.md](contracts/ui-validation.md)). | ✅ |
| III | Fast, deterministic, isolated | Driven ports for IDs (no randomness), no clock port: the undo deadline reads `Date.now`, which Jest fake timers control, in-memory fakes, `node:sqlite` in-memory databases per test, Jest fake timers for the undo snackbar. No network in tests. The story test runs inside `yarn test` with no device. Detox journeys stay out of the unit suite (their own workspace and command), start each file on a fresh install, use no sleeps and no retries (R23). | ✅ |
| IV | Simplicity (YAGNI) | No ORM, no FlashList, no Expo Router; each new dependency is justified in [research.md](research.md#new-dependencies-principle-iv), including Zustand for the application state, chosen by the maintainer for the whole app (R10, [002 research](../002-manage-articles/research.md) R1); no Zustand middleware ([002 research](../002-manage-articles/research.md#r1b-no-zustand-middleware) R1b). Ports are those required by Principle VI only. The Nix flake provides tools only (Node, Corepack, watchman), with no devenv or Devbox layer and no Android SDK in Nix (R21). Storybook and Detox are the maintainer's choice and justified in R22 and R23; no Storybook add-on, no visual regression service, no Detox on debug builds. | ✅ |
| V | Single design system | React Native Paper (MD3) only; theme built from `design/material-theme.json` (light + dark) and checked by a test; its contrast variants stay unused in the JSON until a feature selects them (R2); shared components in `apps/mobile/src/adapters/ui/components/`; tokens for color (the JSON), typography (`theme.fonts`), shapes (`theme.roundness`), elevation (`theme.colors.elevation`) and spacing (`spacing.*`); ESLint bans color literals and inline styles, and limits a screen's own styles to layout from spacing tokens ([research.md](research.md) R2). Storybook catalogs the shared module, so a new shared component is reviewed in its pull request through its stories, in light and dark (R22). | ✅ |
| VI | Hexagonal architecture | In `apps/mobile/src/`: `domain` → `application` (use cases + ports) → `adapters` (sqlite, ui, error-reporting) + `composition` (wiring). The Zustand store is part of the UI adapter. dependency-cruiser test fails on any outward import, on an adapter importing another adapter, on `composition/` imported outside `App.tsx`, on any npm package in the domain or application (type-only included; pure shared packages excepted from 003), and on `zustand` imported outside `adapters/ui` ([research.md](research.md) R15). New rules: Storybook only in story files, `.rnstorybook/` and the story test; stories and testing helpers never imported by production code; `tests/e2e` imports no workspace (R22, R23). | ✅ |
| VII | Remote source of truth, offline first | Local first and offline: every read and write goes to SQLite, no feature touches the network, an offline UI test runs the full scenario with `fetch` throwing, quickstart checks airplane mode on a device. **Not met**: no synchronization with the Pi server and no reconciliation rule (the spec excludes synchronization, FR-027); deferred to a dedicated sync feature (R19), justified in Complexity Tracking. Choices kept sync-compatible: device-generated UUIDs, ids never change, each change is one `UnitOfWork` transaction. | ⚠️ deviation |
| VIII | Observability | `ErrorReporter` port; Sentry adapter with global handlers and native crash handling, an offline cache of 30 reports (FR-030a), source maps through EAS Build, `sendDefaultPii: false`, no breadcrumbs, content-free context, and every JavaScript event filtered in `beforeSend` down to FR-030's fields, the error's own text, the user and the device name removed, then dropped if the same failure was already sent since the app opened; sessions and app hang reports off ([research.md](research.md) R13); a root error boundary reports rendering failures (R13a); one fingerprint per kind of failure and email alerts on new and returning `production` issues (FR-030c); `production` and `preview` environments only, console reporter when no DSN; `RecordingErrorReporter` in tests. Pseudonymous identifier: only native crashes carry one, the SDK's random installation id, as FR-030 allows. | ✅ |
| IX | Explicit screen states | One `ScreenState` union per data region, held in the store, rendered by shared `LoadingState` / `EmptyState` / `ErrorState`; each state tested ([contracts/ui-screens.md](contracts/ui-screens.md)) and has a required story, built through the real store ([contracts/ui-validation.md](contracts/ui-validation.md)). No synchronization status yet: no data is synchronized until the sync feature (R19), which adds it to every data screen. | ✅ (sync status deferred with VII) |
| X | French interface, no i18n | French text only in `apps/mobile/src/adapters/ui/`; domain and use cases return tagged errors; seed names passed in from the UI adapter; tests assert French text; `Intl` formats quantities with a decimal comma. | ✅ |
| XI | Single repository (monorepo) | Yarn 4 workspaces (pinned by `packageManager`, run through Corepack), root `package.json` with `"workspaces": ["apps/*", "packages/*"]`, one `yarn.lock`, one `yarn install --immutable`, one CI. Shared bases at the root: `tsconfig.base.json`, ESLint flat config, Prettier, dependency-cruiser. The app is `@mes-courses/mobile` in `apps/mobile/`. No shared package exists yet, so `packages/` is not created (Principle IV); dependency-cruiser already forbids relative imports across workspaces ([research.md](research.md) R15, R20). The e2e tests are the test-only `tests/e2e/` workspace (`@mes-courses/e2e-tests`), so `"workspaces"` gains `"tests/*"`; its Jest 29 stays local to it, in the same `yarn.lock` (R23). | ✅ |
| QG | Quality gates and CI | CI runs in the same Nix dev shell as local work (R21). `typecheck`, `lint` (+ Prettier check), `test` (+ architecture + story test), `build` (`expo export`), run from the root across every workspace, plus `e2e-android` (Detox on an emulator), on every PR and push to `main`, in place before the first application code is merged; no PR merged until `gh pr checks` shows every job green (no branch protection on this GitHub plan). "Works with the server unreachable" holds trivially: no code path reaches a server. Per constitution v2.1.1, `yarn test` is the fast suite, run before every commit; the Detox journeys are the device suite, run on Android before each push and in CI, and on iOS on the maintainer's Mac before each release and before merging a pull request that changes native configuration (R23). Every job has a time limit (R17). A release is a `production` build, gated by every manual check and the iOS device suite recorded in a pull request, and a `production` build stops if a test-only option is set (R24). | ✅ |
| WF | Development workflow | The spec states offline behavior (FR-027) but excludes synchronization and reconciliation; deferred with VII (R19). | ⚠️ deviation |

**Gate result before research**: one deviation, Principle VII (and the matching workflow rule):
the feature does not synchronize with the server. It is justified in Complexity Tracking. The
Storybook and Detox amendment first recorded a second one, on the Quality Gates (iOS journeys
outside CI, device journeys outside the per-commit gate); constitution v2.1.1 now defines the fast
and device suites and their gates, so it is no longer a deviation.

**Second check, after Phase 1 design**: no new violation; the Principle VII deviation stands as
justified. The design adds no layer, port or dependency beyond those above. Points checked:

- The monorepo layout (R20) adds no runtime code: only a workspaces manifest and shared configs.
  The app is one workspace among the future ones, and the cross-workspace rule is in the
  architecture test from the first commit, before a second workspace exists.
- `ErrorReporter` is declared in `apps/mobile/src/application/ports/` but called from the UI adapter. That
  matches Principle VIII (adapters depend on application ports; domain and application never
  import the SDK).
- The UI adapter calls two pure domain functions (`parseQuantity`, `validateName`) for form
  validation. Adapters may depend inward, so this is allowed.
- Storybook adds no production code path: without `STORYBOOK_ENABLED` the bundle holds no
  story and no Storybook code. Its native peer dependencies are compiled into every build but
  never called. Stories reach data only through the real store and use cases (R22).
- Detox adds native test hooks through a config plugin, and only Detox's builds use the Android
  test APK. Release builds for users are unchanged apart from the plugin's ProGuard keep rules.
  E2E builds have no Sentry DSN, so no test reports to the real service (Principle VIII).
- The data clarifications of 2026-10-06 add no port, layer or dependency: name cleaning and
  the quantity grammar are pure domain rules (R6, R7); the startup error is the existing
  `ErrorState` shown by `App.tsx` (R18a); the backup choice is one Expo config key (R18b).
  Editing only the current list (FR-008) is a UI rule: the use cases keep their `listId`.
- The failure-flow clarifications add no port or dependency either: the store's write queue and a
  reload on failure live in the store (R9), finishing shopping already runs in one transaction
  (R9a), `StorageError` and `DataFromNewerVersion` are thrown by the SQLite adapter (R13, R18c;
  `DataFromNewerVersion` is declared with the ports, since adapters never import each other, R15),
  and `UpdateRequired` is a second full-screen view of `App.tsx`. `toggleItemInCart` keeps its
  signature, which 003 extends.
- The data checklist review adds no port or dependency: two pragmas in `openDatabase` (R4), a
  `StorageFull` kind of the existing `StorageError` (R12a), and a larger measurement seed (R11).
  Not reporting a full storage fits Principle VIII: it is an expected situation the user can
  fix, shown to them, not an error swallowed.
- The observability clarifications add no port, layer or dependency: `setScreen` and
  `crashNatively` (smoke test only) are new methods of the existing `ErrorReporter`; `AppErrorBoundary` and `CrashError` are UI adapter
  components built on the shared `ErrorState`, and "Réessayer" reuses the startup restart
  (R13a); the rest is `Sentry.init` options, two global tags, `eas.json` profiles and the
  `beforeSend` filter with its once-per-opening set (R13). Native crashes are reported, so no
  failure is silent. Their installation id is the pseudonymous identifier Principle VIII
  allows; the spec accepts it for native crashes only (FR-030).
- The performance clarifications add no port, layer or dependency: `filterCatalog` is a pure
  domain function that `getCatalog` already needed, and the store keeps the loaded catalog and
  filters it as the user types (R11a); measurement is a quickstart procedure on the existing
  measurement seed and `preview` profile (R11). FlashList stays out until SC-008 is missed
  (Principle IV).
- The CI and delivery clarifications add no port, layer or runtime dependency: the release guard
  is a pure build-time function called by `app.config.ts`, and distribution is `eas.json` and
  `eas submit`, both already part of Expo's tooling (R24). Credential scanning in CI and an update
  bot stay out (Principle IV, R17).
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
│   ├── ui-screens.md    # Screens, states, French text, accessibility
│   └── ui-validation.md # Required stories and end-to-end journeys
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
package.json                          # private workspaces root: "workspaces": ["apps/*", "packages/*", "tests/*"],
                                      #   "packageManager": "yarn@4.x"; scripts typecheck, lint,
                                      #   format:check, test, test:architecture, build,
                                      #   test:e2e:android, test:e2e:ios
yarn.lock                             # the single lockfile
.yarnrc.yml                           # nodeLinker: node-modules (React Native needs node_modules/)
tsconfig.base.json                    # strict compiler options shared by every workspace
eslint.config.mjs, .prettierrc        # shared lint and format config, per-workspace overrides inside
.dependency-cruiser.cjs               # architecture rules for every workspace (research R15)
flake.nix, flake.lock                 # Nix dev shell: Node 24, Corepack (Yarn), watchman (research R21)
.envrc                                # use flake (direnv)
.talismanrc                           # + yarn.lock and flake.lock entries
.github/workflows/ci.yml              # typecheck, lint, test, build across workspaces; e2e-android
apps/
└── mobile/                           # @mes-courses/mobile, the Expo app
    ├── package.json                  # app dependencies and scripts (start, build: expo export, test, storybook)
    ├── App.tsx                       # Expo entry: builds the composition root, renders the UI
    ├── app.config.ts                 # Expo config (Sentry, SQLite and Detox plugins), version, release guard (R24)
    ├── build-config/
    │   └── release-guard.ts          # assertNoTestOptionsInProduction(env), tested by Jest (R24)
    ├── metro.config.js               # Expo default config wrapped with withStorybook (research R22)
    ├── .rnstorybook/                 # Storybook config: main.ts (story globs), preview.tsx (theme, store decorators)
    ├── eas.json                      # EAS Build and Submit profiles, Node 24 on every profile (R13, R24)
    ├── tsconfig.json                 # extends ../../tsconfig.base.json, adds Expo types
    ├── jest.config.js                # jest-expo preset
    ├── src/
    │   ├── domain/                   # Pure TypeScript, no imports outside this folder
    │   │   ├── name.ts               # validateName, normalizedName, searchForm
    │   │   ├── quantity.ts           # Quantity, parseQuantity
    │   │   ├── category.ts
    │   │   ├── article.ts
    │   │   ├── shopping-list.ts
    │   │   ├── list-item.ts          # transitions: add, toggle, change quantity, finish
    │   │   ├── current-list-view.ts  # grouping and sorting rules (FR-003, FR-005, FR-006)
    │   │   ├── catalog-view.ts       # search and onList marks (FR-009, FR-011)
    │   │   ├── result.ts
    │   │   └── *.test.ts
    │   ├── application/
    │   │   ├── ports/                # UnitOfWork, repositories, IdGenerator, ErrorReporter
    │   │   ├── use-cases/            # one file per use case (contracts/driving-ports.md) + tests
    │   │   └── testing/              # in-memory fakes, RecordingErrorReporter, repository contract suites
    │   ├── adapters/
    │   │   ├── sqlite/               # SqlDatabase interface, migrations, repositories, UnitOfWork + tests
    │   │   ├── error-reporting/      # Sentry and console reporters + tests
    │   │   ├── id/                   # expo-crypto IdGenerator
    │   │   └── ui/
    │   │       ├── theme/            # material-theme.json → Paper MD3 themes, spacing tokens + test
    │   │       ├── state/            # Zustand store: createAppStore, AppStoreProvider, useAppStore + tests
    │   │       ├── testing/          # renderWithStore, createStoryStore and French fixtures (shared by tests and stories)
    │   │       ├── components/       # shared UI module (Principle V): states, rows, fields, formatQuantity, snackbars + stories
    │   │       ├── screens/          # CurrentList, AddArticles, CreateArticle, Lists (+ dialogs) + tests + stories
    │   │       ├── stories.test.tsx  # renders every story in light and dark; checks required stories (R22)
    │   │       ├── navigation.tsx
    │   │       ├── seed.ts           # French default category names and "Ma liste"
    │   │       └── offline.test.tsx  # full scenario with fetch throwing (Principle VII)
    │   └── composition/              # wires adapters into use cases; build-time hooks (seed 200 items, Sentry smoke test)
    └── test/
        └── sqlite/                   # node:sqlite wrapper implementing SqlDatabase for adapter tests
tests/
└── e2e/                              # @mes-courses/e2e-tests, test-only (research R23)
    ├── package.json                  # detox, jest@29, ts-jest; scripts e2e:build:*, e2e:test:* (no "test")
    ├── .detoxrc.js                   # android.emu.release, ios.sim.release
    ├── jest.config.js                # Detox runner, no retries
    └── journeys/                     # *.e2e.ts, one user journey per file (contracts/ui-validation.md)
```

**Structure Decision**: a Yarn workspaces monorepo (Principle XI, [research.md](research.md) R20).
The root holds only the workspace manifest, the lockfile, the shared tool configs and CI; the
Expo app is the `apps/mobile/` workspace. Later features add `apps/server/` and shared packages
under `packages/` without moving anything. Inside the app, source code is split by hexagonal
layer under `apps/mobile/src/`, and the composition root is the only place that knows every
adapter. Tests sit next to the code they cover (`*.test.ts(x)`). The only shared test helper
outside `apps/mobile/src/` is the `node:sqlite` wrapper in `apps/mobile/test/`, which must stay
out of the app bundle. Stories also sit next to the component they show (`*.stories.tsx`).
Device journeys live in the test-only `tests/e2e/` workspace: they need Detox's Jest 29, and
they must stay out of `yarn test`. That workspace defines no `test` script, so the root
`yarn test` never starts a device.

## Implementation notes for `/speckit-tasks`

- **Foundations first** (before any story): workspaces root (`package.json`, `tsconfig.base.json`,
  root scripts running across workspaces), Expo scaffold in `apps/mobile/`, TypeScript strict,
  ESLint/Prettier, Jest, dependency-cruiser architecture test (including the cross-workspace
  rules), CI workflow, README install/run/test sections, `.gitignore` additions (`.expo/`,
  `ios/`, `android/`, `*.jks`, `.env*`, at any depth).
- **Then shared foundations**: `Result`, name and quantity rules, ports and fakes, SQLite
  migration and `SqlDatabase`, theme and shared UI components with their state tests,
  `initializeStore`, Sentry adapter, then the application store ([002 ui-state contract](../002-manage-articles/contracts/ui-state.md)) with its tests before any screen.
- **Screen validation and e2e foundations**: in Setup, Storybook (`metro.config.js`,
  `.rnstorybook/`, `yarn storybook`), the story test with an empty required list, the
  `tests/e2e/` workspace with Detox, the config plugin, `.detoxrc.js`, a first journey that only
  checks the app launches, the root `test:e2e:*` scripts and the `e2e-android` CI job. In
  Foundational, `createStoryStore` and fixtures next to `renderWithStore`, then the stories of
  the shared components with their rows in the required list.
- **Then stories in priority order**: US1 and US2 (P1) together make the MVP; US3 (P2);
  US4 (P3). Each story starts with its Detox journey (red), then goes domain → use case → SQLite
  contract tests → screen tests, adds its screen stories to the required list, and ends when its
  journey is green on Android and iOS
  ([contracts/ui-validation.md](contracts/ui-validation.md)).
- **Data clarifications (2026-10-06)**, to be reflected in the existing tasks:
  - names: `cleanName` (NFC, trim, inner spaces reduced), length in code points, and
    `normalizedName` built on it, with tests for "Pommes  de terre" and a decomposed "é"
    ([data-model.md](data-model.md#name-articles-categories-lists), R6); `NameField` without a
    native `maxLength`;
  - quantities: the amount grammar and the `AmountTooPrecise` and `AmountTooLarge` errors,
    the `quantity_amount <= 9999` check in migration 1, and `formatQuantity` without trailing
    zeros or grouping ([data-model.md](data-model.md#quantity-value-object), R7);
  - startup: `App.tsx` shows `StartupError` with "Réessayer", which reruns the composition
    root, and its required story (R18a, [contracts/ui-screens.md](contracts/ui-screens.md#app-startup-fr-039));
  - `app.config.ts` sets `android.allowBackup: true` (R18b);
  - US2-5 makes "Gâteau" current before adding to it (FR-008).
- **Failure-flow clarifications (2026-10-06)**, to be reflected in the existing tasks:
  - the store's write queue, with an item's queued toggles dropped and a reload on failure (R9);
  - a failed "Annuler" ends the offer with the usual notice (R8); a failed "Terminer les
    courses" closes the dialog with focus back on the action (R9a);
  - the SQLite adapter's `StorageError` with no original text or stack (R13);
  - `migrate` throws `DataFromNewerVersion` above the known version, and `App.tsx` shows
    `UpdateRequired`, with its story and no report (R18c).
- **Data checklist review (2026-10-06)**, to be reflected in the existing tasks:
  - `openDatabase` sets `journal_mode = WAL` and `synchronous = FULL` and checks them (R4);
  - `StorageFull` in the SQLite adapter, the `storageFull` notice with no report, and its
    story (R12a);
  - the measurement seed fills the spec's data size (1 000 articles, 20 lists, 200 items) for
    SC-001 and SC-008 (R11), and the offline scenario and the accessibility pass cover the 12
    actions listed in the spec;
  - quickstart: new step 13 (power cut), the backup check becomes step 14.
- **Observability clarifications (2026-10-06)**, to be reflected in the existing tasks:
  - the Sentry adapter: `maxCacheItems: 30`, `enableNativeCrashHandling: true`,
    `maxBreadcrumbs: 0`, app hang tracking and `enableAutoSessionTracking` off, the
    environment from `EXPO_PUBLIC_APP_ENVIRONMENT` (`production` or `preview`, else the console
    reporter), global tags `operation: 'uncaught'` and `screen` (kept up to date by
    `setScreen`), and `beforeSend` removing `user` and the device name, then dropping a failure
    already sent since the app opened, each asserted on the `Sentry.init` options or on a
    filtered event (R13);
  - `eas.json`: `cli.appVersionSource: remote`, `autoIncrement: true` and
    `EXPO_PUBLIC_APP_ENVIRONMENT` on the `production` and `preview` profiles; the DSN defined
    in the EAS `production` and `preview` environments only (R13);
  - `ErrorReporter.setScreen`, in the port, `RecordingErrorReporter`, the console reporter and
    the navigation container's route-change callback;
  - `AppErrorBoundary` around the navigation and `CrashError` with "Réessayer" restarting like
    `StartupError`, test-first in `App.test.tsx` with a screen that throws while rendering, and
    the `Screens/Crash/Error` required story (R13a, FR-039a);
  - the adapter sets each event's fingerprint to `type | code | operation | screen` (FR-030c);
  - the README lists the Sentry alert setup (two rules on `production`, default rule deleted,
    personal workflow notifications off) and quickstart §6 step 7 checks it once (FR-030c, R13);
  - the traceability test's pattern already finds FR-030b and FR-030c; FR-030b is cited by the
    Sentry adapter's tests, FR-030c and SC-010 by quickstart §6;
  - quickstart §6 becomes the spec's manual check for error tracking (readable stack trace, no
    identifier, a report raised offline arriving after a restart, a native test crash, nothing
    sent from a development run); the smoke test also accepts `native`;
  - the startup and crash retries still pass every failure to the reporter; the tests that
    expected "a second report" assert a second `report` call, and only the adapter's tests
    assert the drop (R13, R18a);
  - the traceability test (T138) also collects FR-030a and FR-039a;
  - the README tells the maintainer what to declare in the store privacy details if the app is
    published (spec Assumptions, R13).
- **Domain clarifications (2026-10-06)**, reflected in the existing tasks
  ([checklists/domain.md](checklists/domain.md)):
  - one store-wide write queue instead of one per item: every change is saved in the order the
    user made it, so "Terminer les courses" or a removal waits for earlier toggles and still runs
    when one fails; a failed toggle drops only that item's queued toggles (R9, T049, T069, T088);
  - the "Annuler" offer ends on a successful write, a toggle included, and survives a failed
    write or refused input; an "Annuler" already queued is carried out (R8, T049, T088);
  - `normalizedName` folds "œ", "æ" and "’", so "Oeufs" and "Œufs" are the same name, and search
    inherits it (R6, T020, T085, T087);
  - "Nouvel article" is always shown on AddArticles and prefills the cleaned query (FR-008,
    US2-19, T092);
  - the data sizes are measurement sizes, not limits: no use case refuses beyond them (R6);
  - `cleanName` removes invisible characters and treats every Unicode space as a space (R6,
    T020);
  - the add button for the matching article in CreateArticle adds with the typed quantity, and an `AlreadyOnList`
    result opens the already-on-list QuantityDialog (US2-9, US2-20, T093);
  - CreateArticle preselects the category of the empty state it was opened from (FR-018, T092,
    T093, T103);
  - a created list is not made current and the user stays on Lists (FR-024, T112); user
    categories stay after "Divers" (`max(position) + 1`, unchanged);
  - one `compareNames` (French collator, `numeric: true`) sorts items, the catalog and the
    lists (R6, T020, T066, T085, T109);
  - the optimistic tick also updates `remainingCount` and `hasItemsInCart`, so "Terminer les
    courses" follows the ticks shown (FR-007, T069);
  - tapping the current list on Lists saves nothing and keeps the undo offer (FR-025, T111);
  - changing a quantity keeps the tick and the lists count all items: already in the data
    model and contract, now cited by FR-015 and US3-8.
- **Performance clarifications (2026-10-06)**, to be reflected in the existing tasks:
  - `filterCatalog(view, query)` in the domain, test-first: it keeps the order of the full view,
    drops empty sections, and computes each article's search form once per view; `getCatalog`
    uses it (R11a, T085, T095, T087);
  - the store's `catalog` region holds the full view; `loadCatalog()` reads it when AddArticles
    opens and on "Réessayer", and `searchCatalog(query)` filters it synchronously with no storage
    read and no `loading` state, asserted by a store test where a second `getCatalog` call would
    fail ([002 ui-state contract](../002-manage-articles/contracts/ui-state.md), T088, T098);
  - the measurement seed is built into a `preview` build for SC-001, SC-002, SC-008 and SC-011
    (R11, T135); quickstart steps 11 and 12 set the screen to 60 Hz and time on slow-motion
    video, and new step 15 checks SC-011; T137 records each result per phone, and any miss
    blocks the release (spec Success Criteria);
  - the traceability test needs no change: SC ids are not collected, and SC-011 is cited by
    quickstart §5;
  - second round: the measurement seed builds data shaped like real use (R11, T135): 1 000
    realistic French names from a base list of 100 common products, each with numbered
    variants ("Pommes", "Pommes 2" … "Pommes 10"), 100 of them lengthened to exactly 60
    characters; 200 items on the current list, every other one ticked and every other pair with
    a quantity, so the four combinations of ticked and quantity occur; 50 items on each of the
    19 other lists; quickstart steps 11 and 15 state the tap and typing pace.
- **CI and delivery clarifications (2026-10-06)**, to be reflected in the existing tasks:
  - `timeout-minutes` on every CI job: 15 for `typecheck`, `lint`, `test` and `build`, 45 for
    `e2e-android` (R17, T015, T016);
  - `assertNoTestOptionsInProduction(env)` in `apps/mobile/build-config/release-guard.ts`,
    test-first, called by `app.config.ts`: with `EXPO_PUBLIC_APP_ENVIRONMENT=production` it
    throws, naming each of `EXPO_PUBLIC_SEED_ITEMS`, `EXPO_PUBLIC_SENTRY_SMOKE_TEST` and
    `STORYBOOK_ENABLED` that is set; any other environment, or none set, returns normally (R24);
  - `app.config.ts` sets `version: '1.0.0'`; `eas.json` sets `"node"` to Node 24 on every
    profile and adds a `submit.production` profile for Google Play's internal track and
    TestFlight (R24, T134);
  - the README explains the release steps of quickstart §8, the versioning rule, the store
    credentials kept in EAS, and the one-time manual first upload to Google Play (T136);
  - research R17 and quickstart §7 cite the constitution's current merge rule.
- No task touches the network or the server: synchronization belongs to the sync feature (R19).
- The Sentry project is in place (done by the maintainer). The Sentry DSN and build credential
  live in EAS environment variables, set by the maintainer, and are never committed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle VII and its workflow rule: no synchronization with the Pi server, no reconciliation rule in the spec (FR-027 excludes synchronization) | Constitution v2.0.0 was adopted after this spec; the spec defines a single-device app. A dedicated sync feature (next `/speckit-specify`) defines the server port, the queue of offline changes, reconciliation and the synchronization status for 001 and 002 together. | Adding sync here would invent reconciliation rules the spec does not state and need the server's technology and API, still undecided. Holding the first feature until sync is specified delays the foundations (stack, CI, local storage, screens) that sync builds on and does not change. |

**Migration note** (constitution Governance): [003-server-sync](../003-server-sync/plan.md) closes
this deviation. Once 003 is implemented, every command use case of this feature records its
changes through the `ChangeRecorder` port, inside its existing transaction
([003 app-ports contract](../003-server-sync/contracts/app-ports.md#changes-to-existing-use-cases-001-and-002)).
Undoable changes are held until the undo offer ends (item removal, R8). If this feature is already
implemented by then, 003's tasks add these calls, keeping its existing tests green.
