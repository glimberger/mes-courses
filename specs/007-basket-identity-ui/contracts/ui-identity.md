# UI Contract: Basket Identity (Visual Refresh)

This contract describes the observable visual identity of the mobile UI after the refresh.
It does not change navigation, user flows, data, sync behavior, accessible labels or test
identifiers (FR-020); it states how a refreshed screen or component must look and be
reviewed. Shared component contracts in [001 ui-screens.md](../../001-shopping-lists/contracts/ui-screens.md)
remain in force and are restyled, not replaced.

## Color contract

| Observable rule | Requirement |
|---|---|
| Primary action surfaces (FAB, contained-tonal buttons, selected marker fill, "Liste actuelle" badge, category accent, leading icon circles) | Render in `primaryContainer` (`#FFDE3F`) with `onPrimaryContainer` (`#3A3000`) text/icons in both appearances. |
| Secondary action/text color (links, outlined-button text, settings leading icons on soft containers) | Render in `primary` (`#6D5E0F` light, `#DBC66E` dark). |
| Already-added article indicator | Render in the green tertiary family (`tertiaryContainer` / `onTertiaryContainer`). |
| Destructive actions (delete-article dialog icon and confirm, error states' error cue) | Render in the error family, never brand yellow. |
| Surfaces | Warm cream family in light (`background` `#FFF9EE`, `surfaceContainer…`), dark family in dark (`#15130B`…). |
| Brand yellow | Unchanged between appearances; contrast is preserved by text color, not by dimming yellow. |

## Typography contract

| Observable rule | Requirement |
|---|---|
| All titles and headings | Render in Nunito (registered weights), not the platform default (FR-002). |
| Appbar titles | Extra-bold (800) Nunito. |
| Dialog titles, screen headings | Bold (700) Nunito. |
| Body and list names | Regular (400) Nunito; long names wrap instead of clipping. |

## Shape contract

| Component | Radius source | Expected |
|---|---|---|
| Card (article row, list row, settings group) | `shape.lg` | 16 dp |
| Field (search stadium, name/quantity inputs) | `shape.pill` for search, `shape.lg` for fields | stadium / 16 dp |
| Chip, badge, button | `shape.pill` / Paper default | stadium |
| Dialog | Paper `7 × roundness` | 28 dp |
| Checkbox marker | `shape.sm` | 8 dp (with 2 dp border in the mockup means 7 + border; keep 8 token) |
| Category accent bar | `shape.xs` | 4 dp |
| Icon circle (settings lead, dialog icon, empty/error icon) | full circle | 50% of size |

## Elevation contract

- Cards: elevation 1 (`surfaceContainerLow` shadow), never flat borders as the only cue.
- FAB: elevation 3.
- Dialogs: elevation 5.
- No component adds its own shadow value outside the theme's elevation scale.

## Screen contracts

### Current list

- Each article is a rounded, elevated card with generous vertical spacing.
- Checked articles keep strikethrough + muted text (`onSurfaceVariant`) and a brand-yellow
  checked marker.
- Category headings are bold, muted and preceded by a 4 dp brand-yellow bar.
- The remaining-count indicator uses brand-typography styling; wrapping allowed.
- The FAB offers adding an article in the brand-yellow treatment.
- The list leaves clearance below its last row for the FAB.

### Lists screen

- Each list is a rounded, elevated card.
- The current list carries a brand-yellow badge labeled "Liste actuelle".
- Empty state shows a friendly message and an action to create the first list.

### Add articles

- Already-present candidates show a green "Déjà dans la liste" indicator and no duplicate
  add action.
- Other candidates offer a clear add action.
- The search field is a rounded stadium control on a neutral surface (`surfaceContainer`),
  in the brand typeface.

### Sign-in

- A basket brand illustration and the application name show at the top.
- The sign-in button uses brand yellow with dark text.
- Forgot-password and create-account actions stay secondary and readable.

### Settings

- Related settings group into rounded cards.
- A sync status strip is distinct and rounded, with a sync indicator.
- Each setting row's leading icon sits in a soft brand-toned circular container.
- A failing sync keeps its recovery action.

### Dialogs

- Standard dialogs: 28 dp corners, brand-typeface title, clear layout.
- Quantity dialog: rounded fields, tertiary action visually secondary.
- Finish-shopping dialog: brand-toned circular icon alongside the confirmation.
- Destructive dialogs (delete article): icon and confirm button use the error color.
- New-list dialog: create action uses brand yellow with dark text.

### Empty and error states

- Soft brand-toned circular icon, hierarchically styled title and message, recovery action
  when one exists.
- Loading, empty, error and content each render through the dedicated shared component.

## Dark appearance contract

- Surfaces swap to the dark family; brand yellow stays `#FFDE3F`; titles and body use
  `onSurface`/`onSurfaceVariant`; contrast uses text color changes, not yellow dimming.
- Every component keeps shape, elevation and spacing in dark mode; only color roles change.

## Accessibility contract

- Existing accessible labels, roles and test identifiers are unchanged (FR-015).
- Interactive targets stay at least 48 dp in both dimensions (FR-015).
- All text wraps or scales without clipping at 200% text size (FR-016).
- Every text/icon color pair drawn by the refresh is added to `usedColorPairs` and passes the
  WCAG test in light and dark (FR-017, SC-003).

## Review contract

- Storybook required-story test and the story test in light and dark remain green.
- Visual review uses the existing on-device Storybook workflow (ADR 0003).
- Screenshot review follows the project's usual screenshot flow (SC-009).

## Non-contracts

- No behavior, data, sync, navigation, accessibility-label or testID change.
- No new screen, copy beyond requirement (no internationalization change).
- No native configuration beyond replacing asset files already referenced by
  `app.config.ts` and `build-config/app-variant.cjs`.
