# Privacy and security

- Error reports go to Sentry's EU region (Frankfurt). An organization created in the US region
  cannot be moved and is replaced by a new EU one; the release guard refuses a DSN outside the EU.
- The Expo, Sentry, Google Play Console, App Store Connect and GitHub accounts use two-factor
  sign-in.
- Dependabot security alerts are turned on in the repository settings, with no update bot and no
  automatic pull request; an alert is fixed like any defect.
- A lost or exposed APK key, F-Droid repository key or manifest signing key has its own
  procedure in [Losing or exposing a signing key](procedures/losing-or-exposing-a-signing-key.md); none affects the data on the phones.
- While the app reaches only the maintainer's own phones, sending error reports is personal use.
  It must not reach anyone else (other testers or a store listing) before a privacy notice and a
  lawful basis for sending reports exist (spec Assumptions).
