# Quickstart: Validate the Basket-Identity UI Refresh

## Prerequisites

- Repository dependencies installed with `yarn install`.
- An Android emulator, iOS simulator or physical device for visual review; offline mode for the
  offline scenario.
- The mockup gallery (`design/mockups/index.html`) as the visual reference target.

## Fast validation

From the repository root:

```sh
yarn workspace @mes-courses/mobile typecheck
yarn lint
yarn format:check
yarn workspace @mes-courses/mobile test
yarn test:architecture
```

Expected results:

- TypeScript strict checks pass with the new `shape.ts` module and theme wiring.
- ESLint passes, including the screen layout and no-color-literals rules.
- Prettier reports no diff.
- The fast suite passes, including `theme.test.ts` contrast checks in light and dark and the
  required-story test.

## Component-level visual validation

Start the on-device Storybook or development app:

```sh
yarn workspace @mes-courses/mobile storybook
```

Review at least the following in light and dark, with device text size at 100% and 200%:

- `Screens/CurrentList/Success` and `.../AllInCart`: rounded article cards, checked state,
  category header with brand-yellow accent, FAB in brand yellow.
- `Screens/Lists/Success`: rounded list cards and "Liste actuelle" badge.
- `Screens/AddArticles/SearchMatches` and `.../SearchNoMatch`: stadium search field and green
  "Déjà dans la liste" indicator.
- `Screens/SignIn` (or the SignIn screen story): basket brand illustration, app name, brand-yellow
  sign-in button.
- `Screens/Settings` stories: grouped cards, sync strip, tonal leading icons.
- Dialog stories: `QuantityDialog`, `FinishShoppingDialog`, `CreateListDialog`, and a destructive
  delete dialog: 28 dp corners, brand-vs-error coloring.
- `Components/EmptyState` and `Components/ErrorState`: soft brand icon hierarchy.
- `Components/ListItemRow/LongName` at 200% text size: wrapping without clipping.

## Accessibility validation

- Navigate every refreshed screen with a screen reader; confirm all existing accessible
  labels and behavior are unchanged.
- Enable 200% text size and confirm no text or chip is clipped; scrolling remains available.
- Run an automated contrast check in both appearances on all `usedColorPairs`, including the
  brand-yellow pairs.

## Native artwork validation

- Build a production and a staging variant; verify both home-screen icons show the basket brand
  on cream, remain visually distinguishable (staging badge), and the splash keeps the basket
  identity with automatic, network-free transition.
- Force-stop and relaunch: the startup sequence and offline launch behavior are unchanged.

## Observable cases

The expected visual outcomes per requirement are defined in
[contracts/ui-identity.md](contracts/ui-identity.md). Every FR of the spec maps to a test,
story or manual check recorded above; no French copy or accessibility identity changes.
