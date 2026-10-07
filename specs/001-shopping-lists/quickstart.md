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
- For the Detox journeys ([research.md](research.md) R23): an Android emulator named
  `Pixel_API_35` (or set `DETOX_AVD_NAME`) with a JDK 17 (the one bundled with Android Studio
  works); for iOS, Xcode and `applesimutils` (`brew tap wix/brew && brew install applesimutils`).
  These stay outside Nix.
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
yarn test               # Jest in every workspace: domain, use cases, SQLite adapter, UI, offline scenario, stories
yarn test:architecture  # dependency-cruiser layer and cross-workspace rules
yarn build              # every workspace; for the app: expo export for Android and iOS
```

Expected: everything passes. `yarn test` finishes in seconds and needs no device or network.
Every acceptance scenario of the spec has a test whose name states it (search the test names for
"US1-", "US2-", ...). `stories.test.tsx` renders every story in light and dark and fails if a story
required by [contracts/ui-validation.md](contracts/ui-validation.md#required-stories) is missing.

## 2. Review the screens in Storybook

```sh
cd apps/mobile
yarn expo run:android   # once, to install a development build (or: yarn expo run:ios)
yarn storybook          # STORYBOOK_ENABLED=true expo start: the app opens on Storybook
```

Expected: the Storybook navigator lists `Components/…`, `Screens/…` and `Dialogs/…`, with every
story of [contracts/ui-validation.md](contracts/ui-validation.md#required-stories). For a pull
request that changes the UI, open each story it lists:

- all text is French and matches [contracts/ui-screens.md](contracts/ui-screens.md);
- colors, type and spacing come from the theme: switch the device to dark mode and check every
  story again;
- at 200% system text size, the `LongName` stories and the success states wrap without cutting
  or overlapping text;
- the same stories look right on Android and on iOS.

Run `yarn start` (without `STORYBOOK_ENABLED`) to get the app back. A release build never
contains Storybook.

## 3. End-to-end journeys (Detox)

```sh
yarn test:e2e:android   # builds the Android release with expo prebuild + Gradle, runs every journey
yarn test:e2e:ios       # macOS only: builds the iOS release for the simulator, runs every journey
```

Expected: every journey in [contracts/ui-validation.md](contracts/ui-validation.md#end-to-end-journeys)
passes on the first try (no retries are configured). A failure leaves screenshots and logs in
`tests/e2e/artifacts/`. In CI the `e2e-android` job runs the Android journeys on every pull
request. Run the iOS journeys before a release and on any pull request that changes
`app.config.ts`, a config plugin or a native dependency.

## 4. Run the app

```sh
cd apps/mobile
yarn expo run:android   # or: yarn expo run:ios
```

A development build is used (not Expo Go) because of the Sentry native module.

## 5. Hands-on scenarios on a device

Run on a fresh install (uninstall first). Each step names the spec scenarios it covers. Steps
1, 5, 6, 7 and 8, and the happy path of step 2, are also automated by the Detox journeys; keep them for a manual pass before a
release. Steps 4, 10, 11, 12, 13 and 14, the timing of step 2 and the background check of step 6, need a person.

1. **First launch** (US3-1, US4-1, US1-10): the app opens on "Ma liste" with the empty state
   "Votre liste est vide". Open "Ajouter": the 11 default categories appear in the spec's order,
   each empty.
2. **Create and add** (US2-7, US2-2, US2-11, US2-12, US2-13, FR-016, FR-017): create "Lait" in
   Crèmerie with "2" "L"; try an empty name, quantity "0", "abc", "1 000", "+2", "1e3",
   "1,2345", "10000", and a unit with no quantity, and check the French messages. Create
   "Farine" with "1.50" "kg" and check it shows "1,5 kg". Then time creating "Pois chiches" in
   "Épicerie salée" with "400" "g" and adding it (SC-004), from tapping "Ajouter" on the current
   list until the item shows on it: under 20 seconds, typing included. Do 3 tries, each with a
   new article ("Pois chiches", then "Lentilles", then "Haricots rouges"), on a reference phone,
   by the maintainer.
3. **Search and duplicates** (US2-10, US2-8, US2-9, US2-14, US2-19): create "Pommes" and
   "Pommes de terre"; search "pom" and "POM"; tap "Lait", check "Déjà dans la liste"; try to
   create " lait " and "Pommes  de  terre" (double spaces): each is refused as already
   existing (FR-021); search "xyz" and check the "no match" state; create "Pâte", search
   "pâté", and from "Nouvel article" create "pâté" with its name prefilled (FR-008); try to
   create " lait " with "1" "L", choose "Ajouter « Lait »": the "already on the list" dialog
   opens (US2-20); create "Lait 10 L" and "Lait 2 L" in Crèmerie: "Lait 2 L" is listed first
   (Assumptions). Count the gestures (SC-003):
   adding "Pommes" by browsing takes at most 3 taps, and by searching at most 3 taps and 3
   letters, tapping the search field and "Ajouter" included.
4. **Airplane mode** (US1-2 to US1-7, US1-5, SC-002, SC-006): turn on airplane mode, go
   back to the list, tick and untick items. Ticks show at once (timed in step 11), ticked items move to the bottom
   of their category, the remaining count updates, no error appears. Then do each of the 12
   actions listed under the spec's Success Criteria: every one succeeds.
5. **Persistence** (US1-4, SC-007): with items ticked, kill the app from the app switcher and
   reopen: ticks are kept. Restart the device once and check again.
6. **Quantity and removal** (US2-3, US2-4, US2-6, US2-16): change "Farine" to "2 kg", clear it,
   remove a ticked item and tap "Annuler": it is back, ticked, with its quantity. Remove another
   item, switch to another app for 10 seconds and come back: "Annuler" is gone (FR-010).
7. **Finish shopping** (US1-8, US1-9): "Terminer les courses" → "Annuler" changes nothing;
   "Terminer" unticks all and keeps all items. With nothing ticked, the action is not offered.
8. **Several lists** (US3-2 to US3-6, US3-8, US2-5, SC-005): create "Barbecue", try "barbecue"
   and a blank name; make "Barbecue" current in two taps from the list; add "Lait" unticked and
   "Farine" with "500 g"; switch back and check "Ma liste" is untouched; kill and reopen while
   "Barbecue" is current.
9. **Categories** (US4-2, US4-3, US4-5): create "Bébé" from the article form, try "bébé";
   create an article in it; only categories with items show on the list.
10. **Accessibility** (FR-032 to FR-035, SC-009): with TalkBack (Android) or VoiceOver (iOS),
    do each of the 12 actions listed under the spec's Success Criteria using the screen reader
    only; each row announces e.g. "Lait, 2 L,
    dans le caddie". Remove an item and wait more than 5 s: "Annuler" is still offered until
    you dismiss it or make another change (FR-010). Remove another item, then turn the screen
    reader off more than 5 s later: "Annuler" disappears at once. Open and close a dialog, remove an item and
    tick one: focus goes to the dialog, back to its opener, to the next row, and stays on the
    ticked row (FR-037). Snackbars and form errors are read out; the remaining count is not
    (FR-038). Set the system text size to the maximum (200%) and check nothing is cut off
    or overlaps. Check ticked rows show a check mark and struck-through text in light and dark
    mode.
11. **Long list** (SC-008): build a `preview` release with the measurement seed,
    `EXPO_PUBLIC_SEED_ITEMS=200 eas build --profile preview` (the composition root then fills
    an empty store to the spec's data size through the use cases: 1 000 articles, 20 lists, and
    200 items on the current list; builds for users never set it). Set up each phone as
    [research.md](research.md) R11 says: screen at 60 Hz (on a ProMotion iPhone, Accessibility →
    Motion → Limit Frame Rate), airplane mode on, battery saver off, screen reader off, default
    text size, light theme, other apps closed. Record a 10-second scroll with Android's GPU
    rendering profile (`adb shell dumpsys gfxinfo <package>`, "Janky frames") and with Xcode
    Instruments' Animation Hitches on iOS: at least 55 frames per second on average, and at most
    5% of frames dropped (a dropped frame misses its display deadline). Film 50 ticks and
    unticks with a second phone's slow-motion camera (240 frames per second), tapping as fast as
    you can (about 3 per second) on different items: at least 48 of them show within 100 ms (24
    frames) of the finger touching the screen (SC-002, SC-008).
12. **Start time** (SC-001): on the build and setup of step 11, stop the app completely (swipe
    it away) and film the screen in slow motion. Time from the frame where the finger touches
    the icon to the first frame where the current list is fully drawn; your own reaction
    before tapping is not counted. Then tap an item: it ticks or unticks within 100 ms, as in step 11.
    Repeat 10 times: at least 9 launches are under 2 seconds.

13. **Power cut** (FR-028, SC-007): on an Android emulator running the release build, tick an
    item, then about one second after the tick shows (so its save has finished, SC-007), run
    `adb emu kill` (the emulator stops like a phone
    losing power) and cold boot it: the tick is still there. Repeat once with a removal and with
    "Terminer les courses".
14. **System backup** (Assumptions, [research.md](research.md) R18b), once before the first
    release: on Android, with lists created, run `adb shell bmgr backupnow <package>` (the
    `android.package` of `app.config.ts`), uninstall, reinstall from the same build and
    check the lists come back. On iOS, back up the phone (Finder or iCloud), restore it and
    check the lists come back. The startup error state (FR-039) and the "update required"
    state (FR-040) cannot be caused by hand on a normal build; their stories and `App.test.tsx`
    cover them.
15. **Add screen at full catalog size** (SC-011, [research.md](research.md) R11a): on the build
    and setup of step 11, film the screen in slow motion. From the current list, tap "Ajouter"
    10 times (going back each time): at least 9 times, the articles show within 1 second of the
    finger touching "Ajouter". Then type 30 letters into the search field as whole words at normal
    speed (about 3 letters per second), words the seed contains such as "pommes", "lait",
    "farine", clearing the field between words: for at least 29 of them (95%), within 300 ms of
    the finger touching the letter, the list shows the results for the text in the field.

Steps 4, 11, 12 and 15 (SC-001, SC-002, SC-008, SC-011) are run on the two reference phones
of the spec: an entry-level Android phone about five years old, and the maintainer's iPhone.
Record each result per phone in the pull request's test plan. A target missed on either phone
blocks the release until it is met; record the miss, its cause and the measurement after the
fix ([research.md](research.md) R11).

## 6. Error tracking (Principle VIII, FR-030, FR-030a)

This is the spec's manual check for error tracking, run before each release on one of the
reference phones, with a `preview` build from EAS (`eas build --profile preview`), which has the
DSN. Build it with `EXPO_PUBLIC_SENTRY_SMOKE_TEST=1` set (the composition root then reports one
test error at startup).

Time each delivery: every report must appear in Sentry within 1 minute (SC-010).

1. Open it with the network on: within 1 minute of startup, the event appears in Sentry under
   the `preview` environment,
   with a stack trace that names source files and functions (not minified code), the version
   and build number ("1.2.0 (42)"), the device model and system version, and an operation and
   a screen.
2. In the same event: no list content, no error message text, no user, no installation id and
   no device name (the name given to the phone in its settings).
3. Stop the app and open it again: the same test error is reported a second time, since each
   opening may send it once (FR-030).
4. Turn on airplane mode, stop the app, open it again (a third test report), stop it, and
   restart the phone. Open the app, still in airplane mode, wait 10 seconds, then turn airplane
   mode off with the app open: within 1 minute, the reports raised offline arrive in Sentry,
   readable like the first one.
5. Build again with `EXPO_PUBLIC_SENTRY_SMOKE_TEST=native`: 10 seconds after startup, the app
   crashes in native code. Open it again: within 1 minute, the crash arrives in Sentry with the
   operation `uncaught` and the screen shown, no device name and no list content; its only
   identifier is the random installation id.
6. On a development run (`EXPO_PUBLIC_SENTRY_SMOKE_TEST=1 yarn start`), the same test error: it is printed in the
   console, and nothing arrives in Sentry.
7. Once, when error tracking is set up (FR-030c): in Sentry, the project has the two alert rules
   of [research.md](research.md) R13, both on `production` only, and no other rule; "Send test
   notification" on each one delivers an email to the maintainer. The preview reports of steps
   1 to 5 have sent no email.

## 7. Continuous integration

Open a pull request: the `typecheck`, `lint`, `test`, `build` and `e2e-android` jobs run, and
`gh pr checks <pr>` shows them all green, none failing, pending or skipped, before the pull
request is merged (constitution v2.1.1, Quality Gates).

## 8. Release (spec Success Criteria, [research.md](research.md) R24)

A release is a `production` build. Run these steps in order; stop at the first that fails.

1. The pull request that leads to the release sets `version` in `apps/mobile/app.config.ts`
   (MINOR for a new feature, PATCH for fixes only; this feature ships as 1.0.0), and its test
   plan records, on its last commit: every manual check of §5 and §6 on the reference phones,
   and the iOS device suite (`yarn test:e2e:ios`) on the maintainer's Mac.
2. Once it is merged with every CI job green, from `main` at its squash commit, with nothing
   merged after it (otherwise run the checks again on a new pull request):
   `eas build --profile production --platform all`. A build with `EXPO_PUBLIC_SEED_ITEMS`,
   `EXPO_PUBLIC_SENTRY_SMOKE_TEST`, `STORYBOOK_ENABLED` or `DETOX_BUILD` set, or with a Sentry
   DSN outside the EU region, stops with an error naming it; fix it and build again.
3. `eas submit --profile production --platform all`: the Android build goes to Google Play's
   internal testing track, the iOS build to TestFlight. The very first Android upload is made
   by hand in the Play Console, once. In the Play Console's App bundle explorer, the release
   lists `android.permission.INTERNET` as its only permission (FR-041,
   [research.md](research.md) R25); any other stops the release until it is removed or
   justified in the plan.
4. Install the update on both phones from Google Play (internal testing) and TestFlight, open
   it: the lists are still there, and the system's app settings show the new version and build
   number.

A faulty release is fixed forward: a new pull request with the fix, then these steps again.
There is no rollback (FR-040).
