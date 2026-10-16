# Data Model: Basket-Identity UI Refresh

This feature introduces no persisted, synchronized or domain data entity. Its "data" is a set
of design tokens and shared presentation states consumed by the UI adapter.

## Theme color roles (from `design/material-theme.json`)

The Material 3 roles below are the only color inputs the app uses. Roles marked "changed" move
with this feature; every other role keeps its existing value.

| Role | Light | Dark | Use in the refresh | Changed |
|---|---|---|---|---|
| `background` / `surface` | `#FFF9EE` | `#15130B` | warm cream / dark surface (shell, cards sit on it) | no |
| `surfaceContainerLowest` | `#FFFFFF` | `#100E07` | card background | no |
| `surfaceContainer` | `#F4EDDF` | `#222017` | sync strip, search field surface, secondary containers | no |
| `surfaceContainerHigh` | `#EEE8DA` | `#2D2A21` | hairlines, empty/error icon circle | no |
| `onSurface` | `#1E1B13` | `#E8E2D4` | body text, dialog titles | no |
| `onSurfaceVariant` | `#4B4739` | `#CDC6B4` | muted text, category headings, quantities | no |
| `primary` | `#6D5E0F` | `#DBC66E` | links, outlined-button text, tonal leading icons on a soft container | no |
| `primaryContainer` | `#FFDE3F` | `#FFDE3F` | brand yellow action color: FAB, contained-tonal buttons, checked marker, badges, accents | **yes** |
| `onPrimaryContainer` | `#3A3000` | `#3A3000` | dark text/icons on brand yellow | **yes** |
| `secondaryContainer` | `#EEE2BC` | `#4E472A` | chips (`chip.secondary`) | no |
| `tertiaryContainer` | `#C5ECCE` | `#2C4E38` | green "Déjà dans la liste" indicator | no |
| `onTertiaryContainer` | `#2C4E38` | `#C5ECCE` | green indicator text/icon | no |
| `error` / `errorContainer` | `#BA1A1A` / `#FFDAD6` | `#FFB4AB` / `#93000A` | destructive dialog icon and confirm button | no |

The soft brand circle used for settings/dialog icons is approximated by
`surfaceContainerHigh`; the contrast pair recorded in `usedColorPairs` is therefore
`primary` on `surfaceContainerHigh`.

Color values are resolved at runtime from `design/material-theme.json` through `buildTheme` in
`apps/mobile/src/adapters/ui/theme/theme.ts`; no color is typed as a literal in the app.

## Shape tokens (`apps/mobile/src/adapters/ui/theme/shape.ts`, new)

| Token | dp | Material role | Used for |
|---|---|---|---|
| `xs` | 4 | extra small | category accent bar ends, small strokes |
| `sm` | 8 | small | checkboxes, compact strokes |
| `md` | 12 | medium | cards-inside gestures, small surfaces |
| `lg` | 16 | large | cards, fields, list rows, icon circles (large) |
| `xl` | 28 | extra large | dialogs, bottom sheets, easter cards |
| `pill` | 9999 | full | stadium search field, chips, buttons, badges |

Paper's own `roundness` stays `4`, so `Dialog` keeps `7 × 4 = 28` dp corners without code.

## Spacing tokens (unchanged, `spacing.ts`)

`xs 4, sm 8, md 16, lg 24, xl 32`, on the 4 dp grid. The refresh uses these; it does not
define new spacing values.

## Typography (bundled Nunito)

| Registered family | Weight | Where it is used |
|---|---|---|
| `Nunito_400Regular` | 400 | body, display/headline/titleLarge by default |
| `Nunito_600SemiBold` | 600 | titleMedium, titleSmall, labels, buttons |
| `Nunito_700Bold` | 700 | card titles, list titles, dialog headings when heavier |
| `Nunito_800ExtraBold` | 800 | appbar titles |

Registered names (not CSS family names) are used in the theme's `fonts` map so React Native
picks the actual file on both platforms.

## Shared component presentation states (unchanged types, restyled)

- `ScreenState` remains `loading | empty | error | success`; `ScreenStateView`, `LoadingState`,
  `EmptyState`, `ErrorState` stay the single components for those states (Principle IX). Only
  their visuals change: themed surface, soft brand icon, hierarchy.
- `ListItemRow` keeps `inCart` strikethrough/muted and gains a rounded card shell; its
  accessible label and actions are unchanged.
- `ArticleRow` keeps the `onList` accessibility label and gains the green indicator chip.
- `ScreenFab` keeps `colors.primaryContainer`/`colors.onPrimaryContainer`, which now resolve
  to the brand yellow.

## Native artwork (no data model)

- `apps/mobile/assets/icon.png`, `staging/icon.png`, `android-icon-foreground.png`,
  `staging/android-icon-foreground.png`, `android-icon-monochrome.png`,
  `staging/android-icon-monochrome.png` are replaced with basket-on-cream artwork.
- `apps/mobile/assets/splash-screen.png` is unchanged (already basket on cream).
- `apps/mobile/assets/fonts/*` is added.

## Persistence and synchronization

None. No migration, no schema, no sync protocol or merge rule changes. The change added no
table, column, setting or stored value.
