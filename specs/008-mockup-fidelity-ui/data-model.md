# Data Model: Mockup-Faithful UI

This feature has no domain entity, stored data, migration or protocol change. Its "data" is
the set of design tokens the shared UI reads. Reference values: `design/mockups/styles.css`.
Decisions behind each table: [research.md](research.md).

## Color roles

Single source: `design/material-theme.json` (Principle V). Changes to the export:

| Role | Scheme(s) | Before | After | Why |
|------|-----------|--------|-------|-----|
| `surfaceContainerLowest` | dark | `#100E07` | `#1E1B13` | card role in both appearances (R1) |
| `surfaceContainerLowest` | dark-medium-contrast | `#090703` | `#201D15` | same, contrast variant |
| `surfaceContainerLowest` | dark-high-contrast | `#000000` | `#222017` | same, contrast variant |
| `brandSoft` (new) | all six | — | see R2 | soft yellow of icon circles, round add button |
| `onBrandSoft` (new) | all six | — | each scheme's `primary` | content on `brandSoft` |
| `scrim` | all six | `#000000` | `#141108` | warm mockup scrim and snackbar shadow (R3) |
| `shadow` | three light schemes | `#000000` | `#1E1B13` | warm mockup card and dialog shadow (R3) |

Derived in `theme.ts`: `backdrop` becomes `scrim` at 0.36 (was 0.4).

### Mockup token → role map

Checked by the SC-004 test, which reads `styles.css` and the export. Every pair must be equal
in light (`:root`) and dark (`body.dark`); a token absent from `body.dark` keeps its light
value in dark.

| `styles.css` token | Role |
|--------------------|------|
| `--bg` | `surface` (and `background`) |
| `--card` | `surfaceContainerLowest` |
| `--container` | `surfaceContainer` |
| `--on-surface` | `onSurface` |
| `--on-surface-var` | `onSurfaceVariant` |
| `--muted` | `outline` |
| `--hairline` | `surfaceContainerHigh` |
| `--primary` | `primary` |
| `--yellow` | `primaryContainer` |
| `--on-yellow` | `onPrimaryContainer` |
| `--yellow-soft` | `brandSoft` |
| `--secondary-container` / `--on-secondary-container` | `secondaryContainer` / `onSecondaryContainer` |
| `--tertiary-container` / `--on-tertiary-container` | `tertiaryContainer` / `onTertiaryContainer` |
| `--error` | `error` |
| `--inverse-surface` / `--inverse-on-surface` / `--inverse-primary` | same-named roles |
| `.dialog` background `#ffffff` | `surfaceContainerLowest` |
| `.d-icon.error` `#ffdad6` / `#93000a` | `errorContainer` / `onErrorContainer` (light) |
| `.btn.pill.error` text `#ffffff` | `onError` (light) |
| shadow colors `rgb(30 27 19)`, `rgb(58 48 0)`, `rgb(20 17 8)`, black in dark | `shadow`, `onPrimaryContainer`, `scrim` |

### Contrast pairs added to `used-color-pairs.ts`

| Foreground | Background | Kind | Drawn by |
|------------|------------|------|----------|
| `onBrandSoft` | `brandSoft` | graphic | `IconCircle`, round add button |
| `onSecondaryContainer` | `secondaryContainer` | text | remaining-articles chip |
| `onPrimaryContainer` | `surfaceContainerLowest` | graphic | checked checkbox outline (light) |
| `primaryContainer` | `surfaceContainerLowest` | graphic | checked checkbox fill (dark); listed for both, the test asserts at least one of the two passes per scheme |
| `inverseOnSurface` | `inverseSurface` | text | snackbar message |
| `inversePrimary` | `inverseSurface` | text | snackbar action |
| `onError` | `error` | text | filled delete confirmation |
| `onSurfaceVariant` | `surfaceContainer` | text | sync strip, search placeholder (already covered by `onEveryBackground`) |

The surface backgrounds list gains nothing new: `surfaceContainerLowest` is already in it.

## Type scale

`theme/typography.ts`, applied to every Paper MD3 role. Family = registered file name; the
weight is the file. Line height = size × 1.25 rounded, except where noted.

| Paper role | Size | Weight (file) | Used for (mockup class) |
|------------|------|---------------|-------------------------|
| `displayLarge/Medium/Small` | Material default | 800 | unused, kept on the brand weight |
| `headlineLarge` | 32 | 800 | unused |
| `headlineMedium` | 28, letter-spacing −0.2 | 800 | current list title (`.appbar h1`) |
| `headlineSmall` | 24 | 800 | unused |
| `titleLarge` | 22, letter-spacing −0.2 | 800 | centered titles, add-articles title, dialog titles |
| `titleMedium` | 16.5 | 700 | item, list, article and setting names (`.name`, `.t1`) |
| `titleSmall` | 14, letter-spacing 0.2 | 800 | category and section headings (`.section h2`) |
| `bodyLarge` | 16 | 600 | field text, search text (`input`, `.searchbar`) |
| `bodyMedium` | 15, line height 1.45 | 600 | dialog messages, state messages (`.dialog p`) |
| `bodySmall` | 13 | 600 | secondary lines (`.t2`) |
| `labelLarge` | 15.5 | 800 | buttons, FAB (`.btn`, `.fab`) |
| `labelMedium` | 13 | 700 | chips (`.chip`) |
| `labelSmall` | 12.5 | 700 | field labels (`legend`) |

Registered families: `Nunito_600SemiBold`, `Nunito_700Bold`, `Nunito_800ExtraBold`
(`Nunito_400Regular` stays registered as Paper's `default` fallback only; no role uses it).

### Type overrides

Mockup sizes outside the scale, exported as `typeOverrides` by `ui/theme/typography.ts`. They are
the only place a size or family differs from a role; components never write a `fontSize` literal.

| Entry | Base role | Size | Family | Use (mockup class) |
|-------|-----------|------|--------|--------------------|
| `quantity` | `labelMedium` | 13.5 | `Nunito_700Bold` | item quantity (`.row .qty`) |
| `compactLabel` | `labelLarge` | 14.5 | `Nunito_800ExtraBold` | dialog and text buttons, snackbar action (`.btn.pill`, `.btn.text`) |
| `snackbarMessage` | `bodyMedium` | 15 | `Nunito_700Bold` | snackbar message (`.snackbar .s-text`) |
| `syncStrip` | `bodySmall` | 14 | `Nunito_700Bold` | settings sync strip (`.syncstrip`) |
| `emptyCategory` | `bodySmall` | 14 | `Nunito_600SemiBold` | empty-category text (mockup 3) |

## Shapes

`theme/shape.ts` gains the radii the mockups use and the Material scale lacks:

| Token | dp | Used for |
|-------|----|----------|
| `xs` | 4 | (existing) |
| `checkbox` | 7 | checkbox |
| `md` | 12 | (existing) |
| `field` | 14 | fields in dialogs |
| `lg` | 16 | cards, screen fields, snackbar |
| `fab` | 18 | extended FAB |
| `xl` | 28 | dialogs |
| `pill` | 9999 | chips, buttons, search field |
| `bar` | 2 | category bar ends |

## Elevation (shadows)

`theme/elevation.ts` exports `shadows(theme)` returning `boxShadow` strings built from roles
(R3): `card`, `fab`, `dialog`, `snackbar`, `brandTile`. No other shadow or `elevation` value is
used by a shared component.

## Spacing

The mockups use 2–4 dp steps the 4 dp grid does not hold everywhere (9, 14, 18, 22). The
existing `spacing` tokens stay; components that need a mockup measure take it from a named
constant inside the component (for example `ROW_MIN_HEIGHT = 64`), never in a screen. The
screen lint rule is unchanged.

## Icon set

`apps/mobile/src/adapters/ui/icons/`: `symbols-glyphs.json` (generated, name → code point),
`AppIcon` (from `createIconSet`), and `aliases.ts` (Paper and legacy names → symbol names).

| Use | Current name | Material Symbol |
|-----|--------------|-----------------|
| Finish shopping | `cart-check` | `shopping_cart_checkout` |
| Lists, list card | `format-list-bulleted` | `format_list_bulleted` |
| Settings | `cog` | `settings` |
| Add (FAB, header, round add) | `plus` | `add` |
| Edit quantity | `pencil-outline` | `edit` |
| Remove, clear | `close` | `close` |
| Check (chips, checkbox) | `check` | `check` (checkbox: weight 700 font) |
| Row menu | `dots-vertical` | `more_vert` |
| Chevron | — | `chevron_right` |
| Search | Paper `magnify` | `search` |
| Password toggle | `eye-outline` / `eye-off-outline` | `visibility` / `visibility_off` |
| Account | `account` | `account_circle` |
| Server | `server-network` | `dns` |
| Device | — | `smartphone` |
| Sync now | — | `sync` |
| Sign out | — | `logout` |
| Delete | `delete-outline` | `delete` |
| Invite | `account-plus` | `person_add` |
| Empty state | `basket-outline` | `shopping_basket` |
| Error state | `alert-circle-outline` | `error` |
| Sync statuses | `cloud-check-outline`, `cloud-clock-outline`, `progress-upload`, `cloud-alert-outline`, `cloud-off-outline`, `pause-circle-outline`, `update` | `cloud_done`, `cloud_upload`, `cloud_sync`, `cloud_alert`, `cloud_off`, `pause_circle`, `update` |
| Back (Paper) | `arrow-left`, `chevron-left` | `arrow_back` |
| Paper internals | `menu-down`, `minus`, `checkbox-*`, `radiobox-*` | `arrow_drop_down`, `remove`, unused once `BrandCheckbox` and `RadioItem` render their own |

The generation script reads the symbol names from `aliases.ts` and the call sites' list in
the same module, so the font and the map never drift; the icon test asserts every name
resolves to a glyph.

## State

No screen-state type changes (Principle IX): loading, empty, error, success and sync states
keep their models; only their shared components change look.
