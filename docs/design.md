# Design

The app follows a Material 3 theme and draws its icons from a Material Symbols font subset. This
page says where each comes from and how to change it. The mockups, the capture of each screen and
the list of files under `design/` are described in [`design/README.md`](../design/README.md).

## Material 3 theme

[`design/material-theme.json`](../design/material-theme.json) is the Material 3 theme export and
the single source of the theme colors. It holds six schemes, but the app reads only `schemes.light`
and `schemes.dark`: the medium- and high-contrast schemes are not used. To change a color, edit
those two, not `seed`, `coreColors` or `palettes`, which the app ignores. The one color outside the
file is the Android adaptive icon background in
[`app.config.ts`](../apps/mobile/app.config.ts).

[`theme.ts`](../apps/mobile/src/adapters/ui/theme/theme.ts) builds the light and dark themes from
those schemes. The rest of the design tokens (typography, the Nunito fonts in `fonts.ts`,
elevation, shape, spacing) sit next to it in `apps/mobile/src/adapters/ui/theme/`;
[`design/README.md`](../design/README.md) lists them.

## Icons

The app uses Material Symbols Rounded, bundled as static font subsets generated from a list of
names. [ADR 0012](adr/0012-material-symbols-icons.md) records why.

After adding or removing a name in
[`symbols.txt`](../apps/mobile/src/adapters/ui/icons/symbols.txt), regenerate the font and the
glyph table, then commit the result:

```sh
design/icons/build-symbols.sh   # needs network access and nix
```

The script rewrites `MaterialSymbolsRounded_500.ttf` and `MaterialSymbolsRounded_700.ttf` in
`apps/mobile/assets/fonts/` and
[`symbols-glyphs.json`](../apps/mobile/src/adapters/ui/icons/symbols-glyphs.json). Rerunning it
without a change leaves no diff.
