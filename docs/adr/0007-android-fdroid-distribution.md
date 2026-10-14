# ADR-0007: Android leaves EAS and Google Play for a self-hosted F-Droid repository

- **Status**: Proposed
- **Date**: 2026-10-14
- **Decided by**: maintainer
- **Supersedes**: none (amends how [ADR-0001](0001-react-native-expo.md) uses EAS Build: iOS only)
- **Related**: [005 research](../../specs/005-continuous-delivery/research.md) R7, R11, R12, R13,
  R14; [ADR-0006](0006-pull-based-continuous-delivery.md)

## Context

Android builds were made by EAS Build and reached users through Google Play's internal testing
track. The users are a few invited people. Google Play adds a review step, a developer account
and its policies. EAS Build counts toward the plan's monthly build allowance. The maintainer
wants Android delivered on every change, outside both. iOS has no comparable alternative to
TestFlight and keeps EAS.

## Decision

We build and sign Android APKs in **GitHub Actions**: `expo prebuild`, Gradle, then `zipalign`
and `apksigner` with an upload key held as GitHub secrets and backed up offline. The
`versionCode` is the commit's position on `main`.

We distribute them through **two F-Droid repositories** (staging and production), served by the
Pi's Caddy. CI generates them with `fdroidserver` and signs their index with a separate
repository key. Phones follow them with F-Droid or Droid-ify, which pin the repository
fingerprint and notify updates.

**iOS keeps EAS Build and EAS Submit**: TestFlight for production, EAS internal (ad hoc)
distribution for staging. GitHub Actions starts these builds with an Expo robot token.

A staging variant of the app (`com.glimberger.mescourses.staging`, "Mes courses (test)")
installs next to the production app on both platforms.

## Consequences

- Android delivery depends on no store and no EAS allowance. It costs runner minutes instead.
- The app's Android signing identity changes. Phones with the Google Play build must uninstall
  it, which erases the local replica, and then reinstall. A guide makes them check that
  everything is synchronized first.
- Losing the upload key means every Android user reinstalls. The key is kept in two places.
- Sentry's source maps and native debug files are uploaded by the Gradle build in Actions, as
  EAS did.
- Users must install an F-Droid client.

## Alternatives considered

- **Keeping Google Play**: excluded by the maintainer.
- **A plain APK download page**: no update notifications and no fingerprint pinning.
- **Obtainium following GitHub Releases**: the repository is private.
- **`eas build --local` in Actions**: still EAS tooling and credentials, for no gain.
