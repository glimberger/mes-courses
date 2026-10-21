# Design

The app follows a Material 3 theme and draws its icons from a Material Symbols font subset. This
page says where each comes from and how to change it. The mockups, the capture of each screen and
the list of files under `design/` are described in [`design/README.md`](../design/README.md).

## Material 3 theme

[`design/material-theme.json`](../design/material-theme.json) is the Material 3 theme export and
the single source of every color. It holds six schemes: `light`, `light-medium-contrast`,
`light-high-contrast`, `dark`, `dark-medium-contrast` and `dark-high-contrast`. The `brandSoft`
custom role is in each of them.

The theme is built in code under `apps/mobile/src/adapters/ui/theme/`:

- [`theme.ts`](../apps/mobile/src/adapters/ui/theme/theme.ts) builds the light and dark themes
  from `material-theme.json`.
- [`typography.ts`](../apps/mobile/src/adapters/ui/theme/typography.ts) holds the type scale and
  the mockup sizes that differ from it.
- [`elevation.ts`](../apps/mobile/src/adapters/ui/theme/elevation.ts) holds the shadow tokens.
- [`shape.ts`](../apps/mobile/src/adapters/ui/theme/shape.ts) and
  [`spacing.ts`](../apps/mobile/src/adapters/ui/theme/spacing.ts) hold the radii and the spacing
  scale.

To change a color, edit `material-theme.json`: no color is written anywhere else.

## Icons

The app uses Material Symbols Rounded, bundled as static font subsets generated from a list of
names. [ADR 0012](adr/0012-material-symbols-icons.md) records why.

After adding or removing a name in
[`symbols.txt`](../apps/mobile/src/adapters/ui/icons/symbols.txt), regenerate the font and the
glyph table, then commit the result:

```sh
design/icons/build-symbols.sh   # needs network access and nix
```

The script rewrites the two font files in `apps/mobile/assets/fonts/` and
[`symbols-glyphs.json`](../apps/mobile/src/adapters/ui/icons/symbols-glyphs.json). Rerunning it
without a change leaves no diff.
