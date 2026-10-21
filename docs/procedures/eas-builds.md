# EAS builds and error tracking

`apps/mobile/eas.json` has three build profiles. `production` makes the store builds and
`staging` the internal builds installed on a phone; each sets `EXPO_PUBLIC_APP_ENVIRONMENT` to its
name, which Sentry reports as the environment, and gets a new build number on every build
(`appVersionSource: remote`, `autoIncrement`). `development` sets neither. Every profile builds
with the Node version of the flake. `submit.production` sends Android builds to Google Play's
internal testing track; add the App Store Connect app id (`ios.ascAppId`) once the app exists
there (`eas submit` asks for it until then).

The maintainer sets these EAS environment variables (`eas env:create`) for the `production` and
`staging` EAS environments, never committed:

| Variable                 | What it is                                                     |
| ------------------------ | -------------------------------------------------------------- |
| `EXPO_PUBLIC_SENTRY_DSN` | The Sentry DSN; its host ends with `.de.sentry.io` (EU region) |
| `SENTRY_AUTH_TOKEN`      | The Sentry organization credential EAS Build uploads with      |
| `SENTRY_ORG`             | The Sentry organization slug                                   |
| `SENTRY_PROJECT`         | The Sentry project slug                                        |

The upload credential gets EAS's most restricted visibility, so no build log or Expo page shows
it; the other three are plain text (a DSN only allows sending reports, research R25).

The Sentry config plugin warns "Missing config for organization, project" whenever the config is
read: the slugs come from these variables on EAS, and local builds upload nothing.

The Google Play service account and the App Store Connect API key used by `eas submit` are stored
in EAS (`eas credentials`) by the maintainer; nothing in the repository or CI reads them.
