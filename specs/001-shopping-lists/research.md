# Research: Shopping Lists

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

This is the project's first feature plan, so it chooses the technology stack as well as the
feature design. Each entry gives the decision, why it was made, and what else was considered.
Versions are those current on 2026-10-05; the scaffold pins the exact versions in
`package.json`.

## R1. Platform and framework

- **Decision**: React Native with Expo (SDK 57, managed workflow, New Architecture, Hermes),
  TypeScript in strict mode, targeting Android and iOS phones.
- **Rationale**: chosen by the maintainer. One TypeScript codebase covers both platforms.
  Expo handles native builds (EAS Build), config plugins (Sentry, SQLite) and a fast dev loop
  (Expo Go / development builds). TypeScript strict mode catches most type errors in the
  domain at compile time.
- **Alternatives considered**: Flutter (built-in Material 3, but Dart); Kotlin + Jetpack
  Compose (best Material 3 support, but Android only); Compose Multiplatform (iOS tooling less
  mature).

## R2. Design system library (Principle V)

- **Decision**: React Native Paper 5 (Material 3 / MD3 theme), with icons from
  `@expo/vector-icons` (MaterialCommunityIcons, Paper's default icon set).
- **Rationale**: Paper is the maintained Material 3 implementation for React Native. Its MD3
  color roles use the same names as the Material Theme Builder export (`primary`,
  `onPrimaryContainer`, `surfaceVariant`, ...), so `design/material-theme.json` maps directly
  onto `MD3LightTheme` / `MD3DarkTheme`. It provides every component this feature needs:
  `Appbar`, `List.Item`, `Checkbox`, `FAB`, `Searchbar`, `Dialog`, `Portal`, `Snackbar`,
  `TextInput`, `HelperText`, `ActivityIndicator`, `Banner`, `Chip`, `Menu`.
- **Theme mapping**: `src/adapters/ui/theme/` imports the JSON at build time and builds the
  light and dark Paper themes from `schemes.light` and `schemes.dark`. The scheme follows the
  system (`useColorScheme`). Paper's `elevation.level0..5` colors are not in the export; they
  are derived from `surfaceContainerLowest..Highest`, as Material 3 defines surface
  containers. A unit test checks every role in the Paper theme against the JSON, so the file
  stays the single source of truth. The export's contrast variants (`light-medium-contrast`,
  `dark-high-contrast`, ...) are mapped too. React Native has no cross-platform API to read the
  system contrast setting, so they are not selected automatically in this feature.
- **Tokens beyond color**: typography uses Paper's MD3 type scale (`theme.fonts.*`), shapes use
  `theme.roundness`. Spacing is not defined by Paper, so the shared module defines spacing
  tokens on Material's 4 dp grid (`spacing.xs = 4` … `spacing.xl = 32`). ESLint's
  `react-native/no-color-literals` and `react-native/no-inline-styles` rules block hard-coded
  colors and ad hoc styles in screens.
- **Alternatives considered**: Tamagui / NativeWind (not Material 3); hand-written MD3
  components (rebuilds what Paper already provides, against Principle IV).

## R3. Navigation

- **Decision**: React Navigation 7, native stack, configured in code inside the UI adapter.
- **Rationale**: the feature has four screens and a few dialogs. Configuring navigation in code
  keeps every screen inside `src/adapters/ui/`, where Principle VI puts it. Expo Router's
  file-based routes would add an `app/` directory outside the adapter and deep-linking features
  this feature does not need.
- **Alternatives considered**: Expo Router (built on React Navigation; file-based routing not
  needed here).

## R4. Local storage (Principle VII)

- **Decision**: SQLite through `expo-sqlite` (async API), with hand-written SQL in one SQLite
  adapter and migrations numbered by `PRAGMA user_version`.
- **Rationale**: the data is relational (lists ↔ articles ↔ categories). SQLite gives
  transactions, foreign keys and `UNIQUE` constraints that back the uniqueness rules
  (FR-011, FR-021, FR-024). Every write is committed before the UI shows it as saved, which
  covers FR-028 and SC-007 (killed app, device restart). The data set is small, so hand-written
  SQL is short and needs no ORM.
- **Adapter tests against the real technology (Principle VI)**: the adapter is written against a
  minimal `SqlDatabase` interface whose methods mirror expo-sqlite's async API (`execAsync`,
  `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync`). In the app it is the
  `expo-sqlite` database itself. In Jest it is a small test helper wrapping Node's built-in
  `node:sqlite` (`DatabaseSync`), the same SQLite engine. Adapter tests then run the real
  SQL, constraints and migrations in seconds, with no device and no new dependency. If Jest
  cannot load `node:sqlite`, `better-sqlite3` (dev dependency only) replaces it behind the same
  helper.
- **Alternatives considered**: Drizzle ORM (extra dependency and code generation for five
  tables); WatermelonDB (built for sync, which this feature does not have); AsyncStorage / MMKV
  (simple stores with no transactions or uniqueness constraints, so integrity would have to be
  hand-coded).

## R5. Identifiers

- **Decision**: UUID v4 strings from an `IdGenerator` driven port, implemented with
  `expo-crypto`'s `randomUUID()` and replaced by a sequential fake in tests.
- **Rationale**: Principle III forbids randomness in tests; a port makes IDs deterministic.
  UUIDs also stay unique if a later feature synchronizes data between devices.

## R6. Name rules, search and sorting (FR-009, FR-021, FR-022, Assumptions)

- **Decision**:
  - *Normalized name*, used for uniqueness (articles, categories, lists):
    `name.trim().toLocaleLowerCase('fr')`. Accents are kept: "Pâte" and "Pâté" are different
    names. It is stored in a `normalized_name`
    column with a `UNIQUE` constraint, and the domain checks it first so the user gets a typed
    error, not a constraint failure.
  - *Search form*: the normalized name with diacritics removed
    (`normalize('NFD').replace(/\p{M}/gu, '')`). The query is matched as a substring. Searching
    runs in the domain over the catalog read into memory: a personal catalog holds hundreds of
    articles at most, so filtering in memory takes well under a millisecond and keeps the rule
    in tested domain code.
  - *Sorting*: categories by `position`; items within a category unticked first, then ticked,
    each group sorted by name with `Intl.Collator('fr', { sensitivity: 'base' })` (supported by
    Hermes).
- **Rationale**: these are business rules from the spec, so they live in the domain as pure
  functions; the database constraint is the safety net.

## R7. Quantities (FR-013 to FR-017)

- **Decision**: a `Quantity` value object `{ amount: number; unit: string | null }`. The domain
  function `parseQuantity(amountText, unitText)` trims both, accepts `,` or `.` as the decimal
  separator, and returns either no quantity (both empty), a quantity, or a typed error:
  `AmountNotANumber`, `AmountNotPositive`, `UnitWithoutAmount`, `UnitTooLong`. Amounts are
  stored as SQLite `REAL`. The UI adapter formats them with `Intl.NumberFormat('fr-FR')`
  ("1,5 kg").
- **Rationale**: parsing and validation are rules, so they live in the domain. Display formatting
  is presentation, so it lives in the UI adapter (Principle X). Shopping quantities are small and
  never summed, so binary floating point is harmless.
- **Alternatives considered**: storing the text as typed (pushes validation into the UI);
  integer thousandths (needless here).

## R8. Undo after removing an item (FR-010)

- **Decision**: `removeItemFromList` deletes the row and returns a `RemovedItem` snapshot
  (list, article, ticked state, quantity). The current list screen keeps the snapshot while a
  Paper `Snackbar` shows "Article retiré" with an "Annuler" action for 5 seconds;
  `restoreRemovedItem(snapshot)` re-inserts it as it was.
- **Rationale**: removal is real and immediate, so a killed app never resurrects an item, and
  undo reuses ordinary persistence. Tests control the snackbar timeout with Jest fake timers.

## R9. Ticks shown within 100 ms (SC-002, edge case "storage fails")

- **Decision**: the current list screen updates the tick in its state immediately, then calls
  `toggleItemInCart`. If the write fails, it reverts the item, shows a French snackbar
  ("La modification n'a pas pu être enregistrée.") and reports the error.
- **Rationale**: an expo-sqlite write takes a few milliseconds, but the optimistic update keeps
  the tap feedback independent of storage speed and still never shows a failed change as saved.

## R10. Screen state type (Principle IX)

- **Decision**: one union type per data-displaying screen region:
  `{ status: 'loading' } | { status: 'error'; error: unknown } | { status: 'empty'; ... } |
  { status: 'success'; data: T }`, produced by a shared `useScreenData` hook that runs a query
  use case and reloads when the screen gains focus. The shared UI module provides
  `LoadingState`, `EmptyState` and `ErrorState` components. No screen in this feature shows
  synchronized data, so no synchronization status component is needed yet.
- **Rationale**: the union makes undefined combinations impossible, and a screen renders one
  `switch` over it. Reloading on focus keeps the current list up to date after the add and lists
  screens, with no global store (Principle IV).
- **Alternatives considered**: Redux Toolkit / Zustand / TanStack Query (extra dependencies for
  four screens that read local data).

## R11. Long lists (SC-008)

- **Decision**: React Native `SectionList` (one section per category), with memoized rows and a
  `keyExtractor` on article id.
- **Rationale**: 200 rows is well within `SectionList`'s range. FlashList would be a new
  dependency with no measured need; it can replace `SectionList` if profiling shows lag.

## R12. Accessibility (FR-032 to FR-035)

- **Decision**: each list row is one pressable element with `accessibilityRole="checkbox"`,
  `accessibilityState={{ checked }}` and a French label built by the UI adapter, for example
  "Lait, 2 L, dans le caddie". Secondary actions (change quantity, remove) are icon buttons with
  French `accessibilityLabel`s, and are also exposed as `accessibilityActions` on the row. Ticked
  rows show a check mark and struck-through text, not only a color change. Font scaling is left
  on (`allowFontScaling` default, no `maxFontSizeMultiplier` below 2), rows grow with their
  content, and names wrap (no `numberOfLines`). Paper's icon buttons and list items already meet
  48 dp; the shared row component enforces `minHeight: 48`.
- **Testing**: React Native Testing Library queries by role and French label (`getByRole`,
  `getByLabelText`), so the UI tests check the accessibility contract too. The 200% text size and
  screen reader passes are part of [quickstart.md](quickstart.md).

## R13. Error tracking (Principle VIII)

- **Decision**: Sentry, through `@sentry/react-native` 8 and its Expo config plugin, behind an
  `ErrorReporter` driven port.
  - The Sentry adapter calls `Sentry.init` with `sendDefaultPii: false` and a `beforeSend` /
    `beforeBreadcrumb` that drops breadcrumb messages and request data. Reports carry only the
    stack trace, release (app version), platform and environment. User-facing text and list
    content are never attached; the UI adapter reports errors with a fixed, content-free context
    (screen and operation name).
  - Uncaught exceptions and unhandled rejections are captured by the SDK's global handlers.
  - Offline: the SDK stores envelopes on disk and sends them when connectivity returns, in a
    bounded cache (`maxCacheItems`, default 30). Reporting is asynchronous and its failures are
    swallowed by the SDK, so it never blocks or breaks the app.
  - Symbolication: the Expo plugin uploads source maps and native debug files during EAS Build
    (the Sentry build credential is stored by the maintainer as an EAS environment variable
    with `secret` visibility).
  - The DSN comes from `EXPO_PUBLIC_SENTRY_DSN`. When it is absent (tests, local development),
    the composition root uses a console reporter, so nothing reaches the real service.
    Tests use an in-memory `RecordingErrorReporter`.
- **Rationale**: Sentry has first-party React Native and Expo support covering every Principle
  VIII requirement (offline cache, symbolication, release tagging) and a free tier fitting a
  personal app.
- **Alternatives considered**: Bugsnag (similar, less integrated with Expo); Firebase Crashlytics
  (needs a Firebase project and native setup; weaker on JS errors).

## R14. Testing stack (Principles I, II, III)

- **Decision**:
  - Jest 30 with the `jest-expo` preset for every test.
  - Domain and application tests are plain TypeScript tests against in-memory fakes of the driven
    ports (`InMemoryCatalogRepository`, ...). They run in milliseconds.
  - SQLite adapter tests run the real SQL through `node:sqlite` (R4).
  - UI adapter tests use React Native Testing Library and its built-in Jest matchers, rendering screens with use cases backed by in-memory fakes, and assert the French
    text the user reads.
  - Offline (Principle VII): no driven port in this feature uses the network. An "offline"
    UI test runs a full scenario (open, tick, add, create, change quantity, remove and undo,
    switch list, finish) with `global.fetch` replaced by a function that throws, so any hidden
    network call fails the test. The architecture test (R15) keeps network code out of the
    domain and application layers.
  - Each acceptance scenario in the spec maps to at least one named test (Principle II); the
    tasks list keeps that mapping.
- **End-to-end on device**: not automated in this feature. Device-level checks (expo-sqlite
  binding, kill and restart, airplane mode, TalkBack/VoiceOver, 200% text) are in
  [quickstart.md](quickstart.md). Maestro flows can be added later if manual passes become a
  bottleneck (Principle IV).

## R15. Architecture test (Principle VI)

- **Decision**: `dependency-cruiser` with rules that fail when:
  - `src/domain/**` imports anything outside `src/domain/` (including any npm package);
  - `src/application/**` imports anything other than `src/domain/` and `src/application/`;
  - anything outside `src/adapters/**` and `src/composition/**` imports from `src/adapters/**`;
  - any circular dependency exists.
  It runs as `npm run test:architecture` and in CI.
- **Rationale**: path-based rules over the real import graph enforce the inward-only dependency
  rule without depending on folder conventions being respected by hand.
- **Alternatives considered**: `eslint-plugin-boundaries` (works, but a lint warning is easier
  to ignore than a failing check; dependency-cruiser also detects cycles).

## R16. Lint and format

- **Decision**: ESLint 9 flat config (`eslint-config-expo`, `typescript-eslint` strict,
  `eslint-plugin-react-native` for the style rules of R2, `no-restricted-imports` for layer
  hygiene), Prettier 3 with `eslint-config-prettier`. Scripts: `lint`, `format`, `format:check`,
  `typecheck` (`tsc --noEmit`).

## R17. Continuous integration and merge discipline (Quality Gates)

- **Decision**: GitHub Actions workflow `.github/workflows/ci.yml`, triggered on every pull
  request and every push to `main`, on `ubuntu-latest` with the Node version in `.nvmrc`
  (Node 24 LTS). Jobs: `typecheck`, `lint` (ESLint + `prettier --check`), `test` (Jest,
  including the architecture test and the offline scenario), `build`
  (`npx expo export --platform android --platform ios`, which bundles the JS for both
  platforms). The repository is private on a GitHub plan without branch protection, so the
  merge rule of constitution v1.7.0 applies: no pull request is merged until `gh pr checks`
  shows all four jobs green.
- **Rationale**: the constitution requires CI before the first application code is merged. `expo export` checks that the app bundles without the cost of a
  native build on every pull request; native builds go through EAS Build when releasing.
- **Alternatives considered**: EAS Build on every pull request (slow, uses build credits).

## R18. First launch seed (FR-020, FR-023)

- **Decision**: an `initializeStore(seed)` use case runs at startup. When the store holds no
  list, it creates the default categories in order, the list "Ma liste" and marks it current, in
  one transaction; otherwise it does nothing. The French names are passed in by the UI adapter
  (`src/adapters/ui/seed.ts`), so the application layer holds no display text (Principle X).
- **Rationale**: the "only on an empty store" rule is tested with in-memory fakes, and running it
  in one transaction means an interrupted first launch never leaves half a seed.

## New dependencies (Principle IV)

| Dependency | Why it is needed |
|---|---|
| `expo`, `react-native`, `react` | Chosen platform (R1). |
| `react-native-paper`, `react-native-safe-area-context`, `@expo/vector-icons` | Material 3 design system (R2, Principle V). |
| `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens` | Navigation between screens (R3). |
| `expo-sqlite` | On-device storage (R4, Principle VII). |
| `expo-crypto` | UUIDs for `IdGenerator` (R5). |
| `@sentry/react-native` | Error tracking (R13, Principle VIII). |
| Dev: `jest`, `jest-expo`, `@testing-library/react-native` | Tests (R14, Principle I). |
| Dev: `dependency-cruiser` | Architecture test (R15, Principle VI). |
| Dev: `eslint`, `eslint-config-expo`, `typescript-eslint`, `eslint-plugin-react-native`, `prettier`, `eslint-config-prettier`, `typescript` | Lint, format and type checks (R16, Quality Gates). |
