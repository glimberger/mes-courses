# Build-time flags

Two flags turn on test-only code at build time. Builds for users never set them: a `production`
build that sets either one stops while reading its configuration and names it, as it does for
`STORYBOOK_ENABLED`, `DETOX_BUILD` and a Sentry DSN outside the EU region
(`apps/mobile/build-config/release-guard.cjs`).

| Flag                                   | What it does                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_SEED_ITEMS=<n>`           | Fills an empty store, on first launch, to the spec's data size: 1 000 French articles (100 at the 60-character limit), 20 lists, `n` items on the current list (half ticked, half with "2 kg") and 50 on each other list |
| `EXPO_PUBLIC_SENTRY_SMOKE_TEST=1`      | Reports one test error at startup, on `CurrentList`                                                                                                                                                                      |
| `EXPO_PUBLIC_SENTRY_SMOKE_TEST=native` | Crashes the app in native code 10 seconds after startup                                                                                                                                                                  |

For example, `EXPO_PUBLIC_SEED_ITEMS=200 eas build --profile staging` makes the measurement build.
