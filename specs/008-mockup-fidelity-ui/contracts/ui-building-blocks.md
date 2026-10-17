# UI Contract: Mockup Building Blocks

This contract replaces the visual rules of
[007 ui-identity.md](../../007-basket-identity-ui/contracts/ui-identity.md) where they differ
(typography weights, icon set, shadows, field and checkbox shapes). The behavior contracts of
[001 ui-screens.md](../../001-shopping-lists/contracts/ui-screens.md) and later features stay
in force: no flow, text, accessible label, test identifier, focus move or announcement changes
(FR-012).

Each block is a component of the shared module `apps/mobile/src/adapters/ui/components/`.
Screens compose them and style layout only (Principle V, enforced by lint). Token names refer
to [data-model.md](../data-model.md); "mockup" names the CSS class in
`design/mockups/styles.css`.

## Global rules

| Rule | Requirement |
|------|-------------|
| Typeface | Every text renders a `Nunito_600SemiBold`, `Nunito_700Bold` or `Nunito_800ExtraBold` family through a Paper type role or a `typeOverrides` entry of `typography.ts` (FR-002, SC-003). |
| Icons | Every icon renders Material Symbols Rounded weight 500 through `AppIcon`; the checked checkbox mark uses the weight 700 font (FR-010). |
| Colors | Every color is a theme role; no literal (FR-003, lint `no-color-literals`). |
| Shadows | Only the `elevation.ts` tokens; no `elevation` style or `Surface elevation` on shared blocks (FR-004). |
| Targets | Every interactive element is at least 48 × 48 dp (FR-013). |
| Text size | No `numberOfLines` truncation on titles, names or messages; content scrolls at 200 % (FR-013). |
| Offline | Fonts and icons load from bundled assets only (FR-015). |

## Blocks

| Block | Mockup | Tokens and layout | Status |
|-------|--------|-------------------|--------|
| `ScreenHeader` `large` | `.appbar` | title `headlineMedium` `onSurface`, start-aligned; optional chip 6 dp below; actions `AppbarIconAction` on the end; padding 14 top, 10 bottom, 20 start, 8 end; inside the top safe-area inset | new |
| `ScreenHeader` `center` | `.appbar.center` | title `titleLarge`, centered; optional back action at the start | new |
| `AppbarIconAction` | `.iconbtn` | 48 dp circle, icon 24 `onSurfaceVariant` | changed (icon set) |
| `Chip` | `.chip` | stadium, padding 5/12, gap 5, icon 16, text `labelMedium`; tones `secondary` (`secondaryContainer`/`onSecondaryContainer`), `tertiary` (`tertiaryContainer`/`onTertiaryContainer`), `brand` (`primaryContainer`/`onPrimaryContainer`) | new (wraps Paper `Chip` or `View`+`Text`) |
| `CategoryHeader` | `.section` | bar 4 × 16 dp, radius `bar`, `primaryContainer`; gap 9; text `titleSmall` `onSurfaceVariant`; padding 18 top, 9 bottom, 20 sides; role header | changed |
| `Card` | `.card` | `surfaceContainerLowest`, radius `lg`, shadow `card`; optional `outlined` variant draws a 2 dp `primaryContainer` inner border (current list) | new |
| `BrandCheckbox` | `.checkbox` | 24 dp, radius `checkbox`, 2 dp border; unchecked: `outline` border, transparent; checked: `primaryContainer` fill, `onPrimaryContainer` border and `check` 17 dp at weight 700 | new (replaces Paper `Checkbox.Android` in `ListItemRow`) |
| `ListItemRow` | `.row` | in a `Card`; min height 64; padding 8/6/8/14; checkbox, then name `titleMedium` and quantity `typeOverrides.quantity` (13.5/700) `onSurfaceVariant` on one baseline with a 10 dp gap (wrapping); `edit` and `close` 48 dp icon buttons `onSurfaceVariant`; checked: name `onSurfaceVariant`, struck through, `Nunito_600SemiBold` | changed |
| `ArticleRow` | `.row` (mockup 3) | in a `Card`; name `titleMedium`; trailing `Chip tertiary` "Déjà dans la liste" with `check`, or a 36 dp `brandSoft` circle with `add` (`onBrandSoft`), decorative because the row is the button; `more_vert` menu button | changed |
| `EmptyCategoryCard` | mockup 3 empty category | in a `Card`, min height 56; text `typeOverrides.emptyCategory` (14/600) `onSurfaceVariant` (the mockup's `--muted` fails AA); `Button` `text` action ("Créer un article") | new |
| `ListSummaryRow` | `.rowline` (mockup 2) | in a `Card` (`outlined` when current); padding 14/16; 44 dp `IconCircle` with `format_list_bulleted`; name `titleMedium`, count `bodySmall` `onSurfaceVariant`; `chevron_right` `onSurfaceVariant`, or `Chip brand` "Liste actuelle" with `check` | changed |
| `IconCircle` | `.lead`, `.d-icon` | sizes 44 (rows, icon 24) and 56 (dialogs and states, icon 28); tone `brand` (`brandSoft`/`onBrandSoft`, default) or `error` (`errorContainer`/`onErrorContainer`) | changed |
| `SettingsCard` | `.card.pad` | a `Card` with padding 16 and gap 14 (10 for the actions card) | changed |
| `SettingsRow` | `.rowline` | 44 dp `IconCircle`; title `titleMedium`; subtitle `bodySmall` `onSurfaceVariant`; optional `chevron_right`; gap 14, padding 4/2; no own surface (lives in a `SettingsCard`) | changed |
| Sync strip | `.syncstrip` | full width, `surfaceContainer`, padding 11/20, gap 10, icon 20, text `typeOverrides.syncStrip` (14/700) `onSurfaceVariant` | changed (`SyncStatusBar` on settings) |
| `Button` | `.btn` | stadium; height 50 (screens) or 44 (dialogs, `size="compact"`); text `labelLarge` (`typeOverrides.compactLabel` 14.5 when compact or `text`); icon 20; modes: `brand` (`primaryContainer`/`onPrimaryContainer`), `outlined` (1.5 dp `outline`, text `primary`), `danger` (1.5 dp `error`, text `error`), `dangerFilled` (`error`/`onError`), `text` (`primary`, padding 0/14) | changed (wraps Paper `Button`; touch target stays ≥ 48 dp) |
| `ScreenFab` | `.fab` | 56 dp high, radius `fab`, padding 0/22, gap 9, `primaryContainer`, icon 24 and label `labelLarge` `onPrimaryContainer`, shadow `fab`; 16 dp from the end, 24 dp from the bottom (plus safe-area inset) | changed |
| `SearchField` | `.searchbar` | 54 dp, stadium, `surfaceContainer`, padding 0/18, gap 12, `search` icon and text `bodyLarge` `onSurfaceVariant`; margin 6/16/2 | changed |
| Fields (`NameField`, `PasswordField`, `QuantityFields`, sign-in fields) | `fieldset.field` | Paper outlined `TextInput`; `outlineStyle` radius `lg` on screens, `field` in dialogs; outline 1.5 dp `outline`; label `labelSmall` `onSurfaceVariant` in the top border; text `bodyLarge` `onSurface`; trailing icon `onSurfaceVariant` | changed (shared `fieldStyle(context)` helper) |
| `AppDialog` | `.dialog` | Paper `Dialog` with `surfaceContainerLowest`, radius `xl`, shadow `dialog`, backdrop `backdrop` (`scrim` 0.36); padding 26/24/18, gap 14; optional 56 dp `IconCircle` centered above the title; layout `start` or `centered` (title and message centered); title `titleLarge`; message `bodyMedium` `onSurfaceVariant`; actions end-aligned, gap 8: `Button text` "Annuler" then a compact confirmation (`brand` or `dangerFilled`); optional start action row (quantity dialog's "Effacer la quantité"); content in Paper `Dialog.ScrollArea` when it exceeds the available height | new (wraps Paper `Dialog`; every dialog uses it) |
| `BrandSnackbar` | `.snackbar` | Paper `Snackbar`: `inverseSurface`, radius `lg`, shadow `snackbar`, min height 56, padding 8/6/8/18, margins 16; message `typeOverrides.snackbarMessage` (15/700) `inverseOnSurface`, wrapping; action `typeOverrides.compactLabel` (14.5) `inversePrimary`; bottom 92 dp above a FAB, a notice during an undo offer 64 dp higher | new (used by `UndoSnackbar`, `NoticeSnackbar`) |
| `EmptyState` / `ErrorState` | `.dialog.centered` | 56 dp `IconCircle` (`brand`, or `error` for errors); title `titleLarge`; message `bodyMedium` `onSurfaceVariant` centered; action, "Réessayer" included, a `Button` `brand` (US10-2: stadium action) | changed |
| `LoadingState` | — | `primary` activity indicator on `surface`; label `bodyMedium` | changed (typography only) |
| Brand tile (sign-in) | mockup 4 `img` | 215 dp image, `object-position` 28 % crop, radius 40, shadow `brandTile`, centered | changed (`BrandImage`) |
| Startup splash | `.splash` | checked against mockup 11: 208 dp image, radius 44, gap 42, progress 96 × 5 `surfaceContainer` track and `primaryContainer` bar | check only |

## Screens

Composition each screen must reach (layout only; the blocks carry the look).

| Screen | Composition |
|--------|-------------|
| Current list (mockups 1, 6) | `ScreenHeader large` (title, `Chip secondary` remaining count as today, actions `shopping_cart_checkout`, `format_list_bulleted`, `settings`); sections of `CategoryHeader` + `ListItemRow` cards, 10 dp apart, 16 dp side padding; `ScreenFab` "Ajouter" |
| Lists (mockup 2) | `ScreenHeader center` "Mes listes" (with back action); `ListSummaryRow` cards from 14 dp below; `ScreenFab` "Nouvelle liste" |
| Add articles (mockup 3) | `ScreenHeader large` with `titleLarge` size ("Ajouter des articles", back action, `add` action); `SearchField`; `CategoryHeader` sections of `ArticleRow` cards or an `EmptyCategoryCard` |
| Sign-in (mockup 4) | brand tile; fields 15 dp apart, 24 dp side padding; `Button brand` "Se connecter" 10 dp below; `Button text` "Mot de passe oublié ?" centered |
| Settings (mockup 5) | `ScreenHeader center` "Réglages"; sync strip; sections "Compte", "Serveur", "Appareils", "Actions" as `CategoryHeader` + one `SettingsCard` each, rows and buttons as in US6 |
| Dialogs (mockups 7–10) | `AppDialog`: quantity (`start`, two dialog fields side by side gap 12, start action "Effacer la quantité", `brand` "Enregistrer"); finish (`centered`, `brand` icon `shopping_cart_checkout`, `brand` "Terminer"); delete (`centered`, `error` icon `delete`, `dangerFilled` "Supprimer"); new list (`start`, one dialog field "Nom", `brand` "Créer") |
| Screens and dialogs without a mockup | same blocks: `ScreenHeader center` for secondary screens, `CategoryHeader` sections, `Card`/`SettingsCard`, `AppDialog` for every other dialog (destructive ones `centered` with the `error` icon and `dangerFilled` confirmation) |

## Review contract

| Check | How |
|-------|-----|
| Tokens per block | component tests on rendered styles: role colors, radius, font family, shadow token, sizes |
| Every mockup state has a story | story ids listed in `required-stories.ts`, light and dark |
| Side-by-side captures | `yarn screenshots:ios`, then `yarn screenshots:android`, compared with `design/mockups/shots/` in the PR |
| Colors | SC-004 test (styles.css ↔ export), contrast test on `used-color-pairs.ts` |
| Unchanged behavior | full fast suite and Android device suite green with no label or identifier renamed |
