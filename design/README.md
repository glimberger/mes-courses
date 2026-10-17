# Design

The visual reference of the app and the files that feed its theme and icons.

| Path | What it holds |
| ---- | ------------- |
| `material-theme.json` | The Material 3 theme export, and the single source of every color. It holds six schemes: `light`, `light-medium-contrast`, `light-high-contrast`, `dark`, `dark-medium-contrast` and `dark-high-contrast`. The `brandSoft` custom role (`#FFF1BE`) is in each of them. |
| `mockups/` | The HTML mockups (`1-liste.html` to `13-snackbar-dark.html`) and their `styles.css`. |
| `mockups/shots/` | The PNG capture of each mockup: what a screen of the app is compared with. |
| `icons/build-symbols.sh` | Generates the Material Symbols Rounded font subset and the glyph table the app uses. |
| `splash-screen.png` | The brand image shown on the splash and the sign-in screen. |

## Where the design lives in the code

All of it is under `apps/mobile/src/adapters/ui/theme/`:

- `theme.ts` builds the light and dark themes from `material-theme.json`.
- `typography.ts` holds the type scale and `typeOverrides`, the mockup sizes that differ from it.
- `elevation.ts` holds the shadow tokens (card, FAB, dialog, snackbar, brand tile).
- `shape.ts` and `spacing.ts` hold the radii and the spacing scale.

## Icons

Add a name to `apps/mobile/src/adapters/ui/icons/symbols.txt`, then run
`design/icons/build-symbols.sh` (network access and nix needed). It rewrites the two font files
in `apps/mobile/assets/fonts/` and `symbols-glyphs.json`. Rerunning it without a change leaves
no diff.
