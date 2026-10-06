---

description: "Task list for feature 001-shopping-lists"
---

# Tasks: Shopping Lists

**Input**: Design documents from `specs/001-shopping-lists/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md), and the
application store contract shared with 002:
[002 contracts/ui-state.md](../002-manage-articles/contracts/ui-state.md)

**Tests**: REQUIRED. The constitution makes Test-Driven Development non-negotiable (Principle I):
every test task comes before the implementation task it drives. Run the new test, confirm it
fails for the expected reason (Red), then write the minimum code to pass it (Green), then
refactor with the suite green. Test names state the behavior in domain language and carry the
spec scenario id when there is one (for example `"US1-6 unticked items come before ticked items
within a category"`), so `quickstart.md` can find them.

**Organization**: tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1 … US4)
- Every task names the exact file(s) it touches

## Path Conventions

Yarn workspaces monorepo ([plan.md](plan.md#source-code-repository-root), [research.md](research.md)
R20). The root holds the workspaces manifest, the lockfile, the shared tool configs and CI. The
Expo app is the `apps/mobile/` workspace: `apps/mobile/src/domain/`,
`apps/mobile/src/application/{ports,use-cases,testing}/`,
`apps/mobile/src/adapters/{sqlite,error-reporting,id,ui}/`, `apps/mobile/src/composition/`,
`apps/mobile/test/sqlite/`. Tests sit next to the code they cover as `*.test.ts(x)`. Commands run
from the repository root.

## Rules that apply to every task

- **No network, no server**: no task touches the network or the Raspberry Pi server.
  Synchronization belongs to a later feature ([research.md](research.md) R19).
- **French text only in the UI adapter** (`apps/mobile/src/adapters/ui/`). Domain and use cases return typed
  results and tagged errors (Principle X). UI tests assert the exact French text from
  [contracts/ui-screens.md](contracts/ui-screens.md).
- **Design system**: screens use only React Native Paper and `apps/mobile/src/adapters/ui/components/`. They
  use no color literals and no inline styles, only theme tokens and `spacing` (Principle V).
- **Error reports** carry `{ operation, screen }` only, never names, quantities or list content
  (Principle VIII).
- **Every write** runs inside `UnitOfWork.run` and is committed before its promise resolves
  (FR-028).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: a workspaces root and an empty, buildable Expo app in `apps/mobile/`, with every
quality gate and CI in place before any application code ([plan.md](plan.md#implementation-notes-for-speckit-tasks), Quality Gates).

- [ ] T001 Create the Nix dev shell ([research.md](research.md) R21): `flake.nix` with `devShells.default` for `aarch64-darwin`, `x86_64-darwin`, `x86_64-linux` and `aarch64-linux`, providing `nodejs_24`, `corepack_24` and `watchman` from a stable `nixpkgs` branch (if `corepack_24` is missing from that branch, use the `nodejs_24` Corepack with shims installed into a project-local folder added to `PATH` in `shellHook`), and `.envrc` with `use flake`. Run `nix flake lock` to produce `flake.lock`, and check that `node --version` and `yarn --version` inside `nix develop` print Node 24 and Yarn 4. Then create the workspaces root ([research.md](research.md) R20) inside that shell: create a private root `package.json` (name `mes-courses`) with `"packageManager": "yarn@4.x"` (the current Yarn 4 release, exact version) and `"workspaces": ["apps/*", "packages/*"]`, a `.yarnrc.yml` with `nodeLinker: node-modules` (React Native does not support Plug'n'Play), and `tsconfig.base.json` with the strict compiler options. Then scaffold the Expo SDK 57 app in `apps/mobile/` with the blank TypeScript template, keeping the existing `README.md`, `design/`, `specs/` and `.specify/` at the root. Produce `apps/mobile/package.json` (name `@mes-courses/mobile`, private), `apps/mobile/App.tsx`, `apps/mobile/index.ts`, `apps/mobile/app.config.ts` (replace `app.json`: name "Mes courses", slug `mes-courses`, New Architecture on) and `apps/mobile/tsconfig.json` extending `../../tsconfig.base.json` and `expo/tsconfig.base`. Run `yarn install` at the root so there is a single `yarn.lock` and a root `node_modules/`, and check that `yarn expo start` from `apps/mobile/` resolves the hoisted dependencies with Expo's default Metro config.
- [ ] T002 Add `"engines": { "node": ">=24" }` in the root `package.json` (the Node version itself comes from `flake.lock`; there is no `.nvmrc`).
- [ ] T003 Extend `.gitignore` with `node_modules/`, `.expo/`, `dist/`, `ios/`, `android/`, `*.jks`, `.env*` and `coverage/`, as patterns that match in any workspace, plus Yarn's entries: `.yarn/*` with `!.yarn/patches`, `!.yarn/plugins`, `!.yarn/releases`, `!.yarn/sdks`, `!.yarn/versions`, `.pnp.*`, and `.direnv/` for direnv.
- [ ] T004 Create `.talismanrc` with two `fileignoreconfig` entries, both with `ignore_detectors: [filecontent]`: `flake.lock` with the comment and exact entry required by the workspace `AGENTS.md`, and `yarn.lock` with a comment saying Yarn lockfiles hold package checksums, not secrets. Do this before the first commit that contains either lockfile.
- [ ] T005 Install the runtime dependencies listed in [research.md](research.md#new-dependencies-principle-iv) into the app workspace, running `yarn expo install` from `apps/mobile/` for Expo-managed versions: `react-native-paper`, `react-native-safe-area-context`, `@expo/vector-icons`, `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `zustand`, `expo-sqlite`, `expo-crypto`, `@sentry/react-native`. Register the `expo-sqlite` and `@sentry/react-native/expo` config plugins in `apps/mobile/app.config.ts`.
- [ ] T006 [P] Configure Jest 30 with the `jest-expo` preset and React Native Testing Library in `apps/mobile/jest.config.js` and `apps/mobile/package.json` (scripts `test`, `test:watch`). Add the root script `test` (`yarn workspaces foreach --all --exclude mes-courses run test`). Add a trivial green test in `apps/mobile/src/smoke.test.ts` to prove the runner works, then delete it once the first real test exists.
- [ ] T007 [P] Configure ESLint 9 flat config in the root `eslint.config.mjs`: `typescript-eslint` strict and `eslint-config-prettier` for every workspace, plus `eslint-config-expo` and `eslint-plugin-react-native` (with `react-native/no-color-literals` and `react-native/no-inline-styles` as errors) scoped to `apps/mobile/**`. Add Prettier 3 in the root `.prettierrc`, the root scripts `lint`, `format` and `format:check`, and `typecheck` (`tsc --noEmit`) in `apps/mobile/package.json` with a root `typecheck` running it in every workspace ([research.md](research.md) R16).
- [ ] T008 [P] Configure dependency-cruiser in the root `.dependency-cruiser.cjs` with the rules of [research.md](research.md) R15:
  - no relative import crosses a workspace folder (`apps/*`, `packages/*`), and no app workspace imports another;
  - `apps/mobile/src/domain/**` imports nothing outside `apps/mobile/src/domain/`, npm packages included;
  - `apps/mobile/src/application/**` imports only `apps/mobile/src/domain/` and `apps/mobile/src/application/`;
  - only `apps/mobile/src/adapters/**` and `apps/mobile/src/composition/**` import `apps/mobile/src/adapters/**`;
  - `zustand` is imported only under `apps/mobile/src/adapters/ui/**`;
  - `zustand/middleware` and `immer` are imported nowhere;
  - no circular dependency.

  Add the script `test:architecture` in the root `package.json`. Prove each rule fails on a deliberate violation in a throwaway file, then delete the file.
- [ ] T009 Add the GitHub Actions workflow `.github/workflows/ci.yml`, triggered on `pull_request` and on `push` to `main`, `ubuntu-latest`. Each job installs Nix with `DeterminateSystems/nix-installer-action`, caches the store with `DeterminateSystems/magic-nix-cache-action`, and runs every command as `nix develop --command …`, starting with `yarn install --immutable` at the root ([research.md](research.md) R21). Jobs: `typecheck`; `lint` (ESLint + `yarn format:check`); `test` (`yarn test` + `yarn test:architecture`); `build` (root `yarn build`, running `build` in every workspace; the app's `build` is `expo export --platform android --platform ios`) ([research.md](research.md) R17).
- [ ] T010 Replace the "Install, run and test" section of `README.md` with the repository layout (`apps/mobile/`, later `apps/server/` and `packages/`), the prerequisites (Nix with flakes enabled, optionally `direnv` with `nix-direnv`; Android Studio or Xcode for device builds), entering the dev shell (`direnv allow` or `nix develop`), `yarn install` at the root, the check commands, `yarn expo run:android` / `run:ios` from `apps/mobile/` with a development build, the optional `EXPO_PUBLIC_SENTRY_DSN`, and the merge rule: `gh pr checks` must be all green before merging.

**Checkpoint**: `yarn typecheck && yarn lint && yarn format:check && yarn test && yarn test:architecture && yarn build` is green locally from the root, and CI is green on the setup pull request.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: domain rules, ports, fakes, SQLite storage, error reporting, theme, shared state
components, the application store core, and the app shell that launches on a seeded store. Every
story depends on them.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Domain foundations

- [ ] T011 [P] Write failing tests for `Result` helpers (`ok`, `err`, type narrowing on `ok`) in `apps/mobile/src/domain/result.test.ts`.
- [ ] T012 [P] Implement `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }` with `ok()` / `err()` in `apps/mobile/src/domain/result.ts` to turn T011 green.
- [ ] T013 [P] Write failing tests for name rules in `apps/mobile/src/domain/name.test.ts`, per [data-model.md](data-model.md#name-articles-categories-lists):
  - `validateName` trims and returns the trimmed name;
  - `NameRequired` for empty or blank text (US2-11, US3-6, US4-4);
  - `NameTooLong` above "At most 60 characters after trimming", and 60 characters accepted;
  - `normalizedName(name) = name.trim().toLocaleLowerCase('fr')` with accents kept, so "Pâte" ≠ "Pâté";
  - `searchForm` removes diacritics (`NFD`, combining marks removed), so "Épicerie" → "epicerie".
- [ ] T014 Implement `validateName`, `normalizedName`, `searchForm` and the `NameError` union (`NameRequired | NameTooLong`) in `apps/mobile/src/domain/name.ts` to turn T013 green.
- [ ] T015 [P] Write failing tests for `parseQuantity(amountText, unitText)` in `apps/mobile/src/domain/quantity.test.ts`, per [data-model.md](data-model.md#quantity-value-object):
  - both blank → `null` (no quantity);
  - "1,5" and "1.5" → amount 1.5;
  - unit trimmed, and an empty unit becomes `null`;
  - "abc" → `AmountNotANumber`;
  - "0" and "-2" → `AmountNotPositive` (US2-12);
  - unit with no amount → `UnitWithoutAmount` (US2-13);
  - unit above "at most 15 characters" → `UnitTooLong`.
- [ ] T016 Implement the `Quantity` value object `{ amount: number; unit: string | null }`, `parseQuantity` and the `QuantityError` union in `apps/mobile/src/domain/quantity.ts` to turn T015 green.
- [ ] T017 [P] Define the entity types and branded ids in `apps/mobile/src/domain/category.ts` (`Category { id, name, position }`), `apps/mobile/src/domain/article.ts` (`Article { id, name, categoryId }`), `apps/mobile/src/domain/shopping-list.ts` (`ShoppingList { id, name }`) and `apps/mobile/src/domain/list-item.ts` (`ListItem { listId, articleId, inCart, quantity: Quantity | null }`). They are types only, with no behavior and so no test yet; behavior arrives test-first in the story phases.

### Ports and test doubles

- [ ] T018 Declare the driven ports exactly as in [contracts/driven-ports.md](contracts/driven-ports.md): `UnitOfWork` and `Repositories` in `apps/mobile/src/application/ports/unit-of-work.ts`; `CategoryRepository`, `ArticleRepository`, `ShoppingListRepository`, `ListItemRepository`, `AppStateRepository` in `apps/mobile/src/application/ports/repositories.ts`; `IdGenerator` in `apps/mobile/src/application/ports/id-generator.ts`; `ErrorReporter` in `apps/mobile/src/application/ports/error-reporter.ts`.
- [ ] T019 [P] Write the shared repository contract suites, as functions taking a factory that returns fresh `Repositories`, in `apps/mobile/src/application/testing/contracts/`:
  - `category-repository.contract.ts`: `all` ordered by position, `findById`, `findByNormalizedName`, `nextPosition` = max + 1 (0 when empty), `add`;
  - `article-repository.contract.ts`: `all`, `findById`, `findByNormalizedName`, `add`;
  - `shopping-list-repository.contract.ts`: `all`, `findById`, `findByNormalizedName`, `count`, `add`, `itemCounts`;
  - `list-item-repository.contract.ts`: `forList`, `find`, `save` inserts then updates, `remove`, `takeAllOutOfCart` keeps quantities;
  - `app-state-repository.contract.ts`: `currentListId` is `null` before any set, then `setCurrentListId` replaces it;
  - `unit-of-work.contract.ts`: a `run` that throws leaves no partial write.
- [ ] T020 Write `apps/mobile/src/application/testing/in-memory-repositories.test.ts`, which runs every T019 suite against the in-memory fakes. Confirm it fails because the fakes do not exist yet.
- [ ] T021 Implement the in-memory fakes in `apps/mobile/src/application/testing/in-memory-repositories.ts` (`InMemoryRepositories`, `InMemoryUnitOfWork` with snapshot-and-rollback on throw) to turn T020 green.
- [ ] T022 [P] Implement `SequentialIdGenerator` (`"id-1"`, `"id-2"`, …) in `apps/mobile/src/application/testing/sequential-id-generator.ts` and `RecordingErrorReporter` (keeps `{ error, context }` in memory) in `apps/mobile/src/application/testing/recording-error-reporter.ts`, each with a small test next to it written first.

### SQLite adapter

- [ ] T023 Define the `SqlDatabase` interface (`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync`) in `apps/mobile/src/adapters/sqlite/sql-database.ts`. Then write the `node:sqlite` (`DatabaseSync`) wrapper implementing it in `apps/mobile/test/sqlite/node-sql-database.ts`, using in-memory databases and running under `@jest-environment node`. If Jest cannot load `node:sqlite`, use `better-sqlite3` as a dev dependency behind the same wrapper ([research.md](research.md) R4).
- [ ] T024 Write failing migration tests in `apps/mobile/src/adapters/sqlite/migrations.test.ts`:
  - migration 1 creates the tables `category`, `article`, `shopping_list`, `list_item` and `app_state`, and the index `list_item_article`, exactly as in [data-model.md](data-model.md#sqlite-schema-migration-1);
  - `PRAGMA user_version` becomes 1, and running the migrations again is a no-op;
  - the migration runs in one transaction;
  - foreign constraints are enforced on open;
  - the constraints reject a 61-character name, a duplicate `normalized_name`, `quantity_amount <= 0`, a unit without an amount, and a second `app_state` row.
- [ ] T025 Implement `migrate(db)` and migration 1 in `apps/mobile/src/adapters/sqlite/migrations.ts` to turn T024 green.
- [ ] T026 Write `apps/mobile/src/adapters/sqlite/sqlite-repositories.test.ts`, which runs every T019 suite against the SQLite repositories on a migrated `node:sqlite` database. Confirm it fails.
- [ ] T027 Implement the SQLite repositories in `apps/mobile/src/adapters/sqlite/`: `category-repository.ts`, `article-repository.ts`, `shopping-list-repository.ts`, `list-item-repository.ts` (`quantity_amount` / `quantity_unit` ↔ `Quantity | null`, `in_cart` 0/1 ↔ boolean) and `app-state-repository.ts`. Implement `SqliteUnitOfWork` (`withTransactionAsync`) in `apps/mobile/src/adapters/sqlite/unit-of-work.ts`. All of them turn T026 green.
- [ ] T028 Add `openDatabase()` in `apps/mobile/src/adapters/sqlite/open-database.ts`: it opens the expo-sqlite database `mes-courses.db`, enforces foreign constraints and runs `migrate`. It is thin wiring over expo-sqlite, which does not load in Jest: the composition test (T053) covers the same steps on `node:sqlite`, and quickstart step 5 covers the real binding on a device.

### Startup seed

- [ ] T029 Write failing tests for `initializeStore` in `apps/mobile/src/application/use-cases/initialize-store.test.ts`, on fakes:
  - on an empty store it creates the given categories with positions 0..n-1 in order, then the first list, and makes it current (US3-1, US4-1);
  - on a store that already has a list it does nothing;
  - a failure midway leaves nothing behind (one transaction).
- [ ] T030 Implement `initializeStore(seed: { categoryNames; firstListName })` in `apps/mobile/src/application/use-cases/initialize-store.ts` to turn T029 green.

### Error reporting and ids

- [ ] T031 [P] Write failing tests for the Sentry reporter in `apps/mobile/src/adapters/error-reporting/sentry-error-reporter.test.ts`, with `@sentry/react-native` mocked:
  - `init` is called with `sendDefaultPii: false`, the DSN, the release and the environment;
  - `beforeSend` / `beforeBreadcrumb` drop breadcrumb messages and request data;
  - `report(error, { operation, screen })` calls `captureException` with only those tags;
  - `report` never throws, even when the SDK throws.
- [ ] T032 [P] Implement `createSentryErrorReporter` in `apps/mobile/src/adapters/error-reporting/sentry-error-reporter.ts` and `ConsoleErrorReporter` in `apps/mobile/src/adapters/error-reporting/console-error-reporter.ts` (the console one is also written test-first) to turn T031 green.
- [ ] T033 [P] Implement `CryptoIdGenerator` (`expo-crypto` `randomUUID()`) in `apps/mobile/src/adapters/id/crypto-id-generator.ts`, with a test that mocks `expo-crypto` and checks `next()` returns its value.

### Design system foundations (Principle V)

- [ ] T034 Write failing tests in `apps/mobile/src/adapters/ui/theme/theme.test.ts`:
  - every MD3 color role of the light and dark Paper themes equals the matching role of `schemes.light` and `schemes.dark` in `design/material-theme.json`;
  - `elevation.level0..5` derive from `surfaceContainerLowest..Highest`;
  - the contrast variants are mapped;
  - the `spacing` tokens are `xs = 4` … `xl = 32` on the 4 dp grid.
- [ ] T035 Implement the light and dark themes from the JSON in `apps/mobile/src/adapters/ui/theme/theme.ts` and the `spacing` tokens in `apps/mobile/src/adapters/ui/theme/spacing.ts`, and add `ThemeProvider` (follows `useColorScheme`, wraps `PaperProvider`) in `apps/mobile/src/adapters/ui/theme/theme-provider.tsx`, to turn T034 green.
- [ ] T036 [P] Write failing component tests in `apps/mobile/src/adapters/ui/components/screen-state.test.tsx`:
  - `LoadingState` has the accessibility label "Chargement";
  - `EmptyState` shows its message and optional action button;
  - `ErrorState` shows its message and a "Réessayer" button that calls `onRetry`;
  - `ScreenStateView` renders exactly one of the three, or the success renderer, for each `ScreenState` status.
- [ ] T037 [P] Implement `LoadingState.tsx`, `EmptyState.tsx`, `ErrorState.tsx` and `ScreenStateView.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T036 green.
- [ ] T038 [P] Write failing tests for `formatQuantity` in `apps/mobile/src/adapters/ui/components/format-quantity.test.ts`: `{1.5, "kg"}` → "1,5 kg", `{6, null}` → "6", `{2, "L"}` → "2 L".
- [ ] T039 [P] Implement `formatQuantity` with `Intl.NumberFormat('fr-FR')` in `apps/mobile/src/adapters/ui/components/format-quantity.ts` to turn T038 green.

### Application store core ([002 ui-state contract](../002-manage-articles/contracts/ui-state.md))

- [ ] T040 Write failing store-core tests in `apps/mobile/src/adapters/ui/state/app-store.test.ts`, on a store built by `createAppStore({ useCases, errorReporter })` with use cases on in-memory fakes and a `RecordingErrorReporter`:
  - every region starts `idle`;
  - `notice` starts `null`, and `dismissNotice()` clears it;
  - `pendingUndo` starts `null`.
- [ ] T041 Implement `createAppStore` with `createStore` from `zustand/vanilla` and the `AppState`, `ScreenState<T, E>` (`idle | loading | error | empty | success`) and `Notice` types in `apps/mobile/src/adapters/ui/state/app-store.ts`, to turn T040 green. Use no middleware.
- [ ] T042 Write failing tests in `apps/mobile/src/adapters/ui/state/app-store.write-rules.test.ts` for the shared write rules, through a test-only write action:
  - a write clears `pendingUndo` before it starts;
  - after success, `refresh()` reloads every region that is not `idle`, keeping `success` / `empty` data on screen while it reloads;
  - an unexpected throw is reported with `{ operation, screen }` only, sets `notice = { type: 'writeFailed' }`, leaves state unchanged and resolves to `{ ok: false, error: { type: 'WriteFailed' } }`;
  - a `Result` error is returned unchanged and not reported.
- [ ] T043 Implement the internal `runWrite` helper and `refresh()` in `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T042 green.
- [ ] T044 Implement `AppStoreProvider` (React context) in `apps/mobile/src/adapters/ui/state/app-store-provider.tsx` and `useAppStore(selector)` (wraps `useStore`) in `apps/mobile/src/adapters/ui/state/use-app-store.ts`, with a test rendering a component that selects a slice. Add the `renderWithStore(ui, { seed? })` helper in `apps/mobile/src/adapters/ui/testing/render-with-store.tsx`: it builds fresh fakes, use cases, store, theme and navigation container for each test.
- [ ] T045 [P] Write failing tests for `NoticeSnackbar` in `apps/mobile/src/adapters/ui/components/notice-snackbar.test.tsx`: `writeFailed` shows "La modification n'a pas pu être enregistrée.", `articleAdded` shows "« {name} » ajouté", and dismissing calls `dismissNotice`.
- [ ] T046 [P] Implement `NoticeSnackbar.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T045 green.

### App shell and composition

- [ ] T047 Add the French seed in `apps/mobile/src/adapters/ui/seed.ts`: `categoryNames` = Fruits et légumes, Boucherie et poissonnerie, Crèmerie, Boulangerie, Épicerie salée, Épicerie sucrée, Surgelés, Boissons, Hygiène et beauté, Entretien, Divers (this order), and `firstListName` = "Ma liste". Test that the order matches the spec's Assumptions.
- [ ] T048 Write a failing test in `apps/mobile/src/adapters/ui/navigation.test.tsx`: through `renderWithStore`, the initial route is `CurrentList` and a `notice` set in the store shows in the root `NoticeSnackbar`. Then add the navigation in `apps/mobile/src/adapters/ui/navigation.tsx` (React Navigation 7 native stack): `CurrentList` (initial), `Lists`, `AddArticles` and `CreateArticle` as typed placeholder screens, replaced in the story phases, and `NoticeSnackbar` rendered once at the root.
- [ ] T049 Add `apps/mobile/src/adapters/ui/use-cases.ts`, the `UseCases` type the store depends on: one entry per use case in [contracts/driving-ports.md](contracts/driving-ports.md), filled in story by story.
- [ ] T050 Implement the composition root in `apps/mobile/src/composition/composition-root.ts`:
  - `openDatabase()`, then the SQLite `UnitOfWork`, `CryptoIdGenerator` and the error reporter (Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set, console otherwise);
  - build the use cases, run `initializeStore(seed)`, then `createAppStore`.

  It is the only module that knows every adapter.
- [ ] T051 Write a failing test in `App.test.tsx` with the composition root mocked: `LoadingState` while it initializes, then CurrentList; `ErrorState` and one report when it throws. Then wire `apps/mobile/App.tsx` to call the composition root once and render `ThemeProvider` → `AppStoreProvider` → `SafeAreaProvider` → navigation, with `LoadingState` while the root initializes and `ErrorState` (reported) if initialization throws.
- [ ] T052 [P] Add the `apps/mobile/jest.setup.ts` global mocks needed by `jest-expo` (`@sentry/react-native`, `expo-sqlite` never loaded in UI tests), referenced from `apps/mobile/jest.config.js`.
- [ ] T053 Write a composition test in `apps/mobile/src/composition/composition-root.test.ts` with `openDatabase` replaced by a `node:sqlite` database: a fresh start seeds 11 categories and "Ma liste" as current, and a second start does not seed again.

**Checkpoint**: the app launches on a seeded store and shows the CurrentList placeholder; every test, the architecture test and the bundle pass.

---

## Phase 3: User Story 1 - Tick items off the current list while shopping (Priority: P1) 🎯 MVP

**Goal**: the app opens on the current list, grouped by category, with quantities; tap to tick or
untick at once; the remaining count; "Terminer les courses"; explicit loading, empty and error
states; works offline.

**Independent Test**: seed a current list with a few items (fakes in tests, or the dev seed of
T112 on a device). Open the app, tick and untick, kill and reopen, check the ticks were kept, then
finish shopping and check every item is unticked and still present.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [ ] T054 [P] [US1] Write failing domain tests for the current list view in `apps/mobile/src/domain/current-list-view.test.ts`:
  - sections only for categories holding an item of the list, ordered by `position` (FR-003, US4-5);
  - within a section, unticked items first, then ticked, each group sorted with `Intl.Collator('fr', { sensitivity: 'base' })` (US1-6);
  - `remainingCount` = unticked items (US1-7: 5 items with 2 ticked → 3);
  - `totalCount`, and `hasItemsInCart`.
- [ ] T055 [P] [US1] Write failing domain tests for the list item transitions in `apps/mobile/src/domain/list-item.test.ts`:
  - `toggle` flips `inCart` (US1-2, US1-3);
  - `finish` sets every `inCart = false` and keeps quantities and items (US1-8);
  - `finish` on a list with nothing in the cart → `NothingInCart`.
- [ ] T056 [P] [US1] Write failing use case tests on fakes:
  - `apps/mobile/src/application/use-cases/get-current-list.test.ts`: it returns the `CurrentListView` of the current list (US1-1);
  - `apps/mobile/src/application/use-cases/toggle-item-in-cart.test.ts`: it flips and persists (US1-4), and returns `ItemNotOnList` for an unknown item;
  - `apps/mobile/src/application/use-cases/finish-shopping.test.ts`: it unticks all and keeps quantities (US1-8), and returns `NothingInCart` with no change.
- [ ] T057 [P] [US1] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.current-list.test.ts`:
  - `loadCurrentList()` goes `loading` → `success` / `empty`, and on a throw goes `error` and reports `{ operation: 'getCurrentList', screen: 'CurrentList' }` (US1-12);
  - `toggleItem` updates the region immediately (optimistic) before the use case resolves, then keeps it (US1-2, US1-3);
  - a failed toggle reverts the item, sets `notice = writeFailed` and reports (edge case "storage fails");
  - `finishShopping` refreshes the list.
- [ ] T058 [P] [US1] Write failing component tests for `ListItemRow` in `apps/mobile/src/adapters/ui/components/list-item-row.test.tsx`:
  - role `checkbox` with the `checked` state;
  - the label "Lait, 2 L, dans le caddie" or "Pommes, pas dans le caddie" (FR-032);
  - a ticked row shows a check mark and struck-through text, not only a color (FR-035);
  - the row has `minHeight` 48 (FR-034);
  - the name has no `numberOfLines`, so long names wrap (FR-033);
  - tapping calls `onToggle`.
- [ ] T059 [US1] Write failing screen tests for `CurrentList` in `apps/mobile/src/adapters/ui/screens/current-list-screen.test.tsx`, through `renderWithStore`:
  - US1-1: the list name is in the Appbar, items sit under category headings, and "Lait" shows "2 L";
  - US1-2 / US1-3: tapping ticks and unticks immediately;
  - US1-6: ticked items move after unticked ones;
  - US1-7: the subtitle reads "3 articles restants", "1 article restant", or "Tout est dans le caddie";
  - US1-10: "Votre liste est vide" with "Ajouter des articles";
  - US1-11: `LoadingState` shows while the use case is pending;
  - US1-12: "Impossible de charger la liste." with "Réessayer" retrying, and the error reported;
  - US4-5: an empty category heading is not shown;
  - "Terminer les courses" is absent when nothing is ticked.
- [ ] T060 [US1] Write failing tests for finishing in `apps/mobile/src/adapters/ui/screens/finish-shopping-dialog.test.tsx`:
  - the dialog text is "Terminer les courses ?" / "Tous les articles seront décochés et resteront dans la liste.";
  - US1-8: "Terminer" unticks all, and items and quantities stay;
  - US1-9: "Annuler" changes nothing.
- [ ] T061 [US1] Write a failing offline test for US1-5 in `apps/mobile/src/adapters/ui/screens/current-list-offline.test.tsx`: with `global.fetch` replaced by a function that throws, open the app and tick items. Everything works and no error is shown or reported.

### Implementation for User Story 1

- [ ] T062 [P] [US1] Implement `buildCurrentListView` in `apps/mobile/src/domain/current-list-view.ts` to turn T054 green.
- [ ] T063 [P] [US1] Implement `toggle` and `finish` with the `ItemNotOnList` and `NothingInCart` errors in `apps/mobile/src/domain/list-item.ts` to turn T055 green.
- [ ] T064 [US1] Implement `getCurrentList`, `toggleItemInCart` and `finishShopping` in `apps/mobile/src/application/use-cases/get-current-list.ts`, `toggle-item-in-cart.ts` and `finish-shopping.ts`, per [contracts/driving-ports.md](contracts/driving-ports.md#current-list-user-story-1), to turn T056 green. Add them to `UseCases` (`apps/mobile/src/adapters/ui/use-cases.ts`) and to the composition root.
- [ ] T065 [US1] Add the `currentList` region and the `loadCurrentList`, `toggleItem` (optimistic, revert on failure) and `finishShopping` actions to `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T057 green.
- [ ] T066 [P] [US1] Implement `ListItemRow.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T058 green. Leave the trailing action slots empty for now; US2 fills them.
- [ ] T067 [US1] Implement `CurrentListScreen.tsx` in `apps/mobile/src/adapters/ui/screens/`:
  - a `SectionList` with one section per category, memoized rows identified by article id ([research.md](research.md) R11);
  - Appbar title and subtitle;
  - the "Terminer les courses" action, shown only when `hasItemsInCart`;
  - the "Mes listes" action and the FAB "Ajouter", wired to placeholder routes;
  - `ScreenStateView` for the states.

  Replace the placeholder in `navigation.tsx`. It turns T059 and T061 green.
- [ ] T068 [US1] Implement `FinishShoppingDialog.tsx` in `apps/mobile/src/adapters/ui/screens/` (Paper `Dialog` in a `Portal`) and open it from CurrentList, to turn T060 green.

**Checkpoint**: on a device with items seeded by the dev seed (T112) or by US2, US1 works end to end, offline included. This is the first half of the MVP.

---

## Phase 4: User Story 2 - Add and remove items on a list, with an optional quantity (Priority: P1)

**Goal**: browse or search the catalog, add with an optional quantity, create an article on the
spot, mark articles already on the list, change or clear a quantity, remove with a 5-second
"Annuler".

**Independent Test**: from an empty current list, add existing articles with and without a
quantity, create a new article, change a quantity, remove one item and undo, and check the list
content matches.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [ ] T069 [P] [US2] Write failing domain tests for the catalog view in `apps/mobile/src/domain/catalog-view.test.ts`:
  - without a query: every category ordered by `position`, including empty ones (US2-15);
  - with a query: only articles whose `searchForm(name)` contains `searchForm(query)`, so "pom" finds "Pommes" and "Pommes de terre" and "POM" finds them too, ignoring case and accents (FR-009, US2-10);
  - empty categories are omitted under a query, and no section at all means no match (US2-14);
  - `onList` and the target-list `quantity` are set for articles already on the list (US2-8);
  - articles are sorted by name with the French collator.
- [ ] T070 [P] [US2] Write failing domain tests for adding to a list in `apps/mobile/src/domain/list-item.test.ts`:
  - `add` creates an unticked item (FR-012) with the given quantity or none (US2-1, US2-2);
  - adding an article already on the list → `AlreadyOnList` carrying the current quantity (FR-011);
  - `changeQuantity` keeps `inCart` and sets or clears the quantity (US2-3, US2-4).
- [ ] T071 [P] [US2] Write failing use case tests on fakes, one file each in `apps/mobile/src/application/use-cases/`:
  - `get-catalog.test.ts`: the catalog with `onList` marks for the given list, filtered by query;
  - `add-article-to-list.test.ts`: US2-1; US2-2; US2-5, the same article on two lists keeps a quantity per list; `AlreadyOnList`; `ArticleNotFound`;
  - `create-article-and-add-to-list.test.ts`: US2-7, created and added in one transaction; US2-9, " beurre " → `NameAlreadyUsed` with `existing` = "Beurre" and nothing created; US2-11, `NameRequired`; `NameTooLong`; `CategoryNotFound`;
  - `change-item-quantity.test.ts`: US2-3, the article itself is unchanged; US2-4, cleared; `ItemNotOnList`;
  - `remove-item-from-list.test.ts`: US2-6, the item is gone, the article stays in the catalog, and a `RemovedItem` is returned;
  - `restore-removed-item.test.ts`: US2-16, back ticked with "2 kg"; `AlreadyOnList` / `ListNotFound` / `ArticleNotFound`;
  - `get-categories.test.ts`: ordered by `position`.
- [ ] T072 [P] [US2] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.edit-list.test.ts`:
  - `searchCatalog(query)` sets `catalog.query` and loads `catalog.view` with the region states, reporting `{ operation: 'getCatalog', screen: 'AddArticles' }` on failure;
  - `addArticleToList` and `createArticleAndAddToList` return their `Result`, refresh, and set `notice = { type: 'articleAdded', name }` on success;
  - `changeItemQuantity` refreshes;
  - `removeItem` sets `pendingUndo = { kind: 'removedItem', removed, name }`;
  - `undo()` clears `pendingUndo`, restores and refreshes; on failure the item stays removed, `notice = writeFailed`, and the error is reported;
  - `dismissUndo()` clears the offer;
  - any write clears a pending offer first;
  - a new removal replaces the previous offer.
- [ ] T073 [P] [US2] Write failing component tests:
  - `apps/mobile/src/adapters/ui/components/article-row.test.tsx`: the "Déjà dans la liste" chip appears only when `onList`, and the row is ≥ 48 dp;
  - `apps/mobile/src/adapters/ui/components/quantity-fields.test.tsx`: the labels "Quantité" and "Unité", a decimal numeric input mode, and `HelperText` errors;
  - `apps/mobile/src/adapters/ui/components/name-field.test.tsx`: the label "Nom", a 60-character limit, and a `HelperText` error.
- [ ] T074 [P] [US2] Write failing tests for `UndoSnackbar` in `apps/mobile/src/adapters/ui/components/undo-snackbar.test.tsx`:
  - `removedItem` shows "« {name} » retiré de la liste" with "Annuler" calling `undo`;
  - it calls `dismissUndo` after 5 s (Jest fake timers);
  - it stays visible across navigation, because it is rendered at the root.
- [ ] T075 [US2] Write failing tests for `QuantityDialog` in `apps/mobile/src/adapters/ui/screens/quantity-dialog.test.tsx`:
  - add mode: "Ajouter" with empty fields adds without a quantity (SC-003);
  - FR-016 errors: "La quantité doit être un nombre positif." for "0", "-1" and "abc" (US2-12); "Indiquez une quantité pour cette unité." (US2-13); "L'unité ne peut pas dépasser 15 caractères.";
  - "1.5" + "kg" is shown as "1,5 kg" on the list (US2-2);
  - already-on-list mode: "« {name} » est déjà dans la liste." with the fields prefilled and the buttons "Fermer" and "Modifier la quantité" (US2-8);
  - edit mode: "Effacer la quantité" (US2-4).
- [ ] T076 [US2] Write failing screen tests for `AddArticles` in `apps/mobile/src/adapters/ui/screens/add-articles-screen.test.tsx`:
  - Appbar "Ajouter des articles" and the Searchbar placeholder "Rechercher un article";
  - US2-15: an empty category shows "Aucun article dans cette catégorie" with "Créer un article";
  - US2-10: search results grouped by category;
  - US2-14: "Aucun article ne correspond à « xyz »" with "Créer « xyz »";
  - US2-8: the "Déjà dans la liste" mark, and tapping opens already-on-list mode without duplicating;
  - adding keeps the screen open and shows "« {name} » ajouté";
  - loading;
  - error "Impossible de charger les articles." with "Réessayer", reported;
  - the "Nouvel article" action opens CreateArticle with the query prefilled.
- [ ] T077 [US2] Write failing screen tests for `CreateArticle` in `apps/mobile/src/adapters/ui/screens/create-article-screen.test.tsx`:
  - Appbar "Nouvel article";
  - the "Nom" field, the category radio list from `getCategories`, the optional quantity, and "Créer et ajouter";
  - US2-7: "Houmous" + "Épicerie salée" is created and added, the screen goes back to AddArticles, and the snackbar shows "« Houmous » ajouté";
  - US2-11: "Indiquez un nom.";
  - "Le nom ne peut pas dépasser 60 caractères.";
  - US2-9: "« Beurre » existe déjà." with "Ajouter « Beurre »" adding the existing article;
  - "Choisissez une catégorie." when no category is chosen.
- [ ] T078 [US2] Extend `apps/mobile/src/adapters/ui/screens/current-list-screen.test.tsx` with failing tests:
  - the row action and accessibility action "Modifier la quantité" opens QuantityDialog prefilled, and saving shows the new quantity (US2-3, US2-4);
  - "Retirer de la liste" removes at once and shows "« Beurre » retiré de la liste" with "Annuler" (US2-6);
  - "Annuler" restores the item ticked with "2 kg" (US2-16);
  - after 5 s the offer is gone;
  - the FAB "Ajouter" opens AddArticles, and coming back shows the added items.

### Implementation for User Story 2

- [ ] T079 [P] [US2] Implement `buildCatalogView` in `apps/mobile/src/domain/catalog-view.ts` to turn T069 green.
- [ ] T080 [P] [US2] Implement `add` and `changeQuantity` with the `AlreadyOnList` error in `apps/mobile/src/domain/list-item.ts` to turn T070 green.
- [ ] T081 [US2] Implement the use cases in `apps/mobile/src/application/use-cases/` to turn T071 green, per [contracts/driving-ports.md](contracts/driving-ports.md#editing-a-list-user-story-2): `get-catalog.ts`, `add-article-to-list.ts`, `create-article-and-add-to-list.ts`, `change-item-quantity.ts`, `remove-item-from-list.ts`, `restore-removed-item.ts`, `get-categories.ts`. Every write runs in `UnitOfWork.run`. Add them to `UseCases` and to the composition root.
- [ ] T082 [US2] Add the `catalog` region and the `searchCatalog`, `addArticleToList`, `createArticleAndAddToList`, `changeItemQuantity`, `removeItem`, `undo` and `dismissUndo` actions to `apps/mobile/src/adapters/ui/state/app-store.ts`, to turn T072 green.
- [ ] T083 [P] [US2] Implement `ArticleRow.tsx`, `QuantityFields.tsx` and `NameField.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T073 green.
- [ ] T084 [P] [US2] Implement `UndoSnackbar.tsx` in `apps/mobile/src/adapters/ui/components/` and render it once at the root in `apps/mobile/src/adapters/ui/navigation.tsx`, to turn T074 green.
- [ ] T085 [US2] Implement `QuantityDialog.tsx` in `apps/mobile/src/adapters/ui/screens/`, with modes add / already-on-list / edit, parsing through the domain's `parseQuantity`, to turn T075 green.
- [ ] T086 [US2] Implement `AddArticlesScreen.tsx` in `apps/mobile/src/adapters/ui/screens/` and replace its placeholder in `navigation.tsx`, to turn T076 green.
- [ ] T087 [US2] Implement `CreateArticleScreen.tsx` in `apps/mobile/src/adapters/ui/screens/`, validating the name through the domain's `validateName` before submitting. The category picker lists categories only; "Nouvelle catégorie" comes with US4. Replace the placeholder in `navigation.tsx`. It turns T077 green.
- [ ] T088 [US2] Fill the trailing actions and accessibility actions of `ListItemRow` ("Modifier la quantité", "Retirer de la liste") and wire them in `CurrentListScreen.tsx` to turn T078 green.

**Checkpoint**: US1 and US2 together form the MVP: a usable single-list app, offline, with
undo.

---

## Phase 5: User Story 3 - Manage several named lists and choose the current one (Priority: P2)

**Goal**: create named lists, see them with item counts and the current mark, and switch the
current list in 2 taps; the choice survives restarts.

**Independent Test**: create "Barbecue", make it current, add items and tick one, switch back and
check the first list is untouched, then reopen the app and check "Barbecue" is shown if it was
current.

### Tests for User Story 3 ⚠️ (write first, confirm they fail)

- [ ] T089 [P] [US3] Write failing use case tests on fakes in `apps/mobile/src/application/use-cases/`:
  - `get-lists.test.ts`: lists sorted by name with the French collator, each with `itemCount` and `isCurrent` (US3-8);
  - `create-list.test.ts`:
    - US3-2: an empty list is created and is not made current;
    - US3-5: "barbecue" → `NameAlreadyUsed`;
    - US3-6: `NameRequired`;
    - `NameTooLong`;
  - `set-current-list.test.ts`: US3-3, persisted across a new store instance on the same fakes; `ListNotFound`;
  - FR-026 / US3-4: ticking "Lait" on one list leaves it unticked on another.
- [ ] T090 [P] [US3] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.lists.test.ts`:
  - `loadLists()` uses the region states and reports `{ operation: 'getLists', screen: 'Lists' }` on failure (US3-7);
  - `createList` returns its `Result` and refreshes;
  - `setCurrentList` refreshes, so `currentList` shows the new list.
- [ ] T091 [US3] Write failing screen tests in `apps/mobile/src/adapters/ui/screens/lists-screen.test.tsx`:
  - Appbar "Mes listes";
  - US3-7: loading; the error "Impossible de charger vos listes." with "Réessayer", reported;
  - US3-8: rows show the name, "{n} articles" / "1 article", and "Liste actuelle" with a check icon and text;
  - row accessibility: "Barbecue, 0 articles, liste actuelle";
  - US3-3: tapping a list makes it current and returns to CurrentList, which shows "Barbecue";
  - SC-005: two taps from CurrentList ("Mes listes", then the list).
- [ ] T092 [US3] Write failing dialog tests in `apps/mobile/src/adapters/ui/screens/create-list-dialog.test.tsx`:
  - title "Nouvelle liste", buttons "Annuler" / "Créer";
  - US3-2: the list appears empty in Lists;
  - US3-5: "Une liste porte déjà ce nom.";
  - US3-6: "Indiquez un nom.".

### Implementation for User Story 3

- [ ] T093 [US3] Implement `get-lists.ts`, `create-list.ts` and `set-current-list.ts` in `apps/mobile/src/application/use-cases/` to turn T089 green, per [contracts/driving-ports.md](contracts/driving-ports.md#named-lists-user-story-3). Add them to `UseCases` and to the composition root.
- [ ] T094 [US3] Add the `lists` region and the `loadLists`, `createList` and `setCurrentList` actions to `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T090 green.
- [ ] T095 [US3] Implement `ListsScreen.tsx` (with the FAB "Nouvelle liste") in `apps/mobile/src/adapters/ui/screens/` and replace its placeholder in `navigation.tsx`, to turn T091 green.
- [ ] T096 [US3] Implement `CreateListDialog.tsx` in `apps/mobile/src/adapters/ui/screens/` to turn T092 green.

**Checkpoint**: several lists, each with its own items and ticks; the current list survives a
restart.

---

## Phase 6: User Story 4 - Organize articles in categories (Priority: P3)

**Goal**: the default categories exist from the first launch; users create their own categories
from the article form and pick them.

**Independent Test**: on a fresh install, check the default categories exist. Create a category,
create an article in it, add it to the current list, and check it appears under the new heading.

### Tests for User Story 4 ⚠️ (write first, confirm they fail)

- [ ] T097 [P] [US4] Write failing use case tests in `apps/mobile/src/application/use-cases/create-category.test.ts`:
  - US4-2: the category is appended with `position = max + 1` and `getCategories` lists it last;
  - US4-3: "boissons" → `NameAlreadyUsed`;
  - US4-4: `NameRequired`;
  - `NameTooLong`.
- [ ] T098 [P] [US4] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.categories.test.ts`: `createCategory` returns its `Result` (with `categoryId`) and refreshes.
- [ ] T099 [US4] Write failing dialog tests in `apps/mobile/src/adapters/ui/screens/create-category-dialog.test.tsx`:
  - title "Nouvelle catégorie", buttons "Annuler" / "Créer";
  - US4-3: "Cette catégorie existe déjà.";
  - US4-4: "Indiquez un nom.".
- [ ] T100 [US4] Extend `apps/mobile/src/adapters/ui/screens/create-article-screen.test.tsx` with failing tests:
  - US4-1: the 11 default categories are offered in the spec's order;
  - US4-2: "Nouvelle catégorie" opens CreateCategoryDialog, and on success "Bébé" is offered and preselected;
  - an article created in "Bébé" and added appears under a "Bébé" heading on CurrentList.

### Implementation for User Story 4

- [ ] T101 [US4] Implement `create-category.ts` in `apps/mobile/src/application/use-cases/` to turn T097 green, and add it to `UseCases` and to the composition root.
- [ ] T102 [US4] Add the `createCategory` action to `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T098 green.
- [ ] T103 [US4] Implement `CreateCategoryDialog.tsx` in `apps/mobile/src/adapters/ui/screens/` to turn T099 green.
- [ ] T104 [US4] Add the "Nouvelle catégorie" entry to the category picker of `CreateArticleScreen.tsx` and preselect the new category, to turn T100 green.

**Checkpoint**: all four stories work independently and together.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: the full offline scenario, development hooks, documentation and the device
validation of [quickstart.md](quickstart.md).

- [ ] T105 Write the full offline UI scenario in `apps/mobile/src/adapters/ui/offline.test.tsx`: with `global.fetch` replaced by a function that throws, open, tick, add, create, change the quantity, remove and undo, switch list, and finish. Every step succeeds and nothing is reported (Principle VII, FR-027, SC-006). Make it green with no production change; any change it forces gets its own failing test first.
- [ ] T106 [P] Write a test in `apps/mobile/src/adapters/ui/screens/current-list-screen.test.tsx` that renders a 200-item list through `renderWithStore`, ticks the last item, and checks that only that row re-renders (memoized rows identified by article id, [research.md](research.md) R11, SC-008). If it fails, fix the memoization in `ListItemRow.tsx` and `CurrentListScreen.tsx`.
- [ ] T107 [P] Extend `apps/mobile/src/adapters/ui/components/list-item-row.test.tsx` to render a ticked row under the dark theme and each contrast variant of T035: the check mark and the struck-through text are present in every theme, not only a color change (FR-035).
- [ ] T108 [P] Write a test in `apps/mobile/src/adapters/ui/state/error-context.test.ts` that every `report` call made during the US1–US4 store tests carries only the `operation` and `screen` fields, never names or quantities (FR-030, Principle VIII).
- [ ] T109 [P] Write accessibility tests in `apps/mobile/src/adapters/ui/screens/accessibility.test.tsx`: every interactive element on the four screens and four dialogs has a French `accessibilityLabel` or a visible French text (FR-032), and every touch target is ≥ 48 dp (FR-034).
- [ ] T110 Add the dev-only Sentry smoke test to `apps/mobile/src/composition/composition-root.ts`: when `EXPO_PUBLIC_SENTRY_SMOKE_TEST=1`, report one test error at startup. Test-first in `apps/mobile/src/composition/composition-root.test.ts`, including that it is ignored when the flag is unset.
- [ ] T111 [P] Configure the Sentry Expo plugin options (organization, project, source map upload through EAS Build) in `apps/mobile/app.config.ts` and document in `README.md` the EAS environment variables the maintainer sets: the DSN and the build credential, never committed.
- [ ] T112 Add the dev-only seed to `apps/mobile/src/composition/dev-seed.ts`: when `EXPO_PUBLIC_DEV_SEED_ITEMS=<n>` and `__DEV__`, fill an empty current list with n articles through the use cases. Test-first in `apps/mobile/src/composition/dev-seed.test.ts`: ignored when `__DEV__` is false or the list is not empty.
- [ ] T113 Update `README.md` with what the app does, the architecture in one paragraph (hexagonal layers, Zustand store in the UI adapter), how to run the device checks of [quickstart.md](quickstart.md), and the dev flags `EXPO_PUBLIC_DEV_SEED_ITEMS` and `EXPO_PUBLIC_SENTRY_SMOKE_TEST`.
- [ ] T114 Run [quickstart.md](quickstart.md) sections 1–5 on an Android device or emulator and on an iOS simulator: the 12 hands-on scenarios, including airplane mode, kill and restart, TalkBack/VoiceOver, 200% text, 200 items and start time on a release build. Record the results, and anything not checked, in the pull request's test plan.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T004 must land before any commit that contains `flake.lock` or `yarn.lock`.
- **Foundational (Phase 2)**: depends on Setup. It blocks every user story. Inside it:
  - domain (T011–T017) → ports (T018) → contract suites and fakes (T019–T022) → SQLite (T023–T028) → seed (T029–T030);
  - theme and shared components (T034–T039) can run beside the SQLite work;
  - the store core (T040–T046) needs the fakes;
  - the composition (T047–T053) comes last.
- **US1 (Phase 3)** and **US2 (Phase 4)**: both start after Foundational. US2's T078 and T088 extend the CurrentList screen built in US1, so finish T067 first.
- **US3 (Phase 5)**: after Foundational. SC-005's two-tap test (T091) needs the "Mes listes" action of T067.
- **US4 (Phase 6)**: after US2, because it extends `CreateArticleScreen` (T087).
- **Polish (Phase 7)**: after the stories it covers. T105 needs all four.

### Within Each User Story

- Tests first; run them and see them fail (Red) before the matching implementation task.
- Then domain → use cases → store actions → components → screens.
- Each Green step is followed by a refactor with the suite green, and a commit.

### Parallel Opportunities

- Setup: T006, T007 and T008 touch different config files.
- Foundational:
  - T011 / T013 / T015 and their implementations, three domain files;
  - T031–T033 (error reporting, ids);
  - T034–T039 (theme, state components, `formatQuantity`);
  - T045–T046 (`NoticeSnackbar`), once the store core exists.
- US1: T054–T058 are five independent test files; T062, T063 and T066 in parallel after them.
- US2: T069–T074 are independent test files; T079, T080, T083 and T084 in parallel after them.
- US3 and US4 test files (T089, T090, T097, T098) can be written in parallel.

---

## Parallel Example: User Story 1

```bash
# Red: write these failing tests together (different files)
Task: "T054 current list view tests in apps/mobile/src/domain/current-list-view.test.ts"
Task: "T055 list item transition tests in apps/mobile/src/domain/list-item.test.ts"
Task: "T056 use case tests in apps/mobile/src/application/use-cases/{get-current-list,toggle-item-in-cart,finish-shopping}.test.ts"
Task: "T057 store tests in apps/mobile/src/adapters/ui/state/app-store.current-list.test.ts"
Task: "T058 ListItemRow tests in apps/mobile/src/adapters/ui/components/list-item-row.test.tsx"

# Green: then these in parallel
Task: "T062 buildCurrentListView in apps/mobile/src/domain/current-list-view.ts"
Task: "T063 toggle and finish in apps/mobile/src/domain/list-item.ts"
Task: "T066 ListItemRow in apps/mobile/src/adapters/ui/components/ListItemRow.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T069 catalog view tests in apps/mobile/src/domain/catalog-view.test.ts"
Task: "T071 use case tests in apps/mobile/src/application/use-cases/*.test.ts"
Task: "T073 ArticleRow / QuantityFields / NameField tests"
Task: "T074 UndoSnackbar tests in apps/mobile/src/adapters/ui/components/undo-snackbar.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Phase 1: Setup, merged with CI green before any application code.
2. Phase 2: Foundational. The app launches on a seeded, empty "Ma liste".
3. Phase 3: US1. Ticking works on seeded data.
4. Phase 4: US2. The list can be filled, so the app is usable on a device.
5. **Stop and validate**: quickstart steps 1–7 and 10 on a device.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 → MVP (single list).
3. US3 → several lists.
4. US4 → custom categories.
5. Polish → full offline scenario, dev hooks, README, device validation.

Each increment is one or more pull requests, merged only when `gh pr checks` is all green
(constitution, Quality Gates).

### Handover to 002

002 ([plan](../002-manage-articles/plan.md#implementation-notes-for-speckit-tasks)) builds on this
store and adds `editArticle`, `deleteArticle`, the `deletedArticle` undo and the `CategoryPicker`
extracted from `CreateArticleScreen`.

---

## Notes

- [P] tasks touch different files and depend on no unfinished task.
- The [Story] label maps each task to its user story for traceability.
- Never delete, skip or weaken a test to make a change pass (Principle I).
- A flaky test is a failing test: fix it before anything else (Principle III).
- Commit after each Green + Refactor step, with Conventional Commits.
