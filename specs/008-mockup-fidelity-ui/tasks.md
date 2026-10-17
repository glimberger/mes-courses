---
description: "Task list for feature 008-mockup-fidelity-ui"
---

# Tasks: Mockup-Faithful UI

**Input**: Design documents from `specs/008-mockup-fidelity-ui/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md` (R1–R10), `data-model.md`,
`contracts/ui-building-blocks.md`, `quickstart.md`, and a green fast suite on the feature branch
`feat/008-mockup-fidelity-ui`.

**Tests**: Required by the constitution (Principles I, II, III) and by the success criteria
(SC-003, SC-004, SC-005, SC-006). There is no test-only task: every task carries its own test and
its implementation. Inside a task, write the failing test first, see it fail for the expected
reason, implement the minimum, then refactor with the whole suite green. Every commit leaves the
fast suite, the required-story test, the architecture test, lint and the TypeScript checks green.

**Organization**: Tasks are grouped by user story. Phases follow priority (P1, then P2, then P3);
story labels keep the spec's numbering (`US1` … `US10`). The change is presentational only
(FR-012): no domain, application, navigation, storage or sync code changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to
- Every task names the exact file(s) it touches

## Path conventions

All app paths are relative to `apps/mobile/`; `ui/` below means `apps/mobile/src/adapters/ui/`.

- Color export: `design/material-theme.json`; reference tokens: `design/mockups/styles.css`;
  reference captures: `design/mockups/shots/`
- Icon generation: `design/icons/build-symbols.sh`; generated fonts:
  `apps/mobile/assets/fonts/`; icon module: `ui/icons/`
- Theme modules: `ui/theme/`; shared blocks: `ui/components/`; screens and dialogs: `ui/screens/`
- Tests and stories sit next to the code they cover (`*.test.ts(x)`, `*.stories.tsx`); required
  story ids: `ui/required-stories.ts`

## Rules that apply to every task

- **Mockup wins** for layout, colors, radii, spacing, icons, sizes and weights; **the app wins**
  for texts, accessible labels, `testID`s, roles, focus moves and announcements (FR-012, R9).
  Never rename a label or `testID`; never change a French string.
- **Colors**: only theme roles; `react-native/no-color-literals` stays green; every new
  foreground/background draw is added to `ui/theme/used-color-pairs.ts` (Principle V, FR-014).
- **Shadows**: only the `ui/theme/elevation.ts` tokens; no `elevation` style and no
  `Surface elevation` in a shared block (contract "Global rules").
- **Typography**: weight is chosen by font file (`Nunito_600SemiBold`, `Nunito_700Bold`,
  `Nunito_800ExtraBold`) through a Paper type role, never by `fontWeight`.
- **Screens are layout only** (existing ESLint rule on `ui/screens/**`): the look lives in shared
  blocks; a mockup measure that is not a `spacing` token is a named constant inside the
  component (for example `ROW_MIN_HEIGHT = 64`).
- **Accessibility**: every interactive element ≥ 48 × 48 dp; no `numberOfLines` on titles, names
  or messages; text wraps at 200 % (FR-013).
- **Component tests** assert rendered styles from public props (role color, radius, font family,
  shadow token, size), never a snapshot of private structure (R10).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The icon generation tool and its decision record, used by every later icon task.

- [X] T001 Create `design/icons/build-symbols.sh` (bash, `set -euo pipefail`, shellcheck-clean): download *Material Symbols Rounded* variable TTF from `google/material-design-icons` at a pinned commit into a temp dir, verify its SHA-256 against a constant in the script and exit non-zero on mismatch, run `fonttools varLib.instancer` through `nix shell nixpkgs#python3Packages.fonttools` to make two static instances (`FILL=0 wght=500 GRAD=0 opsz=24`, and `FILL=0 wght=700 GRAD=0 opsz=24`), subset them with `pyftsubset` to the symbol names read from a plain list file `apps/mobile/src/adapters/ui/icons/symbols.txt` (instance 500: every name; instance 700: `check` only), write `apps/mobile/assets/fonts/MaterialSymbolsRounded_500.ttf`, `apps/mobile/assets/fonts/MaterialSymbolsRounded_700.ttf` and `apps/mobile/src/adapters/ui/icons/symbols-glyphs.json` (name → code point, keys sorted, so a rerun on an unchanged list leaves no diff). Seed `symbols.txt` with the symbol names of data-model.md "Icon set" (`shopping_cart_checkout`, `format_list_bulleted`, `settings`, `add`, `edit`, `close`, `check`, `more_vert`, `chevron_right`, `search`, `visibility`, `visibility_off`, `account_circle`, `dns`, `smartphone`, `sync`, `logout`, `delete`, `person_add`, `shopping_basket`, `error`, `cloud_done`, `cloud_upload`, `cloud_sync`, `cloud_alert`, `cloud_off`, `pause_circle`, `update`, `arrow_back`, `arrow_drop_down`, `remove`; T010 adds any name its call-site scan finds missing), run the script, commit the generated files. Verify with `shellcheck design/icons/build-symbols.sh` and a second run showing `git status` clean
- [X] T002 [P] Write `docs/adr/0012-material-symbols-icons.md` from `docs/adr/0000-template.md`: decision "Material Symbols Rounded weight 500 (check at 700), bundled static subsets generated by `design/icons/build-symbols.sh`, rendered through `createIconSet` and Paper `settings.icon`", context and alternatives from research.md R5 (SVG package, React Navigation 8 symbols, `MaterialIcons` weight 400); add it to the index in `docs/adr/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Theme tokens, the icon set and the base building blocks every story composes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Theme tokens

- [X] T003 Update `design/material-theme.json` per data-model.md "Color roles" and drive it with a new SC-004 test in `ui/theme/theme.test.ts` that parses the `:root` and `body.dark` blocks of `design/mockups/styles.css` and asserts each token equals its mapped role ("Mockup token → role map": `--bg`→`surface` and `background`, `--card`→`surfaceContainerLowest`, `--container`→`surfaceContainer`, `--on-surface`→`onSurface`, `--on-surface-var`→`onSurfaceVariant`, `--muted`→`outline`, `--hairline`→`surfaceContainerHigh`, `--primary`→`primary`, `--yellow`→`primaryContainer`, `--on-yellow`→`onPrimaryContainer`, `--yellow-soft`→`brandSoft`, secondary/tertiary container pairs, `--error`→`error`, inverse roles; "a token absent from `body.dark` keeps its light value in dark") in the light and dark schemes. Changes: dark `surfaceContainerLowest` `#100E07`→`#1E1B13`, dark-medium-contrast `#090703`→`#201D15`, dark-high-contrast `#000000`→`#222017`; new `brandSoft`/`onBrandSoft` in all six schemes (light `#FFF1BE`/`#6D5E0F`, light-medium-contrast `#FFF1BE`/`#403600`, light-high-contrast `#FFF1BE`/`#352C00`, dark `#3A3200`/`#DBC66E`, dark-medium-contrast `#3A3200`/`#F2DC82`, dark-high-contrast `#3A3200`/`#FFF0BA`); `scrim` `#000000`→`#141108` in all six; `shadow` `#000000`→`#1E1B13` in the three light schemes only (FR-003, FR-003a, FR-003b, FR-003c)
- [X] T004 Merge the new roles in `ui/theme/theme.ts` (depends on T003): `brandSoft`/`onBrandSoft` typed in `SchemeRole` and present on the light and dark Paper themes; derived `backdrop` becomes `scrim` at alpha 0.36 (was 0.4). Test first in `ui/theme/theme.test.ts`: both themes expose `brandSoft` equal to the export, and `backdrop` equals `scrim` at 0.36
- [X] T005 [P] Add contrast pairs to `ui/theme/used-color-pairs.ts` (depends on T004): `onBrandSoft`/`brandSoft` (graphic), `onSecondaryContainer`/`secondaryContainer` (text), `onPrimaryContainer`/`surfaceContainerLowest` (graphic) and `primaryContainer`/`surfaceContainerLowest` (graphic, "the test asserts at least one of the two passes per scheme"), `inverseOnSurface`/`inverseSurface` (text), `inversePrimary`/`inverseSurface` (text), `onError`/`error` (text). Extend the WCAG test in `ui/theme/theme.test.ts` with the either-of-two rule for the checkbox pair, light and dark (SC-005)
- [X] T006 [P] Add radius tokens to `ui/theme/shape.ts`, test first in `ui/theme/shape.test.ts`: `checkbox` 7, `field` 14, `lg` 16, `fab` 18, `xl` 28, `pill` 9999, `bar` 2 (keep existing `xs` 4 and `md` 12)
- [X] T007 [P] Create `ui/theme/elevation.ts` exporting `shadows(theme)` that returns React Native `boxShadow` strings built from theme roles only (research.md R3), test first in `ui/theme/elevation.test.ts` (light and dark): `card` = `shadow` at 0.05 `0 1 2` + 0.06 `0 6 16` in light, 0.35 + 0.30 same offsets in dark; `fab` = `onPrimaryContainer` at 0.20 `0 4 12` + 0.14 `0 1 3`; `dialog` = `shadow` at 0.24 `0 14 36` + 0.12 `0 2 6`; `snackbar` = `scrim` at 0.26 `0 6 18` + 0.16 `0 1 3`; `brandTile` = `onPrimaryContainer` at 0.14 `0 10 28`. No color literal

### Icon set

- [ ] T008 Create the icon module (depends on T001): `ui/icons/aliases.ts` (map of Paper internal names → symbols: `magnify`→`search`, `close`→`close`, `arrow-left` and `chevron-left`→`arrow_back`, `menu-down`→`arrow_drop_down`, `check`→`check`, `minus`→`remove`, `eye`→`visibility`, `eye-off`→`visibility_off`, `alert-circle`→`error`) and `ui/icons/AppIcon.tsx` (`createIconSet(symbols-glyphs.json, 'MaterialSymbolsRounded_500', …)`, plus an `AppIcon` variant `weight={700}` that uses `MaterialSymbolsRounded_700`), resolving a name through the alias table first. Test first in `ui/icons/app-icon.test.tsx`: every alias target and every line of `symbols.txt` resolves to a glyph in `symbols-glyphs.json`; an unknown name fails the test listing it
- [ ] T009 Wire the icon set (depends on T008): register `MaterialSymbolsRounded_500` and `MaterialSymbolsRounded_700` in the existing `useFonts` call of `apps/mobile/App.tsx` next to the Nunito files, and pass `settings={{ icon: AppIcon-adapter }}` to `PaperProvider` in `ui/theme/theme-provider.tsx`. Test first in `ui/theme/theme-provider.test.tsx`: a Paper `IconButton icon="magnify"` renders the `MaterialSymbolsRounded_500` family with the `search` glyph; a static scan of `apps/mobile/App.tsx` asserts that every font passed to `useFonts` is a local `require('./assets/fonts/…')`, never a URL (FR-015)
- [ ] T010 Switch every call-site icon name to its Material Symbol (depends on T009), per data-model.md "Icon set": `cart-check`→`shopping_cart_checkout`, `format-list-bulleted`→`format_list_bulleted`, `cog`→`settings`, `plus`→`add`, `pencil-outline`→`edit`, `dots-vertical`→`more_vert`, `eye-outline`/`eye-off-outline`→`visibility`/`visibility_off`, `account`→`account_circle`, `server-network`→`dns`, `delete-outline`→`delete`, `account-plus`→`person_add`, `basket-outline`→`shopping_basket`, `alert-circle-outline`→`error`, sync statuses `cloud-check-outline`→`cloud_done`, `cloud-clock-outline`→`cloud_upload`, `progress-upload`→`cloud_sync`, `cloud-alert-outline`→`cloud_alert`, `cloud-off-outline`→`cloud_off`, `pause-circle-outline`→`pause_circle`, `update`→`update`. Files: `ui/screens/CurrentListScreen.tsx`, `ui/screens/ListsScreen.tsx`, `ui/screens/AddArticlesScreen.tsx`, `ui/screens/SettingsScreen.tsx`, `ui/screens/AccountsScreen.tsx`, `ui/screens/DeviceRow.tsx`, `ui/components/ListItemRow.tsx`, `ui/components/ArticleRow.tsx`, `ui/components/ScreenFab.tsx` callers, `ui/components/SyncStatusBar.tsx`, `ui/components/EmptyState.tsx`, `ui/components/ErrorState.tsx`, `ui/components/PasswordField.tsx`, and any other hit of `grep -rnE "icon(=|:)|source=" apps/mobile/src/adapters/ui`. Extend `ui/icons/app-icon.test.tsx` to collect every icon name literal under `ui/components` and `ui/screens` (static scan of the source files) and assert each resolves to a glyph; add any missing name to `symbols.txt` and rerun T001's script

### Base building blocks

- [ ] T011 [P] Create `ui/components/Card.tsx` (depends on T006, T007), test first in `ui/components/card.test.tsx`: background `surfaceContainerLowest`, radius `lg` (16), `boxShadow` = `shadows(theme).card`, no `elevation`; `outlined` prop draws a 2 dp `primaryContainer` inner border; light and dark
- [ ] T012 [P] Create `ui/components/Chip.tsx` (depends on T006, T009), test first in `ui/components/chip.test.tsx`: stadium (`pill`), padding 5/12, gap 5, optional icon 16, text `labelMedium`; tones `secondary` (`secondaryContainer`/`onSecondaryContainer`), `tertiary` (`tertiaryContainer`/`onTertiaryContainer`), `brand` (`primaryContainer`/`onPrimaryContainer`); text wraps (no `numberOfLines`). Add `Components/Chip/Secondary`, `Components/Chip/Tertiary`, `Components/Chip/Brand` stories in `ui/components/Chip.stories.tsx` and their ids in `ui/required-stories.ts`
- [ ] T013 Rework `ui/components/Button.tsx` (depends on T006, T012: both edit `ui/required-stories.ts`), test first in `ui/components/button.test.tsx`: every mode stadium (`pill`); height 50, or 44 with `size="compact"`; label `labelLarge` (14.5 when compact or `text`; T020 moves this size to `typeOverrides.compactLabel`); icon 20; modes `brand` (`primaryContainer` fill, `onPrimaryContainer` text), `outlined` (1.5 dp `outline` border, `primary` text), `danger` (1.5 dp `error` border, `error` text and icon), `dangerFilled` (`error` fill, `onError` text), `text` (`primary` text, horizontal padding 14); touch target ≥ 48 dp in every mode; existing callers keep their props (map any former mode name to the new set inside the component). Add `Components/Button/{Brand,Outlined,Danger,DangerFilled,Text}` stories in a new `ui/components/Button.stories.tsx` and their ids in `ui/required-stories.ts`
- [ ] T014 [P] Rework `ui/components/IconCircle.tsx`, test first in `ui/components/icon-circle.test.tsx`: sizes 44 (icon 24) and 56 (icon 28); tone `brand` default (`brandSoft` fill, `onBrandSoft` icon) and `error` (`errorContainer`/`onErrorContainer`); decorative (hidden from accessibility)
- [ ] T015 [P] Rework `ui/components/CategoryHeader.tsx` (depends on T006), test first in `ui/components/category-header.test.tsx`: bar 4 × 16 dp, radius `bar`, `primaryContainer`; gap 9; text `titleSmall` `onSurfaceVariant`; padding 18 top, 9 bottom, 20 sides; accessibility role `header` kept; the title wraps
- [ ] T016 Create `ui/components/ScreenHeader.tsx` (depends on T012, T010), test first in `ui/components/screen-header.test.tsx`: inside the top safe-area inset; variant `large` = title `headlineMedium` `onSurface` start-aligned, optional `chip` slot 6 dp below, trailing `actions` (`AppbarIconAction`), padding 14 top, 10 bottom, 20 start, 8 end, optional `titleVariant="titleLarge"` (add-articles); variant `center` = title `titleLarge` centered; optional `back` action at the start with a 48 dp target; title is an accessibility header and never truncated (no `numberOfLines`). Update `ui/components/AppbarIconAction.tsx` (48 dp circle, icon 24 `onSurfaceVariant`) and `ui/components/BackAction.tsx` (`arrow_back`, no Paper `Appbar.BackAction` dependency on the header) under the same test. Add `Components/ScreenHeader/{Large,LargeWithChip,Center,CenterWithBack}` stories and required ids
- [ ] T017 [P] Create the shared field style helper `fieldStyle(context: 'screen' | 'dialog')` in `ui/components/field-style.ts` (depends on T006), test first in `ui/components/field-style.test.ts`: Paper outlined `TextInput` props with `outlineStyle` radius `lg` (screen) or `field` 14 (dialog), outline width 1.5 dp `outline`, label `labelSmall` `onSurfaceVariant`, text `bodyLarge` `onSurface`, trailing icon color `onSurfaceVariant`

**Checkpoint**: tokens, icons and base blocks in place; stories can start.

---

## Phase 3: User Story 1 – Read the brand typeface with its full range of weights (Priority: P1) 🎯 MVP

**Goal**: Every text renders Nunito at the mockup size and weight (FR-002, SC-003).

**Independent Test**: Open each primary screen next to its mockup capture and compare text weights:
titles, names, headings, chips, buttons, secondary lines.

- [ ] T018 [US1] Create `ui/theme/typography.ts` and use it in `ui/theme/theme.ts` in place of the 007 font mapping, test first in `ui/theme/theme.test.ts` (SC-003): every Paper MD3 role uses a Nunito family file, never `Nunito_400Regular`, and matches data-model.md "Type scale" — `display*` Material default size at 800; `headlineLarge` 32/800; `headlineMedium` 28/800, letter-spacing −0.2; `headlineSmall` 24/800; `titleLarge` 22/800, letter-spacing −0.2; `titleMedium` 16.5/700; `titleSmall` 14/800, letter-spacing 0.2; `bodyLarge` 16/600; `bodyMedium` 15/600, line height 1.45 × size; `bodySmall` 13/600; `labelLarge` 15.5/800; `labelMedium` 13/700; `labelSmall` 12.5/700; line height = size × 1.25 rounded elsewhere; `fontWeight` left unset so the file carries the weight; `Nunito_400Regular` stays registered only as Paper's `default` fallback; `typography.ts` also exports `typeOverrides`, the mockup sizes that sit outside the scale, each as a role plus a size (and a family when it differs): `quantity` (`labelMedium`, 13.5), `compactLabel` (`labelLarge`, 14.5), `snackbarMessage` (`bodyMedium` size, `Nunito_700Bold`), `syncStrip` (14, `Nunito_700Bold`), `emptyCategory` (14, `Nunito_600SemiBold`); the test asserts each value against data-model.md "Type scale"
- [ ] T019 [US1] Make inputs and placeholders use Nunito (depends on T018, T017): `fieldStyle` passes the `bodyLarge` family to `TextInput` content and placeholder; `ui/components/SearchField.tsx` text uses `bodyLarge`. Test first in `ui/components/field-style.test.ts` and `ui/components/name-field.test.tsx`: the rendered input and its placeholder carry `Nunito_600SemiBold`
- [ ] T020 [US1] Remove every leftover typography override that defeats the scale (depends on T018): grep `ui/components` and `ui/screens` for `fontWeight`, `fontFamily` literals and `Nunito_400Regular`, replace each with the matching Paper `variant` from the type scale or a `typeOverrides` entry (including the compact `Button` size from T013). Drive it with a test in `ui/theme/typography-usage.test.ts` that statically scans `ui/components/**/*.tsx` and `ui/screens/**/*.tsx` and fails on `fontWeight:`, `Nunito_400Regular`, or a numeric `fontSize:` literal (sizes come from the type roles or `typeOverrides`)

**Checkpoint**: US1 verifiable on every screen; the type scale is the MVP increment.

---

## Phase 4: User Story 2 – Shop from a list that looks like mockup 1 (Priority: P1)

**Goal**: The current list matches `shots/1-liste.png`.

**Independent Test**: Open a list with articles in several categories, some checked, some with a
quantity, one long name; compare with `design/mockups/shots/1-liste.png`.

- [ ] T021 [P] [US2] Create `ui/components/BrandCheckbox.tsx` (depends on T006, T009), test first in `ui/components/brand-checkbox.test.tsx`: 24 dp box inside a ≥ 48 dp target, radius `checkbox` (7), 2 dp border; unchecked = `outline` border, transparent fill; checked = `primaryContainer` fill, `onPrimaryContainer` border, `check` glyph 17 dp from `MaterialSymbolsRounded_700` in `onPrimaryContainer`; accessibility role `checkbox` with `checked` state; light and dark
- [ ] T022 [US2] Recompose `ui/components/ListItemRow.tsx` on `Card` and `BrandCheckbox` (depends on T011, T021), replacing Paper `Checkbox.Android` and the `elevation: 1` style, test first in `ui/components/list-item-row.test.tsx` (existing assertions on labels, `testID`s and behavior unchanged): min height 64 (`ROW_MIN_HEIGHT`); padding 8/6/8/14; name `titleMedium` `onSurface` and quantity `typeOverrides.quantity` (13.5) `onSurfaceVariant` on one baseline, 10 dp gap, wrapping; `edit` and `close` icon buttons 48 dp `onSurfaceVariant`; checked = name `onSurfaceVariant`, struck through, `Nunito_600SemiBold`. Update `ui/components/ListItemRow.stories.tsx` (NotInCart, InCart, WithQuantity, LongName)
- [ ] T023 [US2] Rework `ui/components/ScreenFab.tsx` (depends on T007, T013), replacing `Surface elevation={3}`, test first in a new `ui/components/screen-fab.test.tsx`: height 56, radius `fab` (18), horizontal padding 22, gap 9, `primaryContainer` fill, icon 24 and label `labelLarge` in `onPrimaryContainer`, `boxShadow` = `shadows(theme).fab`; 16 dp from the end, 24 dp from the bottom plus the safe-area inset; export `ABOVE_SCREEN_FAB.bottom` = 24 + 56 + 12 = 92 (consumed by US9)
- [ ] T024 [US2] Recompose the header and sections of `ui/screens/CurrentListScreen.tsx` (depends on T016, T015, T022, T023), test first in `ui/screens/current-list-screen.test.tsx` (existing tests untouched): `ScreenHeader large` with the list name, a `Chip secondary` holding today's remaining-count text (hidden or worded as today when none remain), actions `shopping_cart_checkout`, `format_list_bulleted`, `settings` in that order with their current labels and `testID`s; sections of `CategoryHeader` + `ListItemRow` cards 10 dp apart with 16 dp side padding; bottom content inset so the FAB never hides the last card; `ScreenFab` "Ajouter". Layout styles only. Update `ui/screens/CurrentListScreen.stories.tsx` Success to the mockup 1 state (several categories, one checked, quantities, a long name)

**Checkpoint**: US1 + US2 = the MVP (typography and the most used screen).

---

## Phase 5: User Story 3 – Pick a list from cards that look like mockup 2 (Priority: P2)

**Goal**: The lists screen matches `shots/2-listes.png`.

**Independent Test**: Lists screen with three lists, one current; compare with
`design/mockups/shots/2-listes.png`.

- [ ] T025 [US3] Recompose `ui/components/ListSummaryRow.tsx` on `Card` (depends on T011, T012, T014), replacing `elevation: 1`, test first in a new `ui/components/list-summary-row.test.tsx`, light and dark: `outlined` card when current; padding 14/16; 44 dp `IconCircle` brand with `format_list_bulleted`; name `titleMedium`; count `bodySmall` `onSurfaceVariant` with today's text ("4 articles", "0 articles" as today, R9); trailing `chevron_right` `onSurfaceVariant`, or `Chip brand` "Liste actuelle" with `check` when current; long names wrap with the trailing element vertically centered
- [ ] T026 [US3] Recompose `ui/screens/ListsScreen.tsx` (depends on T016, T025, T023), test first in `ui/screens/lists-screen.test.tsx`: `ScreenHeader center` "Mes listes" with the existing back action; `ListSummaryRow` cards starting 14 dp below the header; `ScreenFab` "Nouvelle liste" with `add`. Layout only. Update `ui/screens/ListsScreen.stories.tsx` to three lists, one current, and add `Screens/Lists/ThreeListsOneCurrent` to `ui/required-stories.ts` if absent

**Checkpoint**: US3 independently reviewable against mockup 2.

---

## Phase 6: User Story 4 – Add articles from a screen that looks like mockup 3 (Priority: P2)

**Goal**: The add-articles screen matches `shots/3-ajouter.png`.

**Independent Test**: Categories holding on-list articles, addable articles and an empty
category; compare with `design/mockups/shots/3-ajouter.png`.

- [ ] T027 [P] [US4] Rework `ui/components/SearchField.tsx` (depends on T006, T010), test first in a new `ui/components/search-field.test.tsx`: height 54, stadium (`pill`), `surfaceContainer` fill, padding 0/18, gap 12, `search` icon and text `bodyLarge` `onSurfaceVariant`, placeholder "Rechercher un article" unchanged; margin 6 top, 16 sides, 2 bottom
- [ ] T028 [US4] Recompose `ui/components/ArticleRow.tsx` on `Card` and `Chip` (depends on T011, T012), test first in `ui/components/article-row.test.tsx` (existing assertions kept), light and dark: name `titleMedium`; when on the list, a `Chip tertiary` "Déjà dans la liste" with `check`; otherwise a 36 dp `brandSoft` circle with `add` in `onBrandSoft`, decorative (the row stays the button with its current label); `more_vert` menu button 48 dp; drop the Paper `Appbar`/`Chip` styling it used. Update `ui/components/ArticleRow.stories.tsx`
- [ ] T028a [P] [US4] Create `ui/components/EmptyCategoryCard.tsx` on `Card` (depends on T011, T013, T018), test first in a new `ui/components/empty-category-card.test.tsx`, light and dark: min height 56; message text from a `message` prop in `typeOverrides.emptyCategory` (14, `Nunito_600SemiBold`) `onSurfaceVariant`, not the mockup's `--muted` (`outline` on `surfaceContainerLowest` is 4.48:1 in light, below AA; FR-014), wrapping; a `Button text` action from `actionLabel`/`onAction` props, keeping the caller's `testID`; make sure the `onSurfaceVariant`/`surfaceContainerLowest` text pair is in `ui/theme/used-color-pairs.ts` (add it if missing). Add `Components/EmptyCategoryCard/Default` in `ui/components/EmptyCategoryCard.stories.tsx` and its id in `ui/required-stories.ts`
- [ ] T029 [US4] Recompose `ui/screens/AddArticlesScreen.tsx` (depends on T016, T015, T027, T028, T013), test first in `ui/screens/add-articles-screen.test.tsx`: `ScreenHeader large` with `titleVariant="titleLarge"` "Ajouter des articles", the existing back action and an `add` action that creates an article (current label and `testID`); `SearchField`; `CategoryHeader` sections of `ArticleRow` cards; an empty category is an `EmptyCategoryCard` with today's message "Aucun article dans cette catégorie" and action "Créer un article" (depends on T028a). Layout only. Update `ui/screens/AddArticlesScreen.stories.tsx` to the mockup 3 state and add its id to `ui/required-stories.ts`

**Checkpoint**: US4 independently reviewable against mockup 3.

---

## Phase 7: User Story 5 – Sign in on a screen that looks like mockup 4 (Priority: P2)

**Goal**: The sign-in screen matches `shots/4-connexion.png`.

**Independent Test**: Open sign-in with an empty form; compare with
`design/mockups/shots/4-connexion.png`.

- [ ] T030 [P] [US5] Rework `ui/components/BrandImage.tsx` as the brand tile (depends on T007), test first in a new `ui/components/brand-image.test.tsx`, light and dark: 215 dp square image, crop equivalent to `object-position` 28 %, radius 40, `boxShadow` = `shadows(theme).brandTile`, centered; keep the style-based sizing from #127 and the current accessible label
- [ ] T031 [P] [US5] Apply `fieldStyle('screen')` to `ui/components/PasswordField.tsx` and `ui/components/NameField.tsx` (depends on T017, T010), test first in `ui/components/PasswordField.test.tsx` and `ui/components/name-field.test.tsx`: outline radius 16, label in the top border, eye toggle `visibility`/`visibility_off` in `onSurfaceVariant` with its current label
- [ ] T032 [US5] Recompose `ui/screens/SignInScreen.tsx` (depends on T030, T031, T013), test first in `ui/screens/sign-in-screen.test.tsx`: remove `Appbar.Header`; brand tile at the top; server address, email, password and device name fields on `fieldStyle('screen')`, 15 dp apart, 24 dp side padding; full-width `Button brand` "Se connecter" 10 dp below; centered `Button text` "Mot de passe oublié ?"; content scrolls at 200 %. Layout only. Update `ui/screens/SignInScreen.stories.tsx` (empty form)

**Checkpoint**: US5 independently reviewable against mockup 4.

---

## Phase 8: User Story 7 – Confirm actions in dialogs that look like mockups 7 to 10 (Priority: P2)

**Goal**: The quantity, finish-shopping, delete-article and new-list dialogs match mockups 7–10.

**Independent Test**: Open each dialog and compare with `design/mockups/shots/7-dialog-quantite.png`
to `10-dialog-nouvelle-liste.png`.

- [ ] T033 [US7] Create `ui/components/AppDialog.tsx` wrapping Paper `Dialog` (depends on T007, T013, T014, T004), test first in a new `ui/components/app-dialog.test.tsx`: `surfaceContainerLowest` background, radius `xl` (28), `boxShadow` = `shadows(theme).dialog`, backdrop `backdrop` (`scrim` at 0.36); padding 26 top, 24 sides, 18 bottom, gap 14; optional `icon` + `tone` render a 56 dp `IconCircle` centered above the title; `layout="start" | "centered"` (centered: title and message centered); title `titleLarge`; message `bodyMedium` `onSurfaceVariant`; actions end-aligned, gap 8: `Button text` cancel then a compact confirm (`brand` or `dangerFilled`); optional `startAction` slot left-aligned below the content; content inside Paper `Dialog.ScrollArea` when it exceeds the available height (asserted at `fontScale` 2); keeps Paper's dismiss, focus and accessibility behavior; Paper `Portal` unchanged
- [ ] T034 [P] [US7] Move `ui/screens/QuantityDialog.tsx` onto `AppDialog` (depends on T033, T017), test first in `ui/screens/quantity-dialog.test.tsx` (existing behavior tests kept): layout `start`, title = article name; `ui/components/QuantityFields.tsx` renders "Quantité" and "Unité" side by side, gap 12, on `fieldStyle('dialog')` (radius 14; covered in `ui/components/quantity-fields.test.tsx`); start action `Button text` "Effacer la quantité"; confirm `brand` "Enregistrer"; update `ui/screens/QuantityDialog.stories.tsx`
- [ ] T035 [P] [US7] Move `ui/screens/FinishShoppingDialog.tsx` onto `AppDialog` (depends on T033), test first in `ui/screens/finish-shopping-dialog.test.tsx`: layout `centered`, icon `shopping_cart_checkout` tone `brand`, title "Terminer les courses ?" and message centered, confirm `brand` "Terminer"; update `ui/screens/FinishShoppingDialog.stories.tsx`
- [ ] T036 [P] [US7] Move `ui/screens/DeleteArticleDialog.tsx` onto `AppDialog` (depends on T033), test first in `ui/screens/delete-article-dialog.test.tsx`: layout `centered`, icon `delete` tone `error`, title and message centered, confirm `dangerFilled` "Supprimer" (`error` fill, `onError` text); update `ui/screens/DeleteArticleDialog.stories.tsx`
- [ ] T037 [US7] Move `ui/components/CreateNamedDialog.tsx` onto `AppDialog` (depends on T033, T017), which carries `ui/screens/CreateListDialog.tsx` and `ui/screens/CreateCategoryDialog.tsx`, test first in `ui/screens/create-list-dialog.test.tsx` and `ui/screens/create-category-dialog.test.tsx`: layout `start`, title "Nouvelle liste" start-aligned, one `NameField` "Nom" on `fieldStyle('dialog')`, confirm `brand` "Créer"; update `ui/screens/CreateListDialog.stories.tsx`
- [ ] T038 [US7] Ensure `ui/required-stories.ts` lists `Dialogs/QuantityDialog/*`, `Dialogs/FinishShoppingDialog/Default`, `Dialogs/DeleteArticleDialog/*` and `Dialogs/CreateListDialog/*` in the mockup states (add missing ids; `ui/stories.test.tsx` fails until each story exists)

**Checkpoint**: US7 independently reviewable against mockups 7–10.

---

## Phase 9: User Story 8 – Keep the mockup look in dark appearance (Priority: P2)

**Goal**: The current list matches `shots/6-liste-dark.png`; every other screen uses the dark tokens.

**Independent Test**: Dark appearance; compare the current list with
`design/mockups/shots/6-liste-dark.png`, then open the other screens and dialogs.

- [ ] T039 [US8] Extend `ui/theme/dark-appearance.test.tsx` (depends on T024, T033): in dark, the current list renders background `surface` (equal to `styles.css` `body.dark --bg`), cards `surfaceContainerLowest` `#1E1B13`, text `onSurface`, and `BrandCheckbox` checked fill, `CategoryHeader` bar and `ScreenFab` fill all equal the light `primaryContainer` `#FFDE3F`; `AppDialog` background is `surfaceContainerLowest` in dark; `Card` uses the dark `card` shadow token. Fix any block that reads an appearance-specific role. Blocks built in later phases (US6, US10) carry their own dark assertions in their tests (US8-2)
- [ ] T040 [US8] Add dark stories (depends on T039): `Screens/CurrentList/SuccessDark` in `ui/screens/CurrentListScreen.stories.tsx` (mockup 6 state) and a dark variant of each mockup dialog story, using the existing story decorator's appearance parameter in `ui/testing/story-decorator.tsx` (extend it, test first in `ui/testing/story-decorator.test.tsx`, if it has no dark switch); add the ids to `ui/required-stories.ts`

**Checkpoint**: US8 reviewable against mockup 6.

---

## Phase 10: User Story 9 – Undo an action from a snackbar that looks like mockups 12 and 13 (Priority: P2)

**Goal**: Undo offer and notices match `shots/12-snackbar.png` and `shots/13-snackbar-dark.png`.

**Independent Test**: Remove an article in light, then dark, compare with mockups 12 and 13; trigger
"« Lait » ajouté" and check the same style.

- [ ] T041 [US9] Create `ui/components/BrandSnackbar.tsx` wrapping Paper `Snackbar` (depends on T007, T018), test first in a new `ui/components/brand-snackbar.test.tsx`: `inverseSurface` background, radius `lg` (16), `boxShadow` = `shadows(theme).snackbar`, min height 56, padding 8 top, 6 end, 8 bottom, 18 start, side margins 16; message a `Text` in `typeOverrides.snackbarMessage` (15, `Nunito_700Bold`) `inverseOnSurface`, wrapping (no `numberOfLines`), action label `typeOverrides.compactLabel` (14.5) `inversePrimary`, kept on the end of a wrapped message; light and dark
- [ ] T042 [US9] Route `ui/components/UndoSnackbar.tsx` and `ui/components/NoticeSnackbar.tsx` through `BrandSnackbar` (depends on T041, T023), keeping timing, stacking, labels and announcements; tests in `ui/components/undo-snackbar.test.tsx` and `ui/components/notice-snackbar.test.tsx` stay green unchanged, plus new assertions: wrapper bottom = `ABOVE_SCREEN_FAB.bottom` (92) above a FAB; a notice during an undo offer sits at `ABOVE_UNDO_OFFER.bottom` = 92 + 56 + 8; a notice without action renders no action
- [ ] T043 [US9] Add snackbar stories (depends on T042, T040): `Components/UndoSnackbar/AboveFab` and `Components/UndoSnackbar/AboveFabDark` (mockups 12, 13), `Components/NoticeSnackbar/Added` and `Components/NoticeSnackbar/LongMessage`, `Components/NoticeSnackbar/StackedOverUndo` in `ui/components/UndoSnackbar.stories.tsx` and `ui/components/NoticeSnackbar.stories.tsx`; add their ids to `ui/required-stories.ts`

**Checkpoint**: US9 reviewable against mockups 12 and 13.

---

## Phase 11: User Story 6 – Manage settings in cards that look like mockup 5 (Priority: P3)

**Goal**: The settings screen matches `shots/5-reglages.png`.

**Independent Test**: Settings with pending sync; compare with `design/mockups/shots/5-reglages.png`.

- [ ] T044 [P] [US6] Rework `ui/components/SettingsCard.tsx` on `Card` and `ui/components/SettingsRow.tsx` (depends on T011, T014), replacing `Surface elevation={1}`, test first in new `ui/components/settings-card.test.tsx` and `ui/components/settings-row.test.tsx`, light and dark: card padding 16, gap 14 (10 with `dense` for the actions card); row = 44 dp `IconCircle` brand, title `titleMedium`, optional subtitle `bodySmall` `onSurfaceVariant`, optional trailing `chevron_right`, gap 14, padding 4/2, no own surface; long titles wrap
- [ ] T045 [P] [US6] Add the settings strip variant of `ui/components/SyncStatusBar.tsx` (depends on T010), test first in `ui/components/sync-status-bar.test.tsx` (existing status tests kept), light and dark: full width, `surfaceContainer`, padding 11/20, gap 10, icon 20, text `typeOverrides.syncStrip` (14, `Nunito_700Bold`) `onSurfaceVariant`; the failure state keeps its recovery action, now a `Button`
- [ ] T046 [US6] Recompose `ui/screens/SettingsScreen.tsx` and `ui/screens/DeviceRow.tsx` (depends on T016, T015, T044, T045, T013), test first in `ui/screens/settings-screen.test.tsx`, `ui/screens/settings-account.test.tsx`, `ui/screens/settings-devices-screen.test.tsx` and `ui/screens/settings-own-account.test.tsx` (behavior assertions unchanged): `ScreenHeader center` "Réglages" with the back action; sync strip; sections "Compte", "Serveur", "Appareils", "Actions" each a `CategoryHeader` + one `SettingsCard`; account card: row `account_circle` + `Button outlined` "Changer de mot de passe"; server card: row `dns`, last sync time, `Button brand` "Synchroniser maintenant" with `sync`; device rows `smartphone` with `chevron_right`; actions card: `Button outlined` "Se déconnecter de cet appareil" with `logout` and `Button danger` "Supprimer mon compte" with `delete`. Layout only. Update `ui/screens/SettingsScreen.stories.tsx` (pending sync)

**Checkpoint**: US6 reviewable against mockup 5.

---

## Phase 12: User Story 10 – Find the same look on screens without a mockup (Priority: P3)

**Goal**: Screens and dialogs without a mockup use only the mockup blocks (FR-011).

**Independent Test**: Open each listed screen and dialog; check every title, heading, card, button,
field and chip matches its mockup counterpart.

- [ ] T047 [P] [US10] Rework `ui/components/EmptyState.tsx`, `ui/components/ErrorState.tsx`, `ui/components/StateMessage.tsx` and `ui/components/LoadingState.tsx` (depends on T014, T013), test first in `ui/components/screen-state.test.tsx`, light and dark: 56 dp `IconCircle` (`brand` with `shopping_basket`, `error` tone with `error` for errors), title `titleLarge`, message `bodyMedium` `onSurfaceVariant` centered, action (including "Réessayer") a `Button brand`; `LoadingState` = `primary` indicator on `surface`, label `bodyMedium`; update their stories
- [ ] T048 [P] [US10] Move the remaining dialogs onto `AppDialog` (depends on T033, T017): `ui/screens/AccountActionDialogs.tsx` (suspend, delete account, resend credentials), `ui/screens/ChangePasswordDialog.tsx`, `ui/screens/DeleteMyAccountDialog.tsx`, `ui/screens/DeviceDialog.tsx`, `ui/screens/ForgotPasswordDialog.tsx`, `ui/screens/InviteAccountDialog.tsx`, `ui/screens/RenameDeviceDialog.tsx`, `ui/screens/RevokeDeviceDialog.tsx`, `ui/screens/SignOutDialog.tsx`, `ui/screens/SignedOutNoticeDialog.tsx`; destructive ones (`DeleteMyAccount`, delete/suspend account, `RevokeDevice`, `SignOut`) are `centered` with the `error` icon and a `dangerFilled` confirm; fields on `fieldStyle('dialog')`. Test first: one assertion per dialog on its `AppDialog` layout and confirm mode in the existing dialog tests (`ui/screens/settings-account.test.tsx`, `ui/screens/settings-devices-screen.test.tsx`, `ui/screens/settings-own-account.test.tsx`, `ui/screens/sign-in-screen.test.tsx`, `ui/screens/accounts-screen.test.tsx`), behavior unchanged
- [ ] T049 [US10] Recompose `ui/screens/AccountsScreen.tsx` (depends on T016, T011, T012, T044, T048: both edit `ui/screens/accounts-screen.test.tsx`), test first in `ui/screens/accounts-screen.test.tsx`: `ScreenHeader center` with back, account rows in `Card`s via `SettingsRow`, role badges as `Chip`, invite action `person_add`, delete `delete`; remove `Appbar.Header`. Layout only
- [ ] T050 [P] [US10] Recompose `ui/screens/CreateArticleScreen.tsx`, `ui/screens/EditArticleScreen.tsx` and `ui/components/CategoryPicker.tsx` (depends on T016, T017, T013, T015), test first in `ui/screens/create-article-screen.test.tsx`, `ui/screens/edit-article-screen.test.tsx`, `ui/components/category-picker.test.tsx`: `ScreenHeader center` with back; `NameField` on `fieldStyle('screen')`; category picker grouped under `CategoryHeader` in a `Card`, `ui/components/RadioItem.tsx` rendering its own radio mark from roles (no Paper `radiobox-*` icon); save as `Button brand`. Layout only
- [ ] T051 [P] [US10] Recompose `ui/screens/ChoosePasswordScreen.tsx`, `ui/screens/StartupError.tsx`, `ui/screens/UpdateRequired.tsx` and `ui/screens/CrashError.tsx` (depends on T016, T017, T047), test first in their existing tests or a new `ui/screens/no-mockup-screens.test.tsx`: `ScreenHeader center` where the screen has a header, fields on `fieldStyle('screen')`, actions as `Button brand`/`outlined`, error screens on `ErrorState`; remove `Appbar.Header`. Layout only
- [ ] T052 [US10] Lock the building-block rule (depends on T047–T051): add `ui/components/no-legacy-ui.test.ts` that statically scans `ui/components/**/*.tsx` and `ui/screens/**/*.tsx` (excluding tests and stories) and fails on `Appbar.Header`, `Checkbox.Android`, `elevation`, `Surface elevation`, Paper `Dialog` outside `AppDialog.tsx`, Paper `Snackbar` outside `BrandSnackbar.tsx`, and `numberOfLines` on `Text`; fix any remaining hit

**Checkpoint**: All stories done; no legacy look left.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Mockup 11 check, accessibility, docs and the validation of quickstart.md.

- [ ] T053 [P] Check `ui/screens/StartupSplash.tsx` against `design/mockups/11-splash.html`: 208 dp image, radius 44, gap 42, progress track 96 × 5 `surfaceContainer` with a `primaryContainer` bar; add any missing assertion to `ui/screens/StartupSplash.test.tsx` first and fix only what differs
- [ ] T054 [P] Extend `ui/screens/accessibility.test.tsx` to render the current list, lists, add articles, sign-in, settings and the four mockup dialogs at `fontScale` 2 and assert every interactive element keeps a ≥ 48 dp target and no title, name or message sets `numberOfLines`; each of these screens renders its content in a `ScrollView`, `FlatList` or `SectionList`, and `AppDialog` puts its content in a scroll area, so content taller than the screen at `fontScale` 2 scrolls (spec edge case, FR-013, SC-007)
- [ ] T055 [P] Update docs: `README.md` (icon font regeneration with `design/icons/build-symbols.sh`), a new `design/README.md` describing the folder (`material-theme.json` as the single color source and its six schemes, the `brandSoft` role, `mockups/` and `shots/` as the visual reference, `icons/build-symbols.sh`) and pointing to the token modules `ui/theme/typography.ts` (scale and `typeOverrides`) and `ui/theme/elevation.ts`; link it from the "Repository layout" section of `README.md`, and mark `specs/007-basket-identity-ui/contracts/ui-identity.md` as superseded by `specs/008-mockup-fidelity-ui/contracts/ui-building-blocks.md` where they differ
- [ ] T056 Run quickstart.md section 1 (`yarn test`, `yarn lint`, `yarn format:check`, `yarn typecheck`, `yarn test:architecture`) and section 2 (`shellcheck design/icons/build-symbols.sh`, script rerun leaves no diff); fix any failure
- [ ] T057 Run quickstart.md section 3: `yarn screenshots:ios`, then (after it finishes) `yarn screenshots:android`; compare each capture with `design/mockups/shots/` per the quickstart table and fix any difference other than sample data, status bar and autofill icon; attach the captures to the pull request with `gl-pr-screenshots`
- [ ] T058 Run quickstart.md section 6: `yarn test:e2e:android` on the final commit (required), then `yarn test:e2e:ios` after it finishes (recommended); every journey passes with no label or `testID` renamed (SC-006)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none. T002 runs alongside T001.
- **Foundational (Phase 2)**: T003 → T004 → T005 and T007 (both read the new roles); T006 needs
  nothing; T008 needs T001; T009 needs T008; T010 needs T009; base blocks T011–T017 need T006/T007
  (and T009 for icons). **Blocks every user story.**
- **US1 (Phase 3)**: after Foundational. Other stories do not need it to be testable, but their
  captures only match the mockups once it is in, so do it first.
- **US2 (Phase 4)**: after Foundational; T023 (`ScreenFab`, `ABOVE_SCREEN_FAB`) is reused by US3 and
  US9.
- **US3, US4, US5 (Phases 5–7)**: after Foundational; independent of each other. US3 also needs
  T023 (`ScreenFab`, from US2) before T026.
- **US7 (Phase 8)**: after Foundational; `AppDialog` (T033) is reused by US8 and US10.
- **US8 (Phase 9)**: after US2 (T024) and US7 (T033), which it checks in dark.
- **US9 (Phase 10)**: after US2 (T023) and US8 (T040, dark stories).
- **US6 (Phase 11)**: after Foundational.
- **US10 (Phase 12)**: after US7 (T033) and US6 (T044).
- **Polish (Phase 13)**: after every story.

### Story completion order

```text
Setup → Foundational → US1 → US2 ─┬─ US3
                                  ├─ US4
                                  ├─ US5
                                  ├─ US7 ─┬─ US8 ── US9
                                  │       └────────────┐
                                  └─ US6 ──────────── US10 → Polish
```

### Within each story

- Each task writes its test first inside the task, sees it fail, then implements.
- Shared blocks before the screens that compose them; stories and required ids with the block.

### Parallel opportunities

- Phase 1: T001 ∥ T002.
- Phase 2: T006 any time; T005 ∥ T007 (after T004); T011 ∥ T012 ∥ T014 ∥ T015 ∥ T017 (after
  T006, T007, T009), then T013 after T012.
- US2: T021 ∥ T023 before T022/T024.
- US3, US4, US5, US7 and US6 can be developed in parallel after US2's T023.
- US4: T027 ∥ T028 ∥ T028a. US5: T030 ∥ T031. US7: T034 ∥ T035 ∥ T036 after T033.
- US6: T044 ∥ T045. US10: T047 ∥ T048 ∥ T050 ∥ T051, then T049 after T048.
- Polish: T053 ∥ T054 ∥ T055. Device runs (T057, T058) never in parallel with each other: iOS and
  Android one at a time.

---

## Parallel Example: Foundational base blocks

```bash
Task: "Create ui/components/Card.tsx with card.test.tsx (T011)"
Task: "Create ui/components/Chip.tsx with chip.test.tsx (T012)"
Task: "Rework ui/components/IconCircle.tsx with icon-circle.test.tsx (T014)"
Task: "Rework ui/components/CategoryHeader.tsx with category-header.test.tsx (T015)"
Task: "Create ui/components/field-style.ts with field-style.test.ts (T017)"
```

## Parallel Example: User Story 7

```bash
# after T033 (AppDialog)
Task: "Move QuantityDialog onto AppDialog (T034)"
Task: "Move FinishShoppingDialog onto AppDialog (T035)"
Task: "Move DeleteArticleDialog onto AppDialog (T036)"
```

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Phase 1 Setup, Phase 2 Foundational.
2. US1: the type scale (every screen gains the mockup weights).
3. US2: the current list matches mockup 1.
4. **Stop and validate**: capture `Screens/CurrentList/Success` and compare with
   `design/mockups/shots/1-liste.png`; show the maintainer before going further, since the 007
   result was rejected on look.

### Incremental delivery

1. US3, US4, US5, US7 (P2 screens and dialogs), each reviewable against its mockup.
2. US8 (dark) and US9 (snackbar), which build on US2 and US7.
3. US6 and US10 (P3), then Polish.
4. One pull request for the feature (plan: Principle XI); commit after each task.

---

## Notes

- [P] tasks touch different files and have no dependency on an unfinished task.
- Never run the iOS and Android device runs at the same time (the Mac runs out of memory).
- Behavior tests that exist today must stay green unchanged; a red one means a label, `testID`
  or flow changed, which FR-012 forbids.
- If a required symbol is missing, add it to `ui/icons/symbols.txt`, rerun
  `design/icons/build-symbols.sh` and commit the regenerated fonts and glyph map together.
