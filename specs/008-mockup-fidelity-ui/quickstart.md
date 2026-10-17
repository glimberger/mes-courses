# Quickstart: Validate the Mockup-Faithful UI

How to prove the feature works. Token and block details:
[data-model.md](data-model.md), [contracts/ui-building-blocks.md](contracts/ui-building-blocks.md).

## Prerequisites

- The repository's Nix dev shell (`nix develop`) and `yarn install` done.
- Xcode with an iOS simulator and an Android emulator, for captures and device suites.
- Run the iOS and Android device runs one after the other, never in parallel (the Mac runs
  out of memory).

## 1. Fast suite, lint, types

```sh
yarn test
yarn lint
yarn format:check
yarn typecheck
yarn test:architecture
```

Expected: all green. Among them:

- `theme.test.ts`: every `styles.css` color token equals its role in
  `design/material-theme.json`, light and dark (SC-004); every pair of
  `used-color-pairs.ts` passes WCAG AA in both appearances (SC-005); every Paper type role uses
  a Nunito family at its mockup size and weight file (SC-003).
- Icon test: every icon name used by a call site or by Paper resolves to a glyph of the bundled
  Material Symbols subset.
- Component tests: each building block applies the tokens of the contract.
- `stories.test.tsx`: every required story exists.
- All existing screen, accessibility and offline tests pass with no label or `testID` renamed
  (SC-006).

## 2. Icon font generation (only when the icon list changes)

```sh
shellcheck design/icons/build-symbols.sh
design/icons/build-symbols.sh
git status --short apps/mobile/assets/fonts apps/mobile/src/adapters/ui/icons
```

Expected: the script verifies the source font checksum, writes the two subset TTFs and
`symbols-glyphs.json`; rerunning it on an unchanged list leaves no diff.

## 3. Side-by-side captures (SC-001, SC-002)

```sh
yarn screenshots:ios
yarn screenshots:android
```

Then compare, for each mockup, the capture of the matching story with
`design/mockups/shots/<n>-<name>.png`:

| Mockup | Story state to compare |
|--------|------------------------|
| 1, 6 | Current list, success, several categories, one checked item, quantities, a long name (light, dark) |
| 2 | Lists, three lists, one current |
| 3 | Add articles: on-list article, addable article, empty category |
| 4 | Sign-in, empty form |
| 5 | Settings, pending sync |
| 7–10 | Quantity, finish-shopping, delete-article, new-list dialogs |
| 11 | Startup splash |
| 12, 13 | Undo snackbar above the FAB (light, dark) |

Expected: no difference in layout, colors, typography, icons or shapes other than sample data,
the status bar and the browser autofill icon. Attach the captures to the pull request
(`gl-pr-screenshots`).

## 4. Text size and appearance (SC-007, US8)

On a simulator, set the text size to the largest accessibility size (200 %) and open the
current list, lists, add articles, sign-in, settings and the four dialogs.

Expected: nothing clipped, titles and names wrap, chips and buttons grow, content scrolls.
Switch to dark appearance and repeat on the current list and a dialog: dark tokens, brand
yellow unchanged.

## 5. Offline (FR-015)

Turn on airplane mode, cold-start the app.

Expected: same typeface and icons as online; no missing-glyph boxes.

## 6. Device suite (SC-006)

```sh
yarn test:e2e:android
# before merging, as the change touches App.tsx font loading but no native configuration:
yarn test:e2e:ios   # recommended, run after the Android suite finishes
```

Expected: every journey passes unchanged.
