# Research: Mockup-Faithful UI

Each decision records what the plan chose, why, and what else was weighed. The reference
values come from `design/mockups/styles.css` and the mockup pages; "mockup wins" is the rule
of the spec's Context section.

## Gap analysis: why feature 007 does not match

A read of the current shared components against `styles.css` gives the causes the maintainer
sees on screen:

| Gap | Current code | Mockup |
|-----|--------------|--------|
| Text weight | Paper roles mapped to Nunito 400 for every body role (`theme.ts`); names, quantities and secondary lines render regular | 600 secondary, 700 names, 800 titles, headings and buttons |
| Text size | Material default scale (16, 14, 22, 24) | 16.5 names, 15.5 buttons and FAB, 13.5 quantities, 28 main title |
| Icons | Material Design Icons (Paper's default set, `pencil-outline`, `cog`…) | Material Symbols Rounded, weight 500 (`edit`, `settings`…) |
| Card shadow | Android `elevation: 1` or Paper `Surface elevation={1}` (tonal, hard grey shadow) | two soft warm layers, `--shadow-card` |
| Soft yellow | `surfaceContainerHigh` (greige) stands in for it | `#FFF1BE` / `#3A3200` |
| Checkbox | Paper `Checkbox.Android` inside a 2 dp-radius box | 24 dp rounded square, 7 dp corners, yellow fill and dark outline when checked |
| Field corners | `style={{ borderRadius }}` on `TextInput`, which Paper ignores for the outline | 16 dp (14 dp in dialogs) outline |
| FAB | 16 dp corners, `labelLarge` 600, 16 dp from the bottom | 18 dp corners, 15.5/800, 24 dp from the bottom |
| Header | Paper `Appbar.Header` (fixed height, one line) | large left title with a chip below, or centered 22 dp title |
| Dialogs | Paper defaults: `surfaceContainerHigh` background, text buttons only | white card, stadium confirmation, centered icon layout |
| Snackbar | Paper default (4 dp corners, regular text) | 16 dp corners, bold text, extra-bold action, soft shadow |

The plan fixes these at the token and shared-component level, so most screens change only
where their composition differs from the mockup.

## R1: Card role carries `#FFFFFF` light and `#1E1B13` dark

**Decision**: Keep `surfaceContainerLowest` as the card role (the mockup's own comment names
it) and set its dark values to the dark scheme's `surfaceContainerLow`: `#1E1B13` (dark),
`#201D15` (dark medium contrast), `#222017` (dark high contrast). Light values stay
(`#FFFFFF` in all three). Dialogs use the same role, so the mockup's white dialog is white in
light and `#1E1B13` in dark.

**Rationale**: FR-003b asks one role to hold both values. Only cards and dialogs draw
`surfaceContainerLowest` today (`ListItemRow`, `ListSummaryRow`), so moving its dark value
lifts every card above the dark background, which is what mockup 6 shows, without touching
any other component. Dark Lowest then equals dark Low; Paper's `elevation.level1` keeps
reading `surfaceContainerLow`, so nothing reorders visibly.

**Alternatives considered**:

- A new `card` role: duplicates a role that already holds the light value; two roles for one
  surface invite drift.
- Using `surfaceContainerLow` everywhere: its light value is `#FAF3E5`, not white.

## R2: New soft-yellow role pair

**Decision**: Add `brandSoft` and `onBrandSoft` to all six schemes of
`design/material-theme.json`:

| Scheme | `brandSoft` | `onBrandSoft` |
|--------|-------------|---------------|
| light | `#FFF1BE` | `#6D5E0F` |
| light-medium-contrast | `#FFF1BE` | `#403600` |
| light-high-contrast | `#FFF1BE` | `#352C00` |
| dark | `#3A3200` | `#DBC66E` |
| dark-medium-contrast | `#3A3200` | `#F2DC82` |
| dark-high-contrast | `#3A3200` | `#FFF0BA` |

`onBrandSoft` takes each scheme's `primary`, the color the mockups draw on the soft yellow
(`.lead`, `.d-icon.brand`, the round add button). `#FFF1BE` is tone 95 of the primary palette
already in the export.

**Rationale**: FR-003a. The pair follows Material's `xxx` / `onXxx` naming, so `theme.ts`
merges it like any role (it already spreads every scheme key) and `SchemeRole` types it.
Contrast: 5.7:1 light, 7.5:1 dark, higher in the contrast variants.

**Alternatives considered**:

- Material Theme Builder custom color (`extendedColors`): the builder generates four tones
  that do not equal the mockup values, and the export would need regenerating; a hand-added
  pair is exact and still lives in the single color file.
- Reusing `primaryFixed` (`#F8E287`): visibly more saturated than the mockup.

## R3: Scrim and shadow colors come from roles

**Decision**: Set `scrim` to `#141108` and light `shadow` to `#1E1B13` in the light schemes;
dark `shadow` stays `#000000`, dark `scrim` becomes `#141108` too. A new
`theme/elevation.ts` module builds the mockup shadows as React Native `boxShadow` strings from
theme roles:

| Token | Light | Dark |
|-------|-------|------|
| `card` | `shadow` at 0.05 (0 1 2) + 0.06 (0 6 16) | `shadow` at 0.35 + 0.30, same offsets |
| `fab` | `onPrimaryContainer` at 0.20 (0 4 12) + 0.14 (0 1 3) | same |
| `dialog` | `shadow` at 0.24 (0 14 36) + 0.12 (0 2 6) | same roles |
| `snackbar` | `scrim` at 0.26 (0 6 18) + 0.16 (0 1 3) | same |
| `brandTile` | `onPrimaryContainer` at 0.14 (0 10 28) | same |

The dialog backdrop (`backdrop`, derived in `theme.ts`) becomes `scrim` at 0.36.

**Rationale**: SC-004 wants every mockup color held by a role. React Native 0.88 runs the new
architecture only, where `boxShadow` takes several layers with colors and blur on both
platforms (`processBoxShadow` in RN), which `elevation` cannot do. Building the strings from
roles keeps colors single-sourced and lint-clean.

**Alternatives considered**:

- `elevation` / `shadowColor`: one layer, grey on Android; this is the 007 result the
  maintainer rejected.
- Hard-coded rgba strings: violate Principle V and `no-color-literals`.

## R4: Typography scale taken from the mockups

**Decision**: Replace the 007 font mapping in `theme.ts` with a typography module
(`theme/typography.ts`) that configures every Paper MD3 role with a Nunito file and the
mockup size. The table is in [data-model.md](data-model.md#type-scale). In short:
`headlineMedium` 28/800 (current list title), `titleLarge` 22/800 (centered titles, dialog
titles), `titleMedium` 16.5/700 (item names, setting titles), `titleSmall` 14/800 (section
headings), `bodyLarge` 16/600 (field text, search), `bodyMedium` 15/600 (dialog messages),
`bodySmall` 13/600 (secondary lines), `labelLarge` 15.5/800 (buttons, FAB), `labelMedium`
13/700 (chips, quantities 13.5 by a component override), `labelSmall` 12.5/700 (field
labels). Weight is chosen by file (`Nunito_800ExtraBold`…), never by `fontWeight`, as 007
established for Android.

**Rationale**: FR-001 (sizes and weights), FR-002, SC-003. Putting sizes in the Paper roles
means Paper's own components (dialog title, buttons, text input, snackbar, menu items) get the
mockup look without per-component overrides.

**Discrepancy resolved**: the spec lists chips among the extra-bold elements, but
`styles.css` sets `.chip { font-weight: 700 }`. The mockup wins: chips are bold (700).

**Alternatives considered**:

- Keep Material's sizes and change weights only: titles and buttons would stay visibly smaller
  than the captures.
- Per-component `style` overrides: scatter typography and miss Paper's internal texts.

## R5: Material Symbols Rounded, bundled as a subset font

**Decision**: Generate two static TrueType subsets of the variable font *Material Symbols
Rounded* (Apache 2.0, from `google/material-design-icons` at a pinned commit, SHA-256 checked):

- `MaterialSymbolsRounded_500.ttf`: FILL 0, wght 500, GRAD 0, opsz 24, every glyph the app
  draws;
- `MaterialSymbolsRounded_700.ttf`: same axes at wght 700, glyph `check` only, for the
  checkbox mark (`styles.css` draws it at 700).

A script, `design/icons/build-symbols.sh` (shellcheck-clean), runs fonttools'
`varLib.instancer` and `pyftsubset` through `nix shell nixpkgs#python3Packages.fonttools`,
and writes the TTFs to `apps/mobile/assets/fonts/` and a glyph map
(`apps/mobile/src/adapters/ui/icons/symbols-glyphs.json`, name → code point). The app loads
both fonts with the existing `expo-font` call in `App.tsx`, builds an icon component with
`createIconSet` from `@expo/vector-icons` (already a dependency), and hands it to Paper through
`PaperProvider settings.icon`, so every Paper component and every `icon="…"` prop renders
Material Symbols.

Call sites switch from the Material Design Icons names they use today to the Material Symbols
names of the mockups (`edit`, `close`, `settings`, `more_vert`…). Paper's
internal names (`magnify`, `close`, `arrow-left`, `chevron-left`, `menu-down`, `check`,
`minus`, `eye`, `eye-off`, `alert-circle`…) go through an alias table in the icon module.
A test fails for any name, from a call site or from Paper, that resolves to no glyph. The full
map is in [data-model.md](data-model.md#icon-set).

**Rationale**: FR-010 asks for the mockups' rounded style at weight 500; FR-015 forbids
runtime loading. React Native cannot set font variation axes, so a static instance is the only
way to get weight 500 from the variable font. A subset of about 30 glyphs stays a few tens of
kilobytes. No new runtime dependency: `expo-font` and `@expo/vector-icons` are already there.

**Alternatives considered**:

- `material-symbols-react-native` (SVG definitions per variant): new runtime dependency plus
  `react-native-svg` paths for each icon; rejected under Principle IV when a font does it with
  existing packages.
- React Navigation 8's bundled Material Symbols: the app is on React Navigation 7; upgrading
  the navigator for icons is out of scope.
- `MaterialIcons` from `@expo/vector-icons` ("round" style absent, weight 400 only): does not
  match the captures.

The icon choice outlives this feature (every future screen uses it), so it gets an ADR
(see plan.md).

## R6: Shared building blocks

**Decision**: The mockup's CSS classes map to shared components in
`apps/mobile/src/adapters/ui/components/`; the [UI contract](contracts/ui-building-blocks.md)
gives each one's tokens. New: `ScreenHeader` (variants `large` and `center`, optional chip,
trailing actions), `Card` (card role, 16 dp, `card` shadow, optional brand outline),
`BrandCheckbox`, `Chip` wrapper (tones `secondary`, `tertiary`, `brand`), `BrandSnackbar`,
`AppDialog` (28 dp, card role, `dialog` shadow, optional icon circle, centered or start
layout, actions row). Changed: `ScreenFab`, `Button` (modes `brand`, `outlined`, `danger`,
`dangerFilled`, `text`, all stadium), `IconCircle` (default `brandSoft`, tone `error`),
`CategoryHeader` (renamed role: also the settings section heading), `SettingsRow`,
`SettingsCard`, `ListItemRow`, `ArticleRow`, `ListSummaryRow`, `SearchField`, the three field
components (shared `outlineStyle` radius), `EmptyState`, `ErrorState`, `StateMessage`.

**Rationale**: Principle V (screens are layout only, the lint rule already enforces it) and
the spec assumption that the correction lives mostly in shared components and tokens.

**Alternatives considered**: restyling screens one by one: blocked by the screen lint rule and
would repeat the 007 drift.

## R7: Header as a shared component, not Paper's `Appbar.Header`

**Decision**: `ScreenHeader` is built from Paper `Text` and the existing `AppbarIconAction`,
inside the safe-area top inset. `large`: title `headlineMedium`, start-aligned, optional chip
below (6 dp gap), actions on the end, padding 14/8/10/20. `center`: title `titleLarge`,
centered. A back action, when the screen has one, sits at the start with the same 48 dp
target. The title wraps instead of being truncated to one line.

**Rationale**: Paper's `Appbar.Header` has a fixed height and one content line; the current
list's title plus chip (mockup 1) does not fit, and its `numberOfLines={1}` title breaks the
200% text-size rule (FR-013). Material 3's top app bar is still the model (large and
center-aligned variants).

**Alternatives considered**: `Appbar.Header mode="large"`: fixed 152 dp height, no slot for a
chip, and title placed at the bottom.

## R8: Snackbar look and placement

**Decision**: `BrandSnackbar` wraps Paper `Snackbar` with `inverseSurface` background, 16 dp
corners, the `snackbar` shadow, its message as a `Text` child in `titleMedium`-weight bold at
15 (`bodyMedium` size with the bold file), and the action label in `labelLarge`
(extra-bold) with `inversePrimary`. `UndoSnackbar` and `NoticeSnackbar` keep all their logic
and pass through it. Placement: 16 dp side margins, bottom `24 + 56 + 12 = 92` dp above a FAB
(`ABOVE_SCREEN_FAB`), and a notice during an undo offer sits one snackbar height (56 dp) plus
8 dp above it (`ABOVE_UNDO_OFFER`), as today but with the new height.

**Rationale**: FR-010a, US9. Timing, stacking and announcements are untouched, so the existing
snackbar tests stay as they are.

## R9: Texts that look different in the mockups

**Decision**: Keep the application's current texts where a mockup differs (FR-012), for
example "0 articles" on the lists screen (the mockup shows "0 article"; the spec's edge case
says "as today"). Presentation labels the mockups introduce and the app already shows stay
("Liste actuelle", "Déjà dans la liste").

**Rationale**: FR-012 forbids text changes and the existing tests assert these strings. A
plural change, if wanted, is a separate behavior change with its own test.

## R10: Verification approach

**Decision**:

- **SC-004**: a fast test parses the `:root` and `body.dark` blocks of
  `design/mockups/styles.css` and asserts that every color token equals the value of its
  mapped role in `design/material-theme.json` (map in data-model.md); `no-color-literals`
  keeps literals out of the app.
- **SC-005**: `used-color-pairs.ts` gains the new pairs (data-model.md); the existing WCAG
  test checks them in light and dark. The checked checkbox is a graphic whose contrast comes
  from its outline in light (`onPrimaryContainer` on the card, 13.1:1) and from its fill in
  dark (`primaryContainer` on the card, 12.9:1); both pairs are listed. The category bar and
  the current-list outline are decorative (they repeat text that carries the meaning) and are
  not contrast pairs.
- **FR-001 / SC-001**: component tests assert the tokens each building block applies (role,
  radius, font file, shadow token); stories cover every mockup state; `yarn screenshots:ios`
  then `yarn screenshots:android` (one at a time) produce captures compared side by side with
  `design/mockups/shots/` in the pull request.
- **SC-006**: no test identifier or accessible label changes; the full fast and device suites
  run unchanged.

**Rationale**: Principles I and II: every visual rule is driven by a test on the public props
and rendered styles, never by a snapshot of private structure.
