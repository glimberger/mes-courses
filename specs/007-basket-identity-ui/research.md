# Research: Basket-Identity UI Refresh

## Decision 1: Make `primaryContainer` the brand action color

**Decision**: Change `design/material-theme.json` so that the light and dark schemes carry
the vibrant logo yellow `#FFDE3F` as `primaryContainer`, with `#3A3000` as
`onPrimaryContainer`, in both appearances. The existing olive `primary` (`#6D5E0F` light /
`#DBC66E` dark) stays as the text/link role, so outlined buttons and secondary text keep
their contrast color while filled actions use the container.

**Rationale**: The mockups draw every floating action, sign-in button, create/save/finish
action and the "current list" badge in the saturated logo yellow with dark text. In
Material 3, the extended FAB and filled-tonal buttons already paint from `primaryContainer`,
so making that role the brand yellow reuses the design system instead of inventing a color.
`ScreenFab` already reads `colors.primaryContainer`, and the 5 contained action buttons
become tonal (`mode="contained-tonal"`) without hard-coded values. Keeping `primary` olive
preserves the existing links and menus, which the mockups render in the darker text color.

**Alternatives considered**:

- Restyle primary actions with a hard-coded `#FFDE3F` in each screen: rejected by
  Principle V (no color literals; lint enforces `react-native/no-color-literals`).
- Change `primary` itself to yellow: rejected, because the same role is the link/text color
  in the mockups and would force a new role for links.
- Add a third color scheme or custom token: rejected as an unneeded second color source
  (Principle V): the existing Material export already has the right surface tones.

## Decision 2: Bundle Nunito instead of loading a font over the network

**Decision**: Ship four Nunito TTF files (`Nunito_400Regular`, `Nunito_600SemiBold`,
`Nunito_700Bold`, `Nunito_800ExtraBold`) under `apps/mobile/assets/fonts/` and load them
with the already-present `expo-font` at `App.tsx` startup. No new dependency is added; the
prior `expo-font` entry in `apps/mobile/package.json` is reused.

**Rationale**: The assumption in the spec is a bundled, offline-capable typeface, and the app
must start with no network. `expo-font` is already a dependency, so bundling the TTFs adds
no dependency and no service call. A runtime web load would violate offline-first
(Principle VII) and the startup splash contract.

**Alternatives considered**:

- `@expo-google-fonts/nunito`: keeps asset wiring simple but adds a large package and an
  implicit versioning surface; rejected for a single typeface under Principle IV.
- A variable font: fewer files and arbitrary weights, but weight support across the RN 0.88
  versions shipped with Expo 58 is less predictable; static weights match the mockups' 400,
  600, 700 and 800 needs.

## Decision 3: Add a shared shape-token module

**Decision**: Create `apps/mobile/src/adapters/ui/theme/shape.ts` exporting the Material 3
shape scale as named numbers, mirroring the existing `spacing.ts`: `xs: 4`, `sm: 8`,
`md: 12`, `lg: 16`, `xl: 28`, `pill: 9999`. Keep Paper's `roundness` at the default `4`,
because `4 × 7 = 28` gives dialogs their required 28 dp corners automatically.

**Rationale**: Rounded radii are a named scale (4/8/12/16/28 dp), not a single multiplier,
so a module is clearer than overloading `roundness` for cards (16), fields (16/14 in
dialogs), strokes (8) and stadium controls (`pill`). Cards use `shape.lg`, small accented
bars `shape.xs`, chips and search fields `shape.pill`, dialog cards keep Paper's
7 × roundness = 28. The new module is the shared home for radii, so a radius stops being an
ad hoc literal in a screen.

**Alternatives considered**:

- Set Paper `roundness` so every component scales by one multiplier: rejected, because the
  mockups use more than one radius and Paper multipliers are coarse (a 4 multiplier cannot
  reach both 16 and 28 without changing dialogs too).
- Inline radius literals in styles: rejected by the design-system rule and invisible to
  review.

## Decision 4: Configure Paper typography from the bundled Nunito weights

**Decision**: Build the Paper theme's `fonts` from Nunito by mapping the Material type roles
to the bundled weights: regular 400 for display/headline/titleLarge/body, semibold 600 for
titleMedium/titleSmall and medium labels, bold 700 for headlines in dialogs where the
mockup is heavier, and extra-bold 800 for appbar titles. Override `fontFamily` per role
with the registered TTF name so weights are applied by the file and not synthetized.

**Rationale**: The mockups are Nunito-only, and French titles are heavier than the MD3
defaults. Paper's `configureFonts` supports per-variant overrides, so a single family can
cover every size while keeping the size/line-height scale intact. Family names are registered
names, not display names, which keeps `useFonts` and the theme aligned.

**Alternatives considered**:

- Override only `fontFamily` and rely on `fontWeight`: rejected on React Native, which does
  not reliably resolve weights from a generic Nunito family for Android.
- Rebuild the whole typescale by hand: broader than needed and a maintenance burden against
  Paper updates.

## Decision 5: Restyle the shared states with soft brand icons, not new copy

**Decision**: `EmptyState` and `ErrorState` keep their existing message and action contracts
and gain a circular `surfaceContainerHigh` icon container with a `primaryContainer` (brand
yellow) glyph. `LoadingState` keeps the "Chargement" label and its activity indicator but
inherits the brand background. No French copy changes.

**Rationale**: FR-012 requires a soft brand-toned circular icon, hierarchically styled
title/message and a recovery action. The current shared states already carry message and
optional action (Principle IX), so adding the icon container reuses the contract and keeps
the screen state model explicit. Copy and accessibility labels remain untouched (FR-020).

**Alternatives considered**:

- New `BrandEmptyState`/`BrandErrorState` components: rejected, because it would leave two
  empty/error components and tempt screens to choose; Principle V requires one shared home.
- SVG illustrations per state: rejected, not in the mockups and adds asset work.

## Decision 6: Green "already in list" marker uses the existing tertiary role

**Decision**: In `ArticleRow`, the `Chip` for `onList` uses Paper's `mode="flat"` with
`Chip` colors driven by `tertiaryContainer`/`onTertiaryContainer` (the green) instead of
the default primary. No new color is added; `tertiary` is already the green seed in
`material-theme.json`.

**Rationale**: The mockups mark already-added articles with a green "Déjà dans la liste"
chip. Tertiary in the export maps to the green family (`#C5ECCE`/`#2C4E38` light), which
is exactly the soft green used in the gallery. This keeps the color single-sourced behind
the existing Material roles and adds one chip style, not a color.

**Alternatives considered**:

- Green from a new neutral palette tone: rejected, because tertiary already provides the
  green contrast and adding a palette breaks "single source" effort for a presentational
  hue.
- Keep the default chip color (primary-ish): rejected, because it would not read as the
  positive "already added" signal the spec asks for.

## Decision 7: Category heading becomes a shared section header component

**Decision**: Add a small shared `CategoryHeader` (or extend `EmptyState`'s sibling
`StateMessage` pattern) that renders a 4 dp brand-yellow bar followed by the category name
in `onSurfaceVariant` semibold. `CurrentListScreen` uses it in `renderSectionHeader`
instead of a plain `List.Subheader`.

**Rationale**: FR-005 requires bold, muted category headings introduced by a small
brand-yellow accent. Putting the 4 dp bar and text in a shared component keeps screens
layout-only (the screen lint rule forbids visual style keys) and makes the accent
reviewable in Storybook.

**Alternatives considered**:

- Style the bar inline in the screen: rejected by the `no-restricted-syntax` layout rule
  for screens and by Principle V.
- Use a `List.Subheader` with an icon: the subheader does not carry a colored leading bar,
  and Material's icon alignment differs from the mockup's 4 dp bar.

## Decision 8: Settings rows and sync strip as shared components

**Decision**: Extract the settings row pattern (44 dp circular `primaryContainer`-soft
icon container, title, subtitle) into a shared `SettingsRow`, and style the sync status
strip with `surfaceContainer` background and rounded `shape.md`. Groups become `Surface`
cards with `shape.lg` and elevation 1.

**Rationale**: The settings screen currently builds its rows inline. The redesign asks for
grouped rounded cards and tonal leading icons; centralizing the row keeps it testable and
reusable, and avoids screen-level visual styling.

**Alternatives considered**:

- Restyle rows directly in `SettingsScreen`: rejected by the screen layout rule and
  duplication across account/device rows.
- A full settings design-system import: rejected as overreach beyond Principle V's shared
  module.

## Decision 9: Native icon and splash artwork is replaced at the asset level

**Decision**: Replace `apps/mobile/assets/icon.png`, the staging icon and foregrounds,
android foregrounds and the splash image with the basket-on-cream artwork, keeping file paths
and the `app.config.ts` / `build-config/app-variant.cjs` configuration untouched. The
splash image asset is unchanged because feature 006 already uses the basket artwork.

**Rationale**: `app.config.ts` and `build-config/app-variant.cjs` resolve icons by path and
variant, already distinguishing production from staging. Swapping the PNGs (and the
staging-only "test" badge) keeps the variants distinguishable without touching build
configuration or adding permissions. No app code change is needed for FR-018/FR-019.

**Alternatives considered**:

- Add a new asset directory or variant flag: rejected, existing paths already cover both
  identities and the staging badge.
- SVG/vector icons at runtime: rejected, native launcher icons must be bitmap assets.

## Decision 10: Keep contrast coverage honest in `used-color-pairs.ts`

**Decision**: Extend `usedColorPairs` with the new draws: the checked marker glyph
(`onPrimaryContainer` on `primaryContainer`), tonal settings icons
(`primary` on `primaryContainer`-soft surface, approximated by `primary` on
`surfaceContainerHigh`), the sync strip text and the dialog icon circles. The WCAG test
already runs in light and dark, so the brand yellow (`#FFDE3F`) against the cream family
and the dark family is verified automatically.

**Rationale**: FR-017 and Principle V require automated contrast verification on the pairs
the app draws. The brand yellow is much brighter than the previous container yellow, so
text/icon roles placed on it must be re-checked; the `primaryContainer`/`onPrimaryContainer`
pair is the critical one and is already listed for ScreenFab.

**Alternatives considered**:

- Add a visual-only review with no automated pair: rejected, because the existing test
  would not fail on a bad new pair introduced during the refresh.

## R11 Summary of unchanged pillars

- No domain, application, navigation, synchronization or storage code changes.
- No new user-facing French copy; all labels remain in the UI adapter.
- No new accessible labels, testID values or screen-state enums.
- Device/E2E journeys and iOS runs keep their current scope and trigger.RESEARCH_EOF
echo "research.md written"