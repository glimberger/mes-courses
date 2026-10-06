# Research: Shopping Lists

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

This is the project's first feature plan, so it chooses the technology stack as well as the
feature design. Each entry gives the decision, why it was made, and what else was considered.
Versions are those current on 2026-10-05; the scaffold pins the exact versions in
`apps/mobile/package.json` and the single root `yarn.lock`. R20 was added on 2026-10-06
for constitution v2.1.0 (Principle XI, monorepo). R22 (Storybook) and R23 (Detox) were added on
2026-10-06 at the maintainer's request, to validate screens and run end-to-end tests on a device.
R13 was amended and R13a added on 2026-10-06 for the observability clarifications (FR-030,
FR-030a, FR-039a).

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
  `dark-high-contrast`, ...) are not mapped in this feature (clarified 2026-10-06): React Native
  has no cross-platform API to read the system contrast setting, so nothing would select them,
  and FR-036 already holds WCAG AA in the light and dark themes (Principle IV). They stay in the
  JSON, which remains the single color source Principle V asks for, until a feature selects
  them.
- **Tokens beyond color**: typography uses Paper's MD3 type scale (`theme.fonts.*`), shapes use
  `theme.roundness`. Spacing is not defined by Paper, so the shared module defines spacing
  tokens on Material's 4 dp grid (`spacing.xs = 4` … `spacing.xl = 32`). ESLint's
  `react-native/no-color-literals` and `react-native/no-inline-styles` rules block hard-coded
  colors and ad hoc styles in screens.
- **What a screen may style** (Principle V's "one-off style", clarified 2026-10-06): a file in
  `apps/mobile/src/adapters/ui/screens/` may call `StyleSheet.create` for layout only: flex
  (`flex`, `flexDirection`, `flexGrow`, `flexShrink`, `flexWrap`), alignment (`alignItems`,
  `alignSelf`, `justifyContent`), position, and `margin*`, `padding*` and `gap` whose value
  is a spacing token (`spacing.*`). Every other property (colors, fonts, text, borders, radius,
  shadow, elevation, opacity, sizes) and every number literal other than `0` and the flex
  factors is refused by an ESLint `no-restricted-syntax` rule scoped to `screens/**`. Anything
  visual a screen needs is a shared component (Principle V), styled from theme tokens.
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
- **Durability against power loss** (FR-028, SC-007, clarified 2026-10-06): `openDatabase` sets
  `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = FULL` before migrating, and checks both
  values read back. In WAL mode, `synchronous = NORMAL` (a common default) can lose the last
  committed transactions when power is cut; `FULL` syncs the log to storage at every commit,
  so a change shown as saved survives a power cut. The cost is one storage sync per write, a
  few milliseconds on the reference phones; ticks are shown before their save (R9), so SC-002
  is unaffected.
- **Alternatives considered for durability**: the rollback journal with `synchronous = FULL`
  (also durable, but writers block readers, and WAL keeps reads fast while a save runs);
  `synchronous = EXTRA` (one more sync per transaction for a guarantee only needed on file
  systems that lose directory updates, which neither platform's app storage does).
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
    `text.normalize('NFC').replace(/[\u200B-\u200D\u2060\uFEFF]/gu, '').trim().replace(/\s+/gu, ' ')`. NFC turns a letter followed by a
    combining accent into the single composed character, so "é" is stored the same however it
    was typed; runs of inner white space become one space. `trim()` and `\s` match every
    Unicode space (the non-breaking U+00A0 and narrow U+202F that French typing inserts
    included), tabs and line breaks. The invisible characters U+200B to U+200D, U+2060 and
    U+FEFF are removed first (clarified 2026-10-06), so a name made only of them is blank and
    two names that look the same compare equal; removing the zero-width joiner splits a joined
    emoji such as a family into its parts, an accepted cost for shopping names.
    `validateName` returns the clean name.
  - *Length*: counted in Unicode code points of the clean name (`[...name].length`), which is
    what SQLite's `length()` counts on text, so the domain check and the `CHECK` constraint
    agree (data checklist CHK014). A string's `.length` (UTF-16 units) is never used: an emoji
    would count twice. For the same reason the name field sets no native `maxLength`, which
    counts UTF-16 units; `NameTooLong` is the only limit.
  - *Normalized name*, used for uniqueness (articles, categories, lists, FR-021):
    `cleanName(name).toLocaleLowerCase('fr')`, then "œ" → "oe", "æ" → "ae" and "’" → "'"
    (clarified 2026-10-06): phone keyboards insert the ligature and the curly apostrophe or not
    depending on their settings, so "Oeufs" and "Œufs", or "Pâte d'amande" and "Pâte d’amande",
    are the same name. Accents are kept: "Pâte" and "Pâté" are
    different names. It is stored in a `normalized_name`
    column with a `UNIQUE` constraint, and the domain checks it first so the user gets a typed
    error, not a constraint failure.
  - *Search form*: the normalized name with diacritics removed
    (`normalize('NFD').replace(/\p{M}/gu, '')`), so it inherits the ligature and apostrophe
    folding. The query is matched as a substring. Searching
    runs in the domain over the catalog read into memory: the spec measures the catalog at up to
    1 000 articles (Assumptions), so filtering in memory takes about a millisecond and keeps
    the rule in tested domain code. The add screen loads the catalog once and filters it as the
    user types, without reading storage again (R11a, SC-011). That size is a measurement size, not a limit: nothing is
    refused beyond it (clarified 2026-10-06).
  - *Sorting*: categories by `position`; items within a category unticked first, then ticked,
    each group sorted by name with one shared `compareNames`, built on
    `Intl.Collator('fr', { sensitivity: 'base', numeric: true })` (supported by Hermes); the
    same function sorts the catalog and the lists. `numeric: true` compares digit runs by value,
    so "Lait 2 L" comes before "Lait 10 L" (clarified 2026-10-06). The domain tests pin the
    order under Node, and quickstart step 3 checks it once on each reference phone, since Hermes
    builds its `Intl` on the platform's own collation.
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
  Any other write that succeeds ends the offer, a toggle included, and a new undoable change
  replaces it (the same rule as
  [002's deleted articles](../002-manage-articles/research.md) R5). A write that fails, or input
  refused before or by a use case, changes nothing and leaves the offer as it was (clarified
  2026-10-06). An "Annuler" tapped while the offer shows is carried out with its snapshot, even
  if a write made just before it ends the offer while it waits in the write queue (R9): the user
  chose it while it was offered. Moving between screens does
  not end it. While a screen reader is on (`AccessibilityInfo.isScreenReaderEnabled` and its
  `screenReaderChanged` event), the snackbar has no timeout: it stays until dismissed or the
  next successful write (FR-010), because 5 seconds is too short to reach "Annuler" with TalkBack or
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
  - the store has one write queue (a single promise chain) that every write goes through,
    toggles, removals, "Terminer les courses", undo and creations alike, so changes are saved in
    the order the user made them: a removal or `finishShopping` waits for the toggles tapped
    before it (FR-004, clarified 2026-10-06); quick taps on one item are saved one after the
    other, in tap order;
  - if a toggle's save fails, the store drops the toggles still queued for that item (and only
    those: later writes of other items or other kinds still run), reloads the current
    list region from storage, so the item shows the state last saved, sets the usual `notice`
    ("La modification n'a pas pu être enregistrée.") and reports
    `{ operation: 'toggleItemInCart' }`;
  - `removeItemFromList` reads the item as stored when it runs, so a removal queued behind a
    failed toggle keeps the stored ticked state in its `RemovedItem` snapshot.
- **Rationale**: an expo-sqlite write takes a few milliseconds, but the optimistic update keeps
  the tap feedback independent of storage speed and still never shows a failed change as saved.
  Saving in order makes the stored state after n successful toggles equal to the shown one.
  Reloading rather than flipping back is what makes a failure in the middle of quick taps
  correct: "the previous state" is ambiguous with several taps in flight, the stored state is
  not. Dropping the later toggles keeps the reloaded screen and storage equal. One queue for
  every write, rather than one per item, is what keeps "Terminer les courses" or a removal from
  being overtaken by a toggle tapped before it; a write takes a few milliseconds, and ticks are
  shown before their save, so waiting in one queue never delays what the user sees by more than
  that.
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
  dependency with no measured need; it replaces `SectionList` only if SC-008 is missed on a
  reference phone and profiling shows the list itself is the cause (not a re-render the
  memoization should prevent, T129).
- **Measurement build** (clarified 2026-10-06): SC-001, SC-002, SC-008 and SC-011 are measured on
  one `preview` build from EAS (`eas build --profile preview`, Hermes release bundle, with the
  Sentry DSN, so startup pays the same Sentry initialization as a user's build), built with
  `EXPO_PUBLIC_SEED_ITEMS=200`: the measurement seed (T135) fills it to the spec's data size,
  1 000 articles in the catalog, 20 lists, and 200 items on the current list (Assumptions).
- **Measurement data** (clarified 2026-10-06): shaped like real use, as the spec's Assumptions
  require. The seed holds a base list of 100 common French products spread over the 11
  default categories ("Pommes", "Lait demi-écrémé", "Farine de blé" …) and makes 10 numbered
  variants of each ("Pommes", "Pommes 2" … "Pommes 10"), so the names stay unique and the
  searches of quickstart step 15 find real matches. 100 of the 1 000 names (one variant of
  each product) are lengthened to exactly 60 characters, so rows wrap as long names do. On the
  current list, every other item is ticked and every other pair has a quantity, so ticked
  rows, quantities and both together all appear on screen; each of the 19 other lists holds 50
  items. Everything goes through the use cases, about 2 300 transactions, each synced to
  storage (R4): seeding takes several seconds, once, on the first launch of the measurement
  build, which is not timed (SC-001 applies to launches with existing data).
- **Measurement pace**: the 50 ticks are tapped as fast as the tester can, about 3 per second,
  on different items, so saves are still queued behind each other (R9); the 30 search letters
  are typed as whole words at about 3 letters per second (SC-002, SC-011).
  Both reference phones run it: an entry-level Android phone about five years old and the
  maintainer's iPhone.
- **Measurement conditions**: the screen set to 60 Hz (Android: developer option or the
  display's refresh rate setting; iOS: Accessibility → Motion → Limit Frame Rate, needed only on
  a ProMotion iPhone), airplane mode on, battery saver off, screen reader off, default text size,
  light theme, other apps closed (SC-008, clarified 2026-10-06).
- **Measurement tools**: frames are read with the platform's own tools, not React Native's Perf
  Monitor (which shows only the JavaScript and UI thread rates, not frames missing their display
  deadline): Android's `adb shell dumpsys gfxinfo <package>` ("Janky frames") and Xcode
  Instruments' Animation Hitches on iOS. A dropped frame is one that misses its display deadline
  (SC-008). Tick latency and start time are read on a slow-motion video of the screen, 240
  frames per second, so one video frame is about 4 ms (SC-001, SC-002).
- **A missed target**: any of SC-001, SC-002, SC-008 or SC-011 missed on either phone blocks the
  release until it is met; the miss, its cause and the measurement after the fix are recorded
  in the pull request's test plan (spec Success Criteria, clarified 2026-10-06).

## R11a. The add screen at full catalog size (SC-011)

- **Decision**: the add screen reads the catalog from storage once when it opens (and again
  after a successful write, as every region does, R10), with no query, and keeps that full
  `CatalogView` in the store. Typing in the search field does not read storage again: the store
  filters the loaded view in memory with a pure domain function `filterCatalog(view, query)`,
  synchronously, on every letter, with no debounce and no `loading` state. Each article's
  search form (`searchForm(name)`, R6) is computed once per load, not per letter. Filtering keeps
  the order of the full view, so nothing is sorted again while typing. `getCatalog(listId,
  query?)` stays as specified and applies the same `filterCatalog`, so the use-case tests and the
  store use one rule.
- **Rationale**: SC-011 asks for results within 300 ms of each letter on a five-year-old Android
  phone. Re-reading 1 000 articles through expo-sqlite and sorting them again with the French
  collator on every letter would spend most of that budget on work whose result does not
  change, and could show results of an older query if two reads finished out of order. Filtering
  1 000 precomputed strings by substring takes about a millisecond. It also matches the
  contract, which already says search filters the catalog loaded on the screen and has no
  loading or error state of its own (FR-029). Opening within 1 second covers one read of the
  catalog and one sort, a few tens of milliseconds, and the first screen of a `SectionList`,
  which draws only the rows in view.
- **Alternatives considered**: a debounced storage query (adds a delay every letter pays, and
  still re-sorts); a search index in SQLite (FTS5 does not fold accents and ligatures the way
  FR-009 requires, and duplicates the domain rule in SQL); filtering in the screen component
  (keeps the rule out of the domain, against Principle VI).

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

## R12a. A full device storage (FR-030, edge case)

- **Decision**: the SQLite adapter recognizes a full storage before it drops the error's text
  (R13): the SQLite result code `SQLITE_FULL` (13) when the binding gives one, otherwise the
  engine's fixed message "database or disk is full". It then throws `StorageFull`, with the same
  fixed, content-free message as `StorageError`. `StorageFull` is declared with the driven ports
  (`apps/mobile/src/application/ports/storage-full.ts`), not in the SQLite adapter, so the UI
  adapter can recognize it without importing another adapter (Principle VI). The store treats every failed save
  as before (nothing shown as saved, a failed tick reloaded, a failed "Annuler" or "Terminer
  les courses" as in R8 and R9a), with two differences for `StorageFull`: the notice is
  `storageFull`, shown as "Espace de stockage insuffisant. Libérez de la place sur votre
  téléphone.", and nothing is reported. A full storage at startup is not a save: FR-039 still
  applies (startup error, reported).
- **Rationale**: a full phone is an expected situation the user can fix, and reporting it would
  fill error tracking with noise the maintainer cannot act on. Recognizing it in the adapter
  keeps the rule next to the only code that sees the engine's error.
- **Alternatives considered**: checking free space before each write (a native module, and a
  race with other apps filling the storage); a generic message (rejected in the spec's
  clarification).

## R13. Error tracking (Principle VIII)

- **Decision**: Sentry, through `@sentry/react-native` 8 and its Expo config plugin, behind an
  `ErrorReporter` driven port.
  - The Sentry adapter calls `Sentry.init` with `sendDefaultPii: false`, `maxBreadcrumbs: 0`
    and a `beforeBreadcrumb` that returns `null`, so no JavaScript breadcrumb is ever kept or
    copied to the native layer. Reports carry only the fields FR-030 lists (see "Every report
    filtered" below). User-facing text and list content are never attached; the UI adapter
    reports errors with a fixed, content-free context (screen and operation name).
  - Uncaught exceptions and unhandled rejections are captured by the SDK's global handlers
    (FR-039a); a failure while drawing a screen is caught by the app's error boundary (R13a);
    crashes in native code are captured by the native SDKs (`enableNativeCrashHandling: true`,
    the default, see "Native crashes" below).
  - The DSN comes from `EXPO_PUBLIC_SENTRY_DSN`. When it is absent, the composition root uses a
    console reporter, so nothing reaches the real service. Tests use an in-memory
    `RecordingErrorReporter`.
  - Offline (FR-030a): the SDK stores envelopes on disk and sends them when connectivity
    returns. The adapter sets `maxCacheItems: 30` explicitly, the SDK default, so the spec's
    bound is visible in code and tested; when the cache is full, the SDK deletes the oldest
    envelope, as FR-030a requires. The cache is a folder of files, so it survives the app being
    stopped and the device restarting. Reporting is asynchronous and its failures are swallowed
    by the SDK, so it never blocks or breaks the app.
  - Symbolication (FR-030): the Expo plugin uploads source maps and native debug files during
    EAS Build, so a release build's stack trace names source files and functions (the Sentry
    build credential is stored by the maintainer as an EAS environment variable with `secret`
    visibility). No automated test sees a real report, so this is a manual check before release
    ([quickstart.md](quickstart.md) §6).
- **Environments** (FR-030, clarified 2026-10-06): each EAS Build profile sets
  `EXPO_PUBLIC_APP_ENVIRONMENT` in `eas.json`: `production` for store releases, `preview` for
  internal builds installed on a phone. The DSN is an EAS environment variable defined for the
  EAS `production` and `preview` environments only. Development runs, Jest and the Detox builds
  have no DSN, so they use the console reporter and send nothing (the Detox build command also
  unsets it, T012). The adapter passes `EXPO_PUBLIC_APP_ENVIRONMENT` as Sentry's `environment`,
  and refuses to start Sentry (console reporter instead) when a DSN is present without one of
  the two values, so a report never carries an unknown environment.
- **Version** (FR-030, clarified 2026-10-06): the release is `mes-courses@<version>+<build>` and
  `dist` is the build number, both read by the SDK from the native app at startup, its default
  for a native build, so no code and no dependency is added. Every EAS build gets its own number: `eas.json` sets `cli.appVersionSource: remote` and
  `autoIncrement: true` on the `production` and `preview` profiles. Sentry shows it as
  "1.2.0 (42)", and source maps are uploaded for that release and `dist`, so each report finds
  the maps of its own build.
- **No identifier and no device name** (FR-030): `beforeSend` removes `event.user` whole and
  keeps from the device context only the model and, from the OS context, the name and version;
  the device's own name, which the owner sets, is never kept. Release health sessions carry a
  per-installation id and are not events, so `beforeSend` never sees them: the adapter sets
  `enableAutoSessionTracking: false`. App hang reports are native events too and add nothing
  FR-030 asks for: `enableAppHangTracking: false`.
- **Native crashes** (FR-030, clarified 2026-10-06): they are reported, as the spec's one
  exception to "no identifier".
  - They are built by the Android and iOS SDKs, not in JavaScript, so they do not pass through
    the JavaScript `beforeSend`; on Android, the SDK fills `user.id` with a random installation
    id when none is set
    ([sentry-react-native#2209](https://github.com/getsentry/sentry-react-native/issues/2209)),
    which FR-030 now allows. That id is regenerated when the app is reinstalled.
  - The device name stays out without native code: the Android SDK does not send it by
    default, and since iOS 16 an app reads the owner's device name only with an entitlement
    this app does not request, so iOS gives the SDK the generic model name.
  - No list content can reach them: the app writes no JavaScript breadcrumb (above), and the
    only scope data it sets is the two global tags below, both fixed identifiers, which the SDK
    copies to the native scope.
  - Operation and screen: the adapter sets a global `operation` tag to `uncaught` at init and a
    global `screen` tag on every `setScreen`; native crashes carry both. A `report` call passes
    its own tags for that one event, which take precedence.
  The manual check in quickstart §6 crashes a release build in native code and confirms the
  report holds no device name, no list content and no identifier other than the installation
  one.
- **One report per failure, and its operation and screen** (FR-030): the UI adapter catches an
  unexpected error, reports it and does not rethrow it, so the global handlers never see it a
  second time; the error boundary does the same (R13a). Every report names an operation and a
  screen: the UI adapter passes both; an error the global handlers catch carries the global
  `operation` (`uncaught`) and `screen` tags, the screen being the route shown, which the
  navigation container passes to the reporter on every route change (`setScreen`,
  [contracts/driven-ports.md](contracts/driven-ports.md#errorreporter)).
- **Once per opening** (FR-030, clarified 2026-10-06): the last step of `beforeSend` computes the
  signature `type | code | operation | screen` of the filtered event and drops the event when
  that signature was already sent; the signatures live in a `Set` in memory. The reporter is built once, before the
  composition root (T061), and "Réessayer" (R18a, R13a) reruns only the composition root, so the
  set lasts exactly from opening to stop, as the spec requires. Because the rule sits in
  `beforeSend`, it covers `report` calls and the global handlers alike. Native crashes end the
  process, so the next report comes from a new opening. The application code still calls
  `report` on every failure; the adapter alone decides not to send. `RecordingErrorReporter`
  records every call, so application tests keep asserting that each failure is passed to the
  reporter, and the adapter's tests assert the drop.
- **Expected situations** (FR-030, clarified 2026-10-06): exactly the three the spec lists, each
  already handled without a report: `StorageFull` (R12a), `DataFromNewerVersion` (R18c), and the
  `Result` errors that use cases return for refused input (`NameRequired`, `NameTooLong`,
  `NameAlreadyUsed` and the `QuantityError` union, plus `AlreadyOnList` from `addArticleToList`,
  which US2-8 shows as a choice), which the store returns to the form without calling `report` (T049). Any other
  `Result` error (a missing record or the wrong state) and anything thrown is unexpected and
  reported; the store reports such a result as an `UnexpectedResult` error whose code is the
  result's tag ([contracts/driving-ports.md](contracts/driving-ports.md#conventions)). For a JavaScript error,
  the error type is its `name` and the error code its `code` property when it has one (the
  SQLite result code for `StorageError`), and no code otherwise.
- **Delivery within 1 minute** (SC-010, clarified 2026-10-06): with the network on, the SDK sends
  an event as soon as it is captured. A report stored offline is sent by the native SDKs, which
  send their stored envelopes at startup and, while the app runs, when the system says the
  network is back (connection status on Android, reachability on iOS); a native crash is stored
  when it happens and sent at the next startup. The app adds no code for this. That the SDK
  version used meets the 1-minute limit in each case is measured by the manual check
  (quickstart §6, steps 1, 4 and 5). If a platform misses it, the fix is an explicit flush when
  the network returns, which needs a network status dependency: it is proposed to the
  maintainer then (Principle IV), not added in advance.
- **Alerts** (FR-030c, clarified 2026-10-06): configured in Sentry, not in the app. The project
  has two issue alert rules, both filtered on the `production` environment and sending an email
  to the maintainer: "a new issue is created" and "an issue changes state from resolved to
  unresolved". Sentry groups events into issues by stack trace and type, close to the spec's
  "same kind of failure"; the adapter also sets the fingerprint to the FR-030 key
  (`type | code | operation | screen`), so one kind of failure is exactly one issue. The default
  alert rule Sentry creates with a project is deleted, and the maintainer's personal workflow
  notifications are turned off, so no other email is sent; `preview` matches no rule. The
  README lists these settings, and quickstart §6 step 7 checks them once.
- **Every feature, one reporter** (FR-030b, clarified 2026-10-06): 002 and 003 report through the
  same `ErrorReporter` and the same Sentry adapter, so FR-030 and FR-030a hold for them with no
  extra code. A later feature adds its expected situations by not calling `report` for them
  (for example 003's offline sync), never by changing the filter.
- **Disclosure** (spec Assumptions): the app shows no notice and no setting. If it is published
  on a store, its privacy details declare crash data and a random installation identifier,
  neither linked to the user nor used for tracking (Google Play "Crash logs" and "Device or
  other IDs", App Store "Crash Data" and "Device ID", not linked to the user); the README tells
  the maintainer.
- **No storage error text in reports** (FR-030): the SQLite adapter catches every error thrown by
  the database (in `openDatabase`, `migrate`, the repositories and `SqliteUnitOfWork`) and
  rethrows a `StorageError` whose message is fixed and content-free ("Storage operation
  failed"), carrying only the SQLite result code when the original error has one. Its stack
  trace is its own, captured where the adapter rethrows, which points at the failing repository
  call; the original stack is not copied, because a JavaScript stack string starts with the
  original message. The original error is not attached as `cause` either, so its text never
  reaches a report. Every storage failure the UI adapter or the global handlers report is
  therefore already clean.
- **Every report filtered** (FR-030): uncaught exceptions and display errors keep their own
  message, which may quote a value being shown, so the Sentry adapter filters every JavaScript
  event in `beforeSend`. It empties `exception.values[].value` and `message`, and keeps only the
  fields FR-030 lists: error type, error code, stack trace, operation, screen, app version
  (release and `dist`), device model and system version, and environment. Every other context,
  extra, tag, user field and breadcrumb is removed, the device's own name included.
- **Rationale**: Sentry has first-party React Native and Expo support covering every Principle
  VIII requirement (offline cache, symbolication, release tagging) and a free tier fitting a
  personal app. Native crashes need no native code of ours: the spec accepts their installation
  id, and the platforms already keep the device name out.
- **Alternatives considered**: Bugsnag (similar, less integrated with Expo); Firebase Crashlytics
  (needs a Firebase project and native setup; weaker on JS errors). For native crashes: a
  `beforeSend` written in Kotlin and Swift through a config plugin would remove the
  installation id too, but adds native code the spec does not require; turning native crash
  handling off (this plan's first choice) was rejected in the spec's clarification. For the
  once-per-opening rule: Sentry's `Dedupe` integration only drops an event identical to the one
  just before it, so a failure alternating with another would still be sent many times; a
  wrapper around `report` would miss the global handlers.

## R13a. A screen that fails while drawing, and errors nothing catches (FR-039a)

- **Decision**: `App.tsx` wraps the navigation in `AppErrorBoundary`, a React error boundary in
  the UI adapter (`apps/mobile/src/adapters/ui/components/app-error-boundary.tsx`). When a
  screen throws while rendering, it reports the error through `ErrorReporter` with
  `{ operation: 'render', screen }`, the screen being the route shown, and replaces the whole
  app with `CrashError`, a full-screen view built on the shared `ErrorState`: "Une erreur est
  survenue." and "Réessayer". "Réessayer" goes through the same restart as the startup error
  (R18a): close the database, then run the composition root again from the start, with
  `LoadingState` meanwhile; it never deletes or resets data. If the screen fails again, the
  error is passed to the reporter again and `CrashError` shows again; the reporter sends the
  same failure only once per opening (R13).
  - Errors thrown outside rendering (an event handler, a promise nobody awaits) do not reach an
    error boundary. They are reported by the SDK's global handlers with `operation: 'uncaught'`
    (R13) and show nothing new: the user goes on with the app, as FR-039a only requires the
    report.
  - A failure during startup is still the startup error (R18a), shown before the navigation and
    its boundary exist.
- **Rationale**: React offers no other way to catch a rendering failure, and a boundary at the
  root is the smallest one that covers every screen. Reusing the startup restart gives one
  recovery path and one "no data deleted" rule to test.
- **Alternatives considered**: `Sentry.ErrorBoundary` (would put the SDK in the UI adapter and
  report outside the port, untestable with `RecordingErrorReporter`); one boundary per screen
  (rejected in the spec's clarification: the whole app is replaced).

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
  - in both rules above, an npm package is refused even for a type-only import (`import type`).
    This is stricter than Principle VI's "library with side effects" on purpose: the project
    then never has to judge whether a library has side effects, and nothing in 001 needs one.
    The only exception, added by [003](../003-server-sync/research.md) for `@mes-courses/sync-core`,
    is a shared workspace package listed as pure in `.dependency-cruiser.cjs`: no framework, no
    side effects, and importing only other pure packages, which its own rule checks
    (Principle XI). No shared package exists in 001, so the list starts empty;
  - anything outside `apps/mobile/src/adapters/**`, `apps/mobile/src/composition/**`,
    `apps/mobile/App.tsx` and the adapter test helpers in `apps/mobile/test/` imports from
    `apps/mobile/src/adapters/**`. `apps/mobile/test/sqlite/` implements the SQLite adapter's
    `SqlDatabase` for its tests; the rule that production code never imports a testing helper
    keeps it out of the app. `App.tsx`, the Expo entry,
    is part of the composition root: it builds the use cases and renders the UI adapter;
  - a file in one adapter (`apps/mobile/src/adapters/<name>/**`) imports from another adapter
    (`sqlite`, `ui`, `error-reporting`, `id`): adapters never import each other, not even types.
    An error the UI adapter must recognize is declared in `apps/mobile/src/application/ports/`
    (`StorageFull`, R12a; `DataFromNewerVersion`, R18c);
  - anything other than `apps/mobile/App.tsx`, `apps/mobile/App.test.tsx` and
    `apps/mobile/src/composition/**` imports from `apps/mobile/src/composition/**`, so the
    composition root stays the only code that knows every adapter;
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
  merge rule of the constitution's Quality Gates (v2.1.1) applies: no pull request is merged
  while any job is failing, pending or skipped, as `gh pr checks` shows. Detox adds a fifth job,
  `e2e-android` (R23).
- **Time limits** (clarified 2026-10-06): every job sets `timeout-minutes`: 15 for `typecheck`,
  `lint`, `test` and `build`, 45 for `e2e-android`. A job that runs out of time is a failing
  job, fixed in the pull request like any other.
- **What `build` proves**: the JavaScript bundles for both platforms, not a native build. An
  Android native build failure is caught by `e2e-android`, which builds the release APK; an iOS
  native build failure is caught by the iOS device suite, run on the maintainer's Mac on every
  pull request that changes native configuration and before each release (R23, R24).
- **Third-party actions**: `nix-installer-action`, `magic-nix-cache-action` and
  `android-emulator-runner` are assumed available. If the cache action stops working, its step
  is removed and the jobs run without a Nix cache, slower but unchanged; the others have no
  replacement planned until needed (Principle IV).
- **Not in CI, by decision**: scanning for leaked credentials stays the local Talisman pre-commit hook required
  by the workspace `AGENTS.md`, and dependencies are updated by hand (an Expo SDK upgrade is its
  own pull request through every gate), with no update bot (Principle IV).
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
  and runs the composition root again from the start; each failure is passed to the reporter,
  which sends the same failure only once per opening (R13). The root
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
    any read or write. Like `StorageFull` (R12a), the error is declared with the driven ports
    (`apps/mobile/src/application/ports/data-from-newer-version.ts`), since adapters never
    import each other (R15). `App.tsx` shows the full-screen `UpdateRequired` view: "Cette version de
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
  written down so a later change is deliberate), and no backup rule excludes the
  database (003 adds one that excludes only the secure storage holding the device credential). Android Auto Backup then includes the expo-sqlite file (well under its 25 MB
  limit), and on iOS the file lives in the app's Documents folder, which the iCloud device
  backup includes; quickstart step 14 checks both platforms before the first release. No
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

## R24. Releases and distribution (spec Success Criteria, Assumptions)

- **Decision** (clarified 2026-10-06):
  - **A release** is every `production` build from EAS (`eas build --profile production`), the
    only builds meant for users. Before one is built, every manual check of the spec's Success
    Criteria and the iOS device suite have succeeded on the last commit of the pull request that
    last changed the application, recorded in its test plan. The release is built from that pull
    request's squash commit on `main`, with no other change merged after it, so it holds the
    same code the checks ran on. `preview` and `development` builds are not releases.
  - **Distribution**: no public listing. The `production` profile builds an Android App Bundle
    and an iOS App Store build, sent by `eas submit` to Google Play's internal testing track and
    to TestFlight, from where the maintainer's phones install and update the app. Google Play
    requires the very first upload of an app to be made by hand in the Play Console; every later
    one goes through `eas submit`. The credentials (a Google Play service account and an App
    Store Connect API access file) live in EAS, set by the maintainer, never committed, and no CI job
    reads them.
  - **Version**: `version` in `apps/mobile/app.config.ts` follows semantic versioning, changed by
    hand in the pull request that leads to a release: MINOR for a new feature, PATCH for fixes
    only. This feature ships as 1.0.0. The build number stays remote and auto-incremented (R13).
  - **Test-only options guard**: `app.config.ts` calls a pure function
    `assertNoTestOptionsInProduction(env)` from `apps/mobile/build-config/release-guard.ts`.
    When `EXPO_PUBLIC_APP_ENVIRONMENT` is `production` and any of `EXPO_PUBLIC_SEED_ITEMS`,
    `EXPO_PUBLIC_SENTRY_SMOKE_TEST` or `STORYBOOK_ENABLED` is set (non-empty), it throws an
    error naming each one, so the build stops while reading its configuration. The function is
    tested first under Jest, with no build.
  - **Node on EAS**: every profile in `eas.json` sets `"node"` to the version the flake
    provides (Node 24, R21), so native builds use the same Node as local work and CI.
  - **A faulty release** is fixed forward: a new `production` build with the fix, through a pull
    request and every pre-release check. No rollback is offered: neither testing channel rolls an
    installed app back, and an older version does not open newer data (FR-040).
- **Rationale**: tying the gates to the `production` build makes "before each release" a step
  that cannot happen by accident. The stores' testing channels install and update the app like a
  public listing would, with no review queue and no listing to maintain for a single user. A
  guard that stops the build turns a README warning into something that cannot be missed, and
  keeping it a pure function keeps it testable first (Principle I). Fixing forward is the only
  path both channels and FR-040 allow.
- **Alternatives considered**: the version change or the store submission as the release event
  (both leave builds meant for users ungated); installing directly (Android APK, iOS ad hoc
  through EAS internal distribution: needs each iPhone's device id registered and gives no
  update path); a runtime check that ignores the options in `production` (too late: the build
  already holds them); a shortened check for urgent fixes (a faulty release is exactly when the
  checks matter).

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
