# Research: Shopping Lists

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

This is the project's first feature plan, so it chooses the technology stack as well as the
feature design. Each entry gives the decision, why it was made, and what else was considered.
Versions are those current on 2026-10-05; the scaffold pins the exact versions in
`apps/mobile/package.json` and the single root `yarn.lock`. R20 was added on 2026-10-06
for constitution v2.1.0 (Principle XI, monorepo). R22 (Storybook) and R23 (Detox) were added on
2026-10-06 at the maintainer's request, to validate screens and run end-to-end tests on a device.

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
- **Theme mapping**: `apps/mobile/src/adapters/ui/theme/` imports the JSON at build time (it stays
  at the repository root in `design/`, which Metro watches in a workspaces setup, R20) and builds
  the light and dark Paper themes from `schemes.light` and `schemes.dark`. The scheme follows the
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
  keeps every screen inside `apps/mobile/src/adapters/ui/`, where Principle VI puts it. Expo Router's
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
- **Since constitution v2.0.0** this database is the device's local replica of the server's
  data: the application still reads and writes it first, and synchronization is added by a later
  feature (R19).
- **Alternatives considered**: Drizzle ORM (extra dependency and code generation for five
  tables); WatermelonDB (built for sync, which this feature does not have; the sync feature
  compares it with a hand-written outbox, R19); AsyncStorage / MMKV
  (simple stores with no transactions or uniqueness constraints, so integrity would have to be
  hand-coded).

## R5. Identifiers

- **Decision**: UUID v4 strings from an `IdGenerator` driven port, implemented with
  `expo-crypto`'s `randomUUID()` and replaced by a sequential fake in tests.
- **Rationale**: Principle III forbids randomness in tests; a port makes IDs deterministic.
  UUIDs also stay unique if a later feature synchronizes data between devices.

## R6. Name rules, search and sorting (FR-009, FR-021, FR-022, Assumptions)

- **Decision**:
  - *Clean name*, the form that is validated, stored and shown (FR-022, clarified 2026-10-06):
    `text.normalize('NFC').trim().replace(/\s+/gu, ' ')`. NFC turns a letter followed by a
    combining accent into the single composed character, so "é" is stored the same however it
    was typed; runs of inner white space become one space. `validateName` returns the clean
    name.
  - *Length*: counted in Unicode code points of the clean name (`[...name].length`), which is
    what SQLite's `length()` counts on text, so the domain check and the `CHECK` constraint
    agree (data checklist CHK014). A string's `.length` (UTF-16 units) is never used: an emoji
    would count twice. For the same reason the name field sets no native `maxLength`, which
    counts UTF-16 units; `NameTooLong` is the only limit.
  - *Normalized name*, used for uniqueness (articles, categories, lists, FR-021):
    `cleanName(name).toLocaleLowerCase('fr')`. Accents are kept: "Pâte" and "Pâté" are
    different names. It is stored in a `normalized_name`
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
  functions; the database constraint is the safety net. Cleaning before storing, not only before
  comparing, keeps what the user sees in line with the uniqueness rule: two names that look the
  same are the same.
- **Alternatives considered**: NFKC (would also fold ligatures and full-width forms, which a
  French typing does not produce, and changes some characters the user did type); counting
  grapheme clusters with `Intl.Segmenter` (matches what the eye sees for emoji sequences, but
  SQLite cannot count the same way, so the two checks would disagree again).

## R7. Quantities (FR-013 to FR-017)

- **Decision**: a `Quantity` value object `{ amount: number; unit: string | null }`. The domain
  function `parseQuantity(amountText, unitText)` trims both and returns either no quantity
  (both empty), a quantity, or a typed error, checked in this order (FR-016, clarified
  2026-10-06):
  1. the amount text must match `^-?\d+([.,]\d+)?$`: digits, at most one decimal comma or
     point with digits on both sides. Anything else ("1 000", "+2", "1e3", "1,5,2", ",5",
     "abc") is `AmountNotANumber`;
  2. a leading `-` or a value of zero is `AmountNotPositive`;
  3. more than 3 digits after the separator is `AmountTooPrecise` ("1,5000" included: the
     rule is on what was typed, so the message matches the user's input);
  4. a value above 9 999 is `AmountTooLarge`;
  5. then the unit rules: `UnitWithoutAmount`, `UnitTooLong`.

  Amounts are stored as SQLite `REAL`. The UI adapter formats them with
  `Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3, useGrouping: false })`: a decimal
  comma, no trailing zeros ("1,50" is shown "1,5", "2,0" is shown "2", FR-017) and no digit
  grouping, so the text prefilled in the quantity dialog parses back unchanged ("9999", never
  the "9 999" that rule 1 refuses).
- **Rationale**: parsing and validation are rules, so they live in the domain. Display formatting
  is presentation, so it lives in the UI adapter (Principle X). Shopping quantities are small and
  never summed, and with at most 3 decimals and 4 integer digits every amount survives the
  `REAL` round trip and formats back to what was typed, so binary floating point is harmless.
- **Alternatives considered**: storing the text as typed (pushes validation into the UI);
  integer thousandths (needless here).

## R8. Undo after removing an item (FR-010)

- **Decision**: `removeItemFromList` deletes the row and returns a `RemovedItem` snapshot
  (list, article, ticked state, quantity). The application store (R10) keeps the snapshot in its
  single `pendingUndo` slot while the app-wide undo snackbar shows "« {name} » retiré de la liste"
  with an "Annuler" action for 5 seconds; `restoreRemovedItem(snapshot)` re-inserts it as it was.
  Any other write ends the offer, and a new undoable change replaces it (the same rule as
  [002's deleted articles](../002-manage-articles/research.md) R5). Moving between screens does
  not end it. While a screen reader is on (`AccessibilityInfo.isScreenReaderEnabled` and its
  `screenReaderChanged` event), the snackbar has no timeout: it stays until dismissed or the
  next write (FR-010), because 5 seconds is too short to reach "Annuler" with TalkBack or
  VoiceOver.
- **Failed restore** (FR-010, clarified 2026-10-06): if `restoreRemovedItem` throws, the store
  clears `pendingUndo` (the offer ends and the removal is final), leaves the list as stored
  (the item stays removed), sets the usual `notice` "La modification n'a pas pu être
  enregistrée." and reports `{ operation: 'restoreRemovedItem' }`. Nothing is shown before the
  write succeeds, so there is nothing to revert.
- **Rationale**: removal is real and immediate, so a killed app never resurrects an item, and
  undo reuses ordinary persistence. Tests control the snackbar timeout with Jest fake timers.

## R9. Ticks shown within 100 ms (SC-002, edge case "storage fails")

- **Decision**: the store's `toggleItem` action (R10) updates the tick in the current list region
  immediately, then queues a call to `toggleItemInCart` (FR-004, clarified 2026-10-06):
  - each item has its own queue in the store (a promise chain keyed by list and article), so
    quick taps on one item are saved one after the other, in tap order; taps on different items
    do not wait for each other;
  - if a save fails, the store drops the toggles still queued for that item, reloads the current
    list region from storage, so the item shows the state last saved, sets the usual `notice`
    ("La modification n'a pas pu être enregistrée.") and reports
    `{ operation: 'toggleItemInCart' }`.
- **Rationale**: an expo-sqlite write takes a few milliseconds, but the optimistic update keeps
  the tap feedback independent of storage speed and still never shows a failed change as saved.
  Saving in order makes the stored state after n successful toggles equal to the shown one.
  Reloading rather than flipping back is what makes a failure in the middle of quick taps
  correct: "the previous state" is ambiguous with several taps in flight, the stored state is
  not. Dropping the later toggles keeps the reloaded screen and storage equal.
- **Alternatives considered**: ignoring taps while a save is pending (rejected in the spec's
  clarification); a `setItemInCart(value)` use case instead of a toggle (would also be correct
  with the queue, but changes a use case that 003 already extends, for no gain).

## R9a. Finishing shopping when the save fails (FR-007)

- **Decision**: `finishShopping` runs in one `UnitOfWork` transaction, so a failure changes no
  item. The store's `finishShopping` action shows nothing before the write succeeds. On failure
  the FinishShoppingDialog closes, focus goes back to "Terminer les courses" (still offered,
  since items are still ticked, FR-037), the usual `notice` is shown and
  `{ operation: 'finishShopping' }` is reported.
- **Rationale**: the all-or-nothing rule is already given by the transaction; closing the
  dialog matches every other failed write, and the action stays one tap away.

## R10. Application state and screen state type (Principle IX)

- **Decision**: the application state is managed with **Zustand**, in one store of the UI
  adapter (`apps/mobile/src/adapters/ui/state/`), as decided in
  [002's research](../002-manage-articles/research.md) R1 and specified in
  [002's ui-state contract](../002-manage-articles/contracts/ui-state.md). Each data-displaying
  region is one union in the store:
  `{ status: 'loading' } | { status: 'error'; error: unknown } | { status: 'empty'; ... } |
  { status: 'success'; data: T }` (plus an internal `idle` before the first request). Store
  actions run the query use cases, call the command use cases and reload every loaded region
  after each successful write, so the current list is up to date when the user comes back from
  the add and lists screens. The shared UI module provides `LoadingState`, `EmptyState` and
  `ErrorState` components. No screen in this feature shows synchronized data, so no
  synchronization status component is needed yet; the sync feature adds it (R19).
- **Rationale**: the union makes undefined combinations impossible, and a screen renders one
  `switch` over it. The maintainer chose Zustand for the whole app: 002 needs state that
  outlives a screen (an undo offer that ends at the next change anywhere, views reloaded after
  article changes), and building 001 on the same store avoids two state styles. The store is
  created by a factory and provided through React context, so every test gets a fresh one. It
  uses no middleware ([002 research](../002-manage-articles/research.md#r1b-no-zustand-middleware) R1b).
- **Alternatives considered**: a per-screen `useScreenData` hook reloading on focus (cannot hold
  an undo offer across screens); Redux Toolkit (more ceremony); TanStack Query (made for remote
  server state).

## R11. Long lists (SC-008)

- **Decision**: React Native `SectionList` (one section per category), with memoized rows and a
  `keyExtractor` on article id.
- **Rationale**: 200 rows is well within `SectionList`'s range. FlashList would be a new
  dependency with no measured need; it can replace `SectionList` if profiling shows lag.
- **Measurement**: SC-008 (55 frames per second or more while scrolling and ticking) is read
  from React Native's Perf Monitor, on a release build filled by the seed (T135), on the two
  reference phones of the spec: an entry-level Android phone about five years old and the
  maintainer's iPhone.

## R12. Accessibility (FR-032 to FR-035)

- **Decision**: each list row is one pressable element with `accessibilityRole="checkbox"`,
  `accessibilityState={{ checked }}` and a French label built by the UI adapter, for example
  "Lait, 2 L, dans le caddie". Secondary actions (change quantity, remove) are icon buttons with
  French `accessibilityLabel`s, and are also exposed as `accessibilityActions` on the row. Ticked
  rows show a check mark and struck-through text, not only a color change. Font scaling is left
  on (`allowFontScaling` default, no `maxFontSizeMultiplier` below 2), rows grow with their
  content, and names wrap (no `numberOfLines`). Paper's icon buttons and list items already meet
  48 dp; the shared row component enforces `minHeight: 48`.
- **Contrast (FR-036)**: ticked rows are dimmed with the `onSurfaceVariant` role, not with
  opacity, so their contrast can be checked from the theme alone. The theme test computes the
  WCAG contrast ratio of each pair the screens use (`onSurface`, `onSurfaceVariant` and
  `primary` on `surface` and `surfaceContainer*`; `outline` for the checkbox), in light and
  dark: at least 4.5:1 for text roles and 3:1 for icon and outline roles.
- **Focus (FR-037)**: `AccessibilityInfo.setAccessibilityFocus` on the target's native node,
  after the layout settles: the dialog title when a dialog opens, the opener when it closes (the
  Appbar title when the opener is gone),
  the next row (or previous, or the `EmptyState`) after a removal. Rows are keyed by article
  id (R11), so a ticked row keeps its native view, and focus, when it moves.
- **Announcements (FR-038)**: snackbars and `HelperText` errors call
  `AccessibilityInfo.announceForAccessibility` with their French text when they appear, which
  works on both platforms; the remaining count does not.
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
- **No storage error text in reports** (FR-030, clarified 2026-10-06): the SQLite adapter catches
  every error thrown by the database (in `openDatabase`, `migrate`, the repositories and
  `SqliteUnitOfWork`) and rethrows a `StorageError` whose message is fixed and content-free
  ("Storage operation failed"), carrying only the SQLite result code when the original error has
  one. Its stack trace is its own, captured where the adapter rethrows, which points at the
  failing repository call; the original stack is not copied, because a JavaScript stack string
  starts with the original message. The original error is not attached as `cause` either, so
  its text never reaches a report. Every storage failure the UI adapter or the global handlers report is
  therefore already clean, and the reporter needs no filtering of its own.
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
  - Store tests build the vanilla Zustand store (R10) with use cases on in-memory fakes and
    assert state and reports, without rendering.
  - UI adapter tests use React Native Testing Library and its built-in Jest matchers, rendering screens with a fresh store whose use cases are backed by in-memory fakes, and assert the French
    text the user reads.
  - Offline (Principle VII): no driven port in this feature uses the network. An "offline"
    UI test runs a full scenario (open, tick, add, create, change quantity, remove and undo,
    switch list, finish) with `global.fetch` replaced by a function that throws, so any hidden
    network call fails the test. The architecture test (R15) keeps network code out of the
    domain and application layers.
  - Each acceptance scenario in the spec maps to at least one named test (Principle II); the
    tasks list keeps that mapping.
- **Screen catalog**: every shared component and every state of every screen has a Storybook
  story, and a Jest test renders each story in the light and dark schemes (R22).
- **End-to-end on device**: Detox journeys drive the release build on an emulator or simulator,
  with the real expo-sqlite binding, navigation and kill-and-relaunch (R23). They run in their own
  test-only workspace, outside `yarn test`, so the unit suite stays fast (Principle III).
  Checks that need a human stay manual in [quickstart.md](quickstart.md): airplane mode,
  TalkBack/VoiceOver, 200% text and the visual review of the stories.

## R15. Architecture test (Principle VI)

- **Decision**: `dependency-cruiser`, configured once at the repository root for every workspace
  (R20), with rules that fail when:
  - a file imports another workspace through a relative path instead of its package name, or an
    app workspace (`apps/*`) imports another app workspace (Principle XI);
  - `apps/mobile/src/domain/**` imports anything outside `apps/mobile/src/domain/` (including any npm package);
  - `apps/mobile/src/application/**` imports anything other than `apps/mobile/src/domain/` and `apps/mobile/src/application/`;
  - anything outside `apps/mobile/src/adapters/**` and `apps/mobile/src/composition/**` imports from `apps/mobile/src/adapters/**`;
  - anything outside `apps/mobile/src/adapters/ui/**` imports `zustand` (R10);
  - anything imports `zustand/middleware` or `immer` (R10, [002 research](../002-manage-articles/research.md#r1b-no-zustand-middleware) R1b);
  - `@storybook/*` is imported outside story files, `.rnstorybook/` and the story test, or a
    story file or testing helper is imported by production code (R22);
  - `tests/e2e/**` imports any other workspace (R23);
  - any circular dependency exists.
  It runs from the root as `yarn test:architecture` and in CI. Later workspaces (the server,
  shared packages) add their own layer rules to the same file.
- **Rationale**: path-based rules over the real import graph enforce the inward-only dependency
  rule without depending on folder conventions being respected by hand.
- **Alternatives considered**: `eslint-plugin-boundaries` (works, but a lint warning is easier
  to ignore than a failing check; dependency-cruiser also detects cycles).

## R16. Lint and format

- **Decision**: one ESLint 9 flat config and one Prettier config at the repository root, shared by
  every workspace, with the Expo and React Native rules scoped to `apps/mobile/**` (R20). ESLint
  9 flat config (`eslint-config-expo`, `typescript-eslint` strict,
  `eslint-plugin-react-native` for the style rules of R2, `no-restricted-imports` for layer
  hygiene), Prettier 3 with `eslint-config-prettier`. Scripts: `lint`, `format`, `format:check`,
  `typecheck` (`tsc --noEmit` against each workspace's `tsconfig.json`, which extends the root
  `tsconfig.base.json`).

## R17. Continuous integration and merge discipline (Quality Gates)

- **Decision**: GitHub Actions workflow `.github/workflows/ci.yml`, triggered on every pull
  request and every push to `main`, on `ubuntu-latest`. Each job installs Nix and runs its commands in the flake's dev shell
  (`nix develop --command …`, R21), so CI uses the same Node 24 and Yarn as every developer. It
  runs `yarn install --immutable` once at the root (failing if `yarn.lock` is out of date), then
  a root script that runs in every workspace (`yarn workspaces foreach`, R20). The Nix store is
  cached by `magic-nix-cache-action`. Jobs: `typecheck`, `lint` (ESLint +
  `prettier --check`), `test` (Jest, including the architecture test and the offline scenario),
  `build` (`yarn build`; for the app this is
  `expo export --platform android --platform ios`, which bundles the JS for both platforms). The repository is private on a GitHub plan without branch protection, so the
  merge rule of constitution v1.7.0 applies: no pull request is merged until `gh pr checks`
  shows every job green. Detox adds a fifth job, `e2e-android` (R23).
- **Rationale**: the constitution requires CI before the first application code is merged. `expo export` checks that the app bundles without the cost of a
  native build on every pull request; native builds go through EAS Build when releasing.
- **Alternatives considered**: EAS Build on every pull request (slow, uses build credits).

## R18. First launch seed (FR-020, FR-023)

- **Decision**: an `initializeStore(seed)` use case runs at startup. When the store holds no
  list, it creates the default categories in order, the list "Ma liste" and marks it current, in
  one transaction; otherwise it does nothing. The French names are passed in by the UI adapter
  (`apps/mobile/src/adapters/ui/seed.ts`), so the application layer holds no display text (Principle X).
- **Rationale**: the "only on an empty store" rule is tested with in-memory fakes, and running it
  in one transaction means an interrupted first launch never leaves half a seed.

## R18a. Startup failure (FR-039)

- **Decision**: the composition root (open the database, run the migrations, build the use
  cases, `initializeStore`) runs once when `App.tsx` mounts. While it runs, the app shows
  `LoadingState`. If any step throws (other than `DataFromNewerVersion`, R18c), the app shows a
  full-screen `StartupError` view built on
  the shared `ErrorState`: "L'application n'a pas pu démarrer." and "Réessayer"; the error is
  reported with `{ operation: 'startup' }`. "Réessayer" closes the database if it was opened
  and runs the composition root again from the start; each failure is reported. The root
  reports through the error reporter, which it builds first and which never throws, so a
  storage failure can always be reported (offline, Sentry's own cache holds it).
- **Data is never wiped**: no code path deletes, recreates or overwrites the database file to
  recover. Each migration runs in one transaction, so a failed migration leaves the previous
  schema and data as they were; `initializeStore` seeds in one transaction (R18), so an
  interrupted seed leaves an empty store that the next start seeds again.
- **Rationale**: the error state and retry are the pattern every data screen already uses
  (US1-12), so the user meets nothing new. A failure at startup may be temporary (storage
  full, a file locked by a backup), and the device holds the only copy of the data until 003
  (R18b), so resetting would trade a temporary failure for a permanent loss.
- **Alternatives considered**: offering to reset storage after a failure (rejected in the
  spec's clarification: a permanent loss to fix what may be temporary); restarting the app
  instead of retrying in place (React Native cannot restart itself without a native module).

## R18c. Updates and older versions (FR-040)

- **Decision**:
  - *Updates keep the data*: migrations only add (tables, columns, rows) or transform rows in
    place; a migration never drops a table or a column holding user data without first copying
    it. Each new migration (002, 003) gets a test that fills the previous schema with fixtures,
    runs it, and checks every list, item, tick, quantity, article, category and the current list
    are still there. A failed migration rolls back and shows the startup error (FR-039, R18a).
  - *Older versions*: `migrate` first reads `PRAGMA user_version`. When it is greater than the
    highest migration the app knows, it runs nothing and throws `DataFromNewerVersion`, before
    any read or write. `App.tsx` shows the full-screen `UpdateRequired` view: "Cette version de
    l'application est trop ancienne pour vos données. Mettez-la à jour.", with no action (a
    retry cannot help) and no report (FR-040: an expected situation). The database is closed
    untouched.
- **Rationale**: `user_version` already records the schema, so the check costs one read. Refusing
  before any query is the only way to be sure an older app neither misreads nor damages a newer
  layout.
- **Alternatives considered**: opening read-only (older code may still misread a newer layout);
  a "Réessayer" button (nothing changes until the app is updated).

## R18b. Backup and data protection (Assumptions)

- **Decision**: the device holds the only copy of the data until 003; losing it with the phone
  is an accepted risk (spec Assumptions, clarified 2026-10-06). The system backup stays on as
  a fallback: `app.config.ts` sets `android.allowBackup: true` explicitly (Expo's default,
  written down so a later change is deliberate), with no backup rules that exclude the
  database. Android Auto Backup then includes the expo-sqlite file (well under its 25 MB
  limit), and on iOS the file lives in the app's Documents folder, which the iCloud device
  backup includes; quickstart step 13 checks both platforms before the first release. No
  encryption is added (no SQLCipher): the data is not sensitive, and the
  system already encrypts the phone's storage.
- **Rationale**: the fallback costs one config line, and a phone restored from backup gets its
  lists back. Encrypting non-sensitive data would add a native dependency and a key to manage
  for no gain (Principle IV).
- **Alternatives considered**: excluding the data from backups so a restored phone cannot bring
  back old data that later clashes with sync (that case belongs to 003, see R19); a manual
  export and import (not in the spec).

## R19. Synchronization deferred (Principle VII)

> **Resolved by [003-server-sync](../003-server-sync/research.md)**, which answers each open
> question below (research R6 to R13 there).

- **Decision**: this feature does not synchronize with the Raspberry Pi server. Constitution
  v2.0.0 makes the server's database the source of truth, but this spec defines a single-device
  app and excludes synchronization (FR-027, Assumptions). A dedicated sync feature brings 001 and
  [002](../002-manage-articles/research.md#r7-synchronization-deferred-principle-vii) in line
  together. The deviation is justified in the plan's Complexity Tracking.
- **Kept compatible with sync** (no extra code, Principle IV):
  - ids are UUIDs generated on the device (R5) and never change, so a server can match records
    across devices;
  - each change is one `UnitOfWork` transaction, so a later outbox of pending changes can be
    written in the same transaction and never diverge from the data;
  - writes commit locally before the UI shows them (FR-028), which stays true with a replica;
  - read models and screens never assume the device holds the only copy.
- **Open questions for the sync feature's spec**, raised by this design:
  - *First-launch seed* (R18): each device seeds the default categories and "Ma liste" with its
    own UUIDs, so a second device would hold duplicates with the same names. The sync feature
    decides whether a new device pulls from the server before seeding, or how seeded records
    merge by name.
  - *Name uniqueness* (R6): two devices can create a category, an article or a list with the
    same normalized name offline.
  - *Concurrent ticks and quantities*: the same item ticked on one device and unticked, or its
    quantity changed, on another; "Terminer les courses" on one device while the other ticks.
  - *Current list*: whether the current list is shared or chosen per device.
  - *Deletions and undo* (R8): a removed item leaves no trace to send, and its undo re-inserts it;
    the same questions as 002's article deletion.
  - *Category order*: positions assigned on two devices can collide.
  - *Restored backups* (R18b): a phone restored from a system backup comes back with the data
    and ids of the day of the backup, possibly older than what the server holds. Answered by
    [003 FR-018b](../003-server-sync/spec.md): the device credential is not restored, so the
    phone pairs again and its restored changes are merged by the usual rules.
- **Alternatives considered**: synchronize in this feature (rules not in the spec, server API
  undecided); add an outbox or sync metadata columns now (code and schema no test requires while
  nothing reads them, and the sync feature's migration can add them).

## R20. Monorepo layout (Principle XI)

- **Decision**: one Git repository organized as **Yarn workspaces**, managed by **Yarn 4**
  (chosen by the maintainer), set up by this first feature:
  - Yarn is pinned in the root `package.json` `"packageManager": "yarn@4.x"` field and run
    through the Corepack shims of the Nix dev shell (R21), so every machine and CI use the same
    Yarn version and no Yarn binary is committed;
  - `.yarnrc.yml` sets `nodeLinker: node-modules`. React Native and Expo do not support Yarn's
    default Plug'n'Play mode, so dependencies are installed into `node_modules/` as usual;
  - the root `package.json` is private (name `mes-courses`), declares
    `"workspaces": ["apps/*", "packages/*"]`, holds only the shared dev tools (TypeScript,
    ESLint, Prettier, dependency-cruiser) and scripts that run in every other workspace
    (`yarn workspaces foreach --all --exclude mes-courses run <script>`; `--exclude` keeps the
    root script from calling itself, and workspaces without the script are skipped);
  - workspaces reference each other with the `workspace:*` protocol, so a dependency on a local
    package can never resolve to the npm registry;
  - one `yarn.lock` at the root and one `yarn install` (`--immutable` in CI);
  - shared configs at the root: `tsconfig.base.json` (strict options), `eslint.config.mjs`,
    `.prettierrc`, `.dependency-cruiser.cjs`, `flake.nix`, `.github/workflows/ci.yml`;
  - the Expo app is the workspace `@mes-courses/mobile` in `apps/mobile/`, with its own
    `package.json`, `tsconfig.json` (extends the base), `jest.config.js` (`jest-expo`),
    `app.config.ts` and `eas.json`. Expo's Metro config detects Yarn workspaces on its own (SDK 52
    and later, with the `node-modules` linker). The only `metro.config.js` is the one Storybook
    needs (R22): it wraps Expo's `getDefaultConfig` with `withStorybook` and adds nothing for
    workspaces. EAS Build runs from `apps/mobile/`;
  - the server ([003](../003-server-sync/research.md#r1-repository-layout-yarn-workspaces)) will
    be `apps/server/`, and shared code `packages/<name>/`. No shared package exists in this
    feature, so `packages/` is not created yet (Principle IV).
  Workspaces depend on each other only through package names and public entry points; the
  architecture test enforces it (R15).
- **Rationale**: the constitution requires a monorepo (Principle XI), and 003 already needs one
  for the server and the shared sync rules. Setting the workspace layout up now, before any code
  exists, costs a few config files; moving the app into a workspace later would touch every path
  in 001 and 002. Keeping the app out of the root also keeps its Jest, TypeScript and Metro
  configs from picking up the server's files.
- **Alternatives considered**: the app at the root as both app and workspaces root (simpler
  today, but the root's configs then cover nested workspaces and need exclusions); npm
  workspaces (no extra tool, but the maintainer chose Yarn, which also brings `workspace:*`,
  `workspaces foreach` and `workspaces focus` for the Pi deployment in 003); pnpm (its symlinked
  layout needs extra Metro configuration for React Native); Yarn Plug'n'Play (unsupported by
  React Native); Turborepo or Nx on top (build caching and task graphs a two-app repository does not need, Principle IV).

## R21. Development environment: Nix flake

- **Decision**: the project's tools come from a **Nix flake** at the repository root, chosen by
  the maintainer:
  - `flake.nix` defines `devShells.default` for `aarch64-darwin`, `x86_64-darwin`,
    `x86_64-linux` and `aarch64-linux` (the Pi), with Node.js 24 (`nodejs_24`), Corepack shims
    for Yarn (`corepack_24`, so Yarn's version still comes from `packageManager`, R20) and
    `watchman` for Metro. It pins `nixpkgs` to a stable release branch;
  - `flake.lock` pins the exact `nixpkgs` revision, so every machine, CI and the Pi run the same
    Node. It replaces `.nvmrc`; `"engines": { "node": ">=24" }` stays in `package.json` as a
    guard for anyone running outside the shell;
  - `.envrc` contains `use flake`, so `direnv` (with `nix-direnv`) loads the shell when entering
    the folder; `nix develop` does the same by hand. `.direnv/` is ignored by Git;
  - `flake.lock` gets the Talisman entry required by the workspace `AGENTS.md` (content hashes
    and git revisions, not secrets);
  - CI installs Nix (`DeterminateSystems/nix-installer-action`, with the
    `DeterminateSystems/magic-nix-cache-action` cache) and runs every step through
    `nix develop --command …` (R17);
  - **out of Nix**: Xcode (macOS only, from Apple) and Android Studio with its SDK and emulator.
    Native device builds use them; Nix provides everything the automated checks and CI need.
  - the Pi uses the same flake for its Node runtime ([003 R17](../003-server-sync/research.md#r17-deployment-on-the-pi)).
- **Rationale**: one declared, locked toolchain for the maintainer's Mac, CI and the Pi, so "it
  works on my machine" cannot drift between them, and a new machine needs only Nix and `direnv
  allow`. Corepack keeps a single Yarn pin in `package.json` instead of a second one in the
  flake.
- **Alternatives considered**: `.nvmrc` with nvm or `setup-node` (the Node version is pinned
  only loosely and the Pi installs Node another way); `yarn-berry` from nixpkgs instead of
  Corepack (a second Yarn version to keep in step with `packageManager`); Android SDK through
  Nix (`androidenv`: large, slow to evaluate and duplicates Android Studio, which the emulator
  needs anyway; can be added later if a headless Android build is needed); devenv or Devbox on
  top of Nix (another tool for what a plain flake does, Principle IV).

## R22. Screen validation with Storybook

- **Decision**: **Storybook for React Native 10** (`@storybook/react-native`), chosen by the
  maintainer, runs on the device inside the app workspace and catalogs the UI adapter:
  - **What has a story**: every component of the shared module
    (`apps/mobile/src/adapters/ui/components/`), and every screen and dialog in each of its
    states (Principle IX): loading, empty, error, success, the main variants of each (for example
    "Tout est dans le caddie", an error message under a field) and, once 003 adds it, each
    synchronization status. The required list is in
    [contracts/ui-validation.md](contracts/ui-validation.md#required-stories).
  - **Where**: stories sit next to their component as `*.stories.tsx`. Storybook's own config is
    in `apps/mobile/.rnstorybook/` (`main.ts` lists `../src/adapters/ui/**/*.stories.tsx`;
    `preview.tsx` holds the decorators).
  - **How a screen story gets its data**: screens read the application store (R10), so a screen
    story renders the screen inside `AppStoreProvider` with a store built by
    `createStoryStore(scenario)` (`apps/mobile/src/adapters/ui/testing/`). It wires the real
    use cases on 001's in-memory fakes, seeded with French fixture data. The loading state uses a
    query that never resolves, the error state a query that rejects. No story builds a
    `ScreenState` by hand, so a story cannot show a state the store cannot reach.
    `renderWithStore` in the RNTL tests uses the same helper, so stories and screen tests share
    one set of fixtures.
  - **Theme**: `preview.tsx` wraps every story in `PaperProvider` with the theme built from
    `design/material-theme.json`. The theme follows the system scheme as the app does, so a
    reviewer checks dark mode by switching the device to dark (Principle V). There is no theme
    addon.
  - **Enabling**: `apps/mobile/metro.config.js` wraps Expo's default config with `withStorybook`.
    `STORYBOOK_ENABLED=true` swaps the app's entry point for Storybook's UI. Without it, which is
    the case for release builds, EAS builds and Detox builds, the bundle holds no Storybook code
    and no story. Script: `yarn storybook` in `apps/mobile/` (`STORYBOOK_ENABLED=true expo start`)
    on a development build.
  - **No add-ons**: no on-device controls, actions or backgrounds add-on. Stories are fixed
    scenarios, and actions are checked by the screen tests (Principle IV).
- **Automated check (Principles II and III)**: one Jest test,
  `apps/mobile/src/adapters/ui/stories.test.tsx`, finds every `*.stories.tsx` (`fs.globSync`,
  Node 24), composes its stories with Storybook's portable stories API (`composeStories`, with the
  project annotations of `preview.tsx`) and renders each one with RNTL in both schemes. It fails
  when a story throws or logs a React error or warning. It also fails when a story listed in
  [contracts/ui-validation.md](contracts/ui-validation.md#required-stories) is missing, so a new
  screen state cannot ship without its story. It runs inside `yarn test`, with no device, in
  seconds. Behavior stays in the screen tests, which can render a composed story as their
  starting point.
- **Visual review (manual)**: Storybook is where a person validates what a screen looks like.
  A pull request that adds or changes a shared component or a screen state lists the stories
  it touches in its description. The maintainer opens them in Storybook on Android and on iOS, in
  light and dark mode, and at 200% text size for the screens with long names, before merging
  ([quickstart.md](quickstart.md#2-review-the-screens-in-storybook)). A new shared component is
  reviewed this way, as Principle V requires.
- **Architecture (Principle VI)**: dependency-cruiser (R15) gains rules: `@storybook/*` is
  imported only by `*.stories.tsx`, `.rnstorybook/**` and `stories.test.tsx`; `*.stories.tsx`,
  `adapters/ui/testing/**` and `application/testing/**` are imported only by tests, stories and
  other testing helpers, never by production code.
- **Rationale**: one place shows every screen state with realistic French data, without walking
  the app into an error or a loading state by hand. Building story data through the real store
  and use cases keeps stories honest. Rendering every story in Jest catches a broken story on the
  next run instead of at the next review. On-device Storybook renders with the same native
  components and fonts as the app, which is what a visual review needs.
- **Alternatives considered**: Storybook for the web through `@storybook/react-native-web-vite`
  (renders React Native Web, not the native components, and is a second Storybook to configure);
  automated visual regression, either with Chromatic (an external service that receives
  screenshots, paid beyond its free tier) or with screenshot diffing in Vitest browser mode or
  Detox (a second test runner, and native screenshots are not stable across emulator images,
  against Principle III). It can be added later if manual review misses regressions. Also
  considered: a dev-only "gallery" screen in the app (rebuilds Storybook's navigation by hand).

## R23. End-to-end tests with Detox

- **Decision**: **Detox 20** (Wix), chosen by the maintainer, drives the app's release build on an
  Android emulator and an iOS simulator:
  - **Workspace**: a test-only workspace `tests/e2e/` (`@mes-courses/e2e-tests`, private). The
    root `"workspaces"` becomes `["apps/*", "packages/*", "tests/*"]`, which 003's `tests/sync/`
    also uses (Principle XI). The workspace imports nothing from the other workspaces: it only
    drives the built binary. It holds `.detoxrc.js`, its own `jest.config.js` and the journeys in
    `tests/e2e/journeys/*.e2e.ts`.
  - **Test runner**: Detox's Jest runner, with **Jest 29** pinned in this workspace, because
    Detox documents Jest 29. The app keeps Jest 30. Yarn installs each version where it is used
    (`node-modules` linker), still from the one `yarn.lock`. TypeScript goes through `ts-jest`.
  - **Native projects**: Detox needs native code changes (Android test runner, a network security
    config for the release build, the iOS pod). Expo no longer ships a Detox config plugin, so the
    app uses the community `expo-detox-config-plugin` (Expo SDK 54 and later, Detox 20.44 or
    later), registered in `app.config.ts`. If it does not support SDK 57 when the work starts,
    a local config plugin in `apps/mobile/plugins/with-detox.ts` makes the same Android changes.
    `ios/` and `android/` stay generated by `expo prebuild` and ignored by Git, as in T003.
  - **Configurations** (`.detoxrc.js`): `android.emu.release` builds with
    `expo prebuild --platform android` then
    `./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release` in
    `apps/mobile/android/`. `ios.sim.release` builds with `expo prebuild --platform ios` then
    `xcodebuild` for the Release configuration and the simulator SDK. Release builds embed the JS
    bundle, so no Metro server is needed and the binary is the one users get.
  - **Build environment**: no `EXPO_PUBLIC_SENTRY_DSN`, so the composition root uses the console
    reporter and no test sends anything to Sentry (Principle VIII); `SENTRY_DISABLE_AUTO_UPLOAD=true`,
    so the build does not upload source maps; `STORYBOOK_ENABLED` unset.
  - **Isolation**: each journey file starts with
    `device.launchApp({ delete: true, newInstance: true })`, a fresh install on a fresh store
    (first-launch seed included), so journeys never depend on each other's data or order
    (Principle III). Inside a file, steps run in order as one user journey.
  - **Queries**: journeys find elements by the French text and accessibility labels of
    [contracts/ui-screens.md](contracts/ui-screens.md) (`by.text`, `by.label`), as the user and the
    screen reader see them (Principles II and X). `testID` is not used: when text alone is
    ambiguous, the journey narrows by ancestor (`withAncestor`) or the contract makes the label
    unique.
  - **No waiting by time**: Detox waits for the app to be idle. Journeys use no `sleep`; `waitFor`
    is used only with an explicit timeout on a visible outcome. Jest `retryTimes` is not set: a
    journey that passes only on retry is a failing journey (Principle III).
  - **Scope**: a few journeys that cross the layers Jest cannot reach on a device: the real
    expo-sqlite binding, native navigation and Paper rendering, and persistence after the app
    process is killed (`device.terminateApp()` then `device.launchApp({ newInstance: true })`).
    Each journey names the spec scenarios it covers. The list is in
    [contracts/ui-validation.md](contracts/ui-validation.md#end-to-end-journeys).
    Every acceptance scenario is still covered by a Jest test; journeys do not replace them.
  - **Test-first (Principle I)**: a story's journey is written before the story is implemented
    and fails, as the outer loop of the story. The story's unit, store and screen tests drive the
    code (inner loop) until the journey passes.
- **Running**:
  - Locally: `yarn test:e2e:android` and `yarn test:e2e:ios` at the root (Detox build then test
    in `tests/e2e/`). Android needs Android Studio with an emulator named in `.detoxrc.js`
    (`Pixel_API_35` by default, overridable with `DETOX_AVD_NAME`). iOS needs macOS, Xcode and
    `applesimutils` (Homebrew). These stay outside Nix, like Android Studio and Xcode (R21).
  - CI: a job `e2e-android` in `.github/workflows/ci.yml` on `ubuntu-latest`, on every pull
    request and push to `main` like the other jobs. It enables KVM, sets up Java 17
    (`actions/setup-java`) and uses the runner's Android SDK, caches Gradle, starts an x86_64
    API 35 emulator with `reactivecircus/android-emulator-runner`, and runs the Detox build and
    test through `nix develop --command` for Node and Yarn (R21). It uploads Detox artifacts
    (screenshots and logs of failed steps) when it fails.
  - iOS end-to-end runs on the maintainer's Mac, not in CI: macOS runners use GitHub minutes at
    ten times the Linux rate on a private repository. The iOS journeys run before each release
    and on any pull request that touches native configuration (`app.config.ts`, config plugins,
    native dependencies). Constitution v2.1.1 sets this rule in its Quality Gates.
- **Rationale**: Jest covers behavior through in-memory fakes and `node:sqlite`, but nothing
  automated checked the binary itself: that expo-sqlite opens and migrates on a device, that
  screens navigate, that data survives a killed process (SC-007, FR-028). Detox's gray-box
  synchronization with the React Native bridge avoids the timing sleeps that make black-box UI
  tests flaky, and its tests are TypeScript in Jest, like the rest of the codebase.
- **Alternatives considered**: Maestro (YAML flows, the option Expo documents with EAS Workflows;
  not chosen by the maintainer, and its black-box waits are less deterministic than Detox's
  synchronization); Appium (WebDriver setup heavier for a two-platform app); running Detox on
  debug builds (needs Metro during tests and differs from what users run); the e2e tests inside
  `apps/mobile/` (Detox's Jest 29 would conflict with the app's Jest 30 config and `yarn test`
  would pick the journeys up); iOS in CI on `macos-latest` (cost, see above; it can be added if the
  repository becomes public, where macOS minutes are free).

## New dependencies (Principle IV)

| Dependency | Why it is needed |
|---|---|
| Nix flake: `nodejs_24`, `corepack_24`, `watchman` (dev environment only, R21) | One locked toolchain for developers, CI and the Pi, chosen by the maintainer. |
| Yarn 4 (through Corepack, pinned by `packageManager`; not an app dependency) | Package manager and workspaces for the monorepo (R20, Principle XI), chosen by the maintainer. |
| `expo`, `react-native`, `react` | Chosen platform (R1). |
| `react-native-paper`, `react-native-safe-area-context`, `@expo/vector-icons` | Material 3 design system (R2, Principle V). |
| `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens` | Navigation between screens (R3). |
| `zustand` | Application state shared by every screen (R10), chosen by the maintainer. |
| `expo-sqlite` | On-device storage (R4, Principle VII). |
| `expo-crypto` | UUIDs for `IdGenerator` (R5). |
| `@sentry/react-native` | Error tracking (R13, Principle VIII). |
| Dev: `jest`, `jest-expo`, `@testing-library/react-native` | Tests (R14, Principle I). |
| Dev: `dependency-cruiser` | Architecture test (R15, Principle VI). |
| Dev: `eslint`, `eslint-config-expo`, `typescript-eslint`, `eslint-plugin-react-native`, `prettier`, `eslint-config-prettier`, `typescript` | Lint, format and type checks (R16, Quality Gates). |
| Dev: `storybook`, `@storybook/react-native`, `@storybook/react` (portable stories), and the on-device UI's peer dependencies listed by its install guide (`react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg`, `@gorhom/bottom-sheet` at the time of writing) | Screen catalog and story tests (R22), chosen by the maintainer. The peers are native modules, so they are compiled into every build, but no Storybook code is bundled without `STORYBOOK_ENABLED`. |
| `expo-detox-config-plugin` (dev, config plugin) | Native changes Detox needs, applied at `expo prebuild` (R23). |
| `tests/e2e` dev: `detox`, `jest@29`, `ts-jest`, `@types/jest` | End-to-end journeys on a device (R23), chosen by the maintainer. |
| CI only: `reactivecircus/android-emulator-runner`, `actions/setup-java` | Android emulator and JDK for the `e2e-android` job (R23). |
