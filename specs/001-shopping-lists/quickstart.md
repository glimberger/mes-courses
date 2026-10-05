# Quickstart: Validate Shopping Lists

How to check that the feature works, from the automated suite to a hands-on pass on a device.
Behavior is defined in [spec.md](spec.md); screens and text in
[contracts/ui-screens.md](contracts/ui-screens.md).

## Prerequisites

- Nix with flakes enabled. The flake's dev shell provides Node.js 24, Yarn 4 (through Corepack,
  version from `packageManager`) and watchman ([research.md](research.md) R21). Enter it with
  `direnv allow` once (if `direnv` and `nix-direnv` are installed) or `nix develop`; every
  command below runs inside it.
- For device checks: Android Studio with an emulator, or Xcode with an iOS simulator (macOS), or a
  phone with a development build.
- Optional: a Sentry project. Without `EXPO_PUBLIC_SENTRY_DSN`, errors go to the console only.

Commands run from the repository root unless stated otherwise: one `yarn install` installs every
workspace ([research.md](research.md) R20).

```sh
yarn install
```

## 1. Automated checks (same as CI)

```sh
yarn typecheck          # tsc --noEmit in every workspace
yarn lint               # ESLint (includes style-token rules)
yarn format:check       # Prettier
yarn test                   # Jest in every workspace: domain, use cases, SQLite adapter, UI, offline scenario
yarn test:architecture  # dependency-cruiser layer and cross-workspace rules
yarn build              # every workspace; for the app: expo export for Android and iOS
```

Expected: everything passes. `yarn test` finishes in seconds and needs no device or network.
Every acceptance scenario of the spec has a test whose name states it (search the test names for
"US1-", "US2-", ...).

## 2. Run the app

```sh
cd apps/mobile
yarn expo run:android   # or: yarn expo run:ios
```

A development build is used (not Expo Go) because of the Sentry native module.

## 3. Hands-on scenarios on a device

Run on a fresh install (uninstall first). Each step names the spec scenarios it covers.

1. **First launch** (US3-1, US4-1, US1-10): the app opens on "Ma liste" with the empty state
   "Votre liste est vide". Open "Ajouter": the 11 default categories appear in the spec's order,
   each empty.
2. **Create and add** (US2-7, US2-2, US2-11, US2-12, US2-13): create "Lait" in Crèmerie with
   "2" "L"; try an empty name, quantity "0", "abc", and a unit with no quantity, and check the
   French messages. Create "Farine" with "1.5" "kg" and check it shows "1,5 kg".
3. **Search and duplicates** (US2-10, US2-8, US2-9, US2-14): create "Pommes" and
   "Pommes de terre"; search "pom" and "POM"; tap "Lait", check "Déjà dans la liste"; try to
   create " lait "; search "xyz" and check the "no match" state.
4. **Tick in airplane mode** (US1-2 to US1-7, US1-5, SC-002, SC-006): turn on airplane mode, go
   back to the list, tick and untick items. Ticks show at once, ticked items move to the bottom
   of their category, the remaining count updates, no error appears.
5. **Persistence** (US1-4, SC-007): with items ticked, kill the app from the app switcher and
   reopen: ticks are kept. Restart the device once and check again.
6. **Quantity and removal** (US2-3, US2-4, US2-6, US2-16): change "Farine" to "2 kg", clear it,
   remove a ticked item and tap "Annuler": it is back, ticked, with its quantity.
7. **Finish shopping** (US1-8, US1-9): "Terminer les courses" → "Annuler" changes nothing;
   "Terminer" unticks all and keeps all items. With nothing ticked, the action is not offered.
8. **Several lists** (US3-2 to US3-6, US3-8, US2-5, SC-005): create "Barbecue", try "barbecue"
   and a blank name; make "Barbecue" current in two taps from the list; add "Lait" unticked and
   "Farine" with "500 g"; switch back and check "Ma liste" is untouched; kill and reopen while
   "Barbecue" is current.
9. **Categories** (US4-2, US4-3, US4-5): create "Bébé" from the article form, try "bébé";
   create an article in it; only categories with items show on the list.
10. **Accessibility** (FR-032 to FR-035, SC-009): with TalkBack (Android) or VoiceOver (iOS),
    repeat steps 2, 4 and 6 using the screen reader only; each row announces e.g. "Lait, 2 L,
    dans le caddie". Set the system text size to the maximum (200%) and check nothing is cut off
    or overlaps. Check ticked rows show a check mark and struck-through text in light and dark
    mode.
11. **Long list** (SC-008): start a development build with `EXPO_PUBLIC_DEV_SEED_ITEMS=200`
    (the composition root then fills an empty current list with 200 articles through the use
    cases; ignored in release builds), then scroll and tick; no visible lag.
12. **Start time** (SC-001): on a release build (`yarn expo run:android --variant release`, from `apps/mobile/`),
    from tapping the icon to a tickable list takes under 2 seconds.

## 4. Error tracking (Principle VIII)

Build a release with `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_SENTRY_SMOKE_TEST=1` set (the
composition root then reports one test error at startup), and open it: the event appears in Sentry with a readable stack trace, the app version, platform and
environment, and no list content. Repeat in airplane mode, then reconnect: the event arrives
after reconnection.

## 5. Continuous integration

Open a pull request: the `typecheck`, `lint`, `test` and `build` jobs run, and `gh pr checks <pr>`
shows them all green before the pull request is merged (constitution v1.7.0).
