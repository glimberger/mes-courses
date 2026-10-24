# ADR-0012: Material Symbols Rounded as the icon set, bundled as generated subsets

- **Status**: Accepted
- **Date**: 2026-10-17
- **Decided by**: proposed by the agent (feature 008 plan)
- **Supersedes**: none
- **Related**: [008 research](../../specs/008-mockup-fidelity-ui/research.md) R5;
  [ADR-0001](0001-react-native-expo.md), [ADR-0003](0003-storybook-on-device.md)

## Context

The approved mockups in `design/mockups/` draw their icons in Material Symbols Rounded at weight
500, and the checkbox mark at weight 700. The app drew Material Design Icons (weight 400, no
rounded style) through Paper's default icon set. React Native cannot set font variation axes, and
the app must load its fonts from the bundle (offline first, no network at runtime).

## Decision

We use Material Symbols Rounded. `design/icons/build-symbols.sh` downloads the variable font from
`google/material-design-icons` at a pinned commit, checks its SHA-256, makes three static instances
(weight 500 with every symbol the app draws, weight 700 with `check` only, and weight 500 with
FILL=1 for `check_circle` only, the selected state of the add toggle) and subsets them to the
names in `apps/mobile/src/adapters/ui/icons/symbols.txt`. The script writes the three TTFs to
`apps/mobile/assets/fonts/` (`MaterialSymbolsRounded_500.ttf`, `_700.ttf`, `_500_filled.ttf`) and the glyph map `symbols-glyphs.json`. The app renders them through
`createIconSet` from `@expo/vector-icons` and hands the set to Paper through `PaperProvider`
`settings.icon`.

## Consequences

- Every icon in the app is a Material Symbol name; a new icon means a new line in `symbols.txt`
  and a rerun of the script, and the generated files are committed with it.
- The build needs `nix` and network access only when the icon list changes; the app itself does
  not.
- The font subsets stay a few kilobytes, and no runtime dependency is added.
- Pinning the commit and the checksum makes the glyph set reproducible; moving the pin is a
  reviewed change to the script.

## Alternatives considered

- `material-symbols-react-native` (SVG path per variant): a new runtime dependency plus
  `react-native-svg`, against the dependency-minimal stack.
- Symbols bundled with React Navigation 8: the app is on React Navigation 7, and an upgrade is out
  of scope for an icon change.
- `MaterialIcons` from `@expo/vector-icons`: weight 400 only, no rounded style; does not match the
  captures.
