# ADR-0009: Version identity is the commit count on `main`

- **Status**: Accepted
- **Date**: 2026-10-15
- **Decided by**: proposed by the agent, approved by the maintainer
- **Supersedes**: none
- **Related**: [005 research](../../specs/005-continuous-delivery/research.md) R7;
  [ADR-0006](0006-pull-based-continuous-delivery.md),
  [ADR-0007](0007-android-fdroid-distribution.md)

## Context

Three consumers need an ordering of releases: the Pi (to ignore older deliveries), the F-Droid
client (which updates only when `versionCode` grows) and Sentry (to name releases). It must
increase with every commit, be the same on every machine, and need no stored counter. Android
builds no longer come from EAS, so its remote version counter is gone.

## Decision

We use the **sequence** of a commit, `git rev-list --count <sha>` on `main`, as the single
version integer. History is linear because PRs are squash-merged. The sequence is the manifest's
`sequence` and the Android `versionCode` of both app identities (passed as
`ANDROID_VERSION_CODE`; `app.config.ts` fails the build if it is set but not a positive
integer). The server reports `{ version, commit }` from a `build-info.json` in its artifact, and
`-staging.<sequence>` is appended to the version on staging. iOS build numbers stay EAS's remote
counter.

## Consequences

- A re-run of the same commit gives the same sequence, so it is a no-op for the Pi and for the
  F-Droid client.
- Checkouts that compute the sequence need full history (`fetch-depth: 0`).
- The scheme depends on linear history: a merge strategy other than squash would break the
  ordering.
- iOS has its own counter, so the iOS build number and the sequence are unrelated.

## Alternatives considered

- **`github.run_number`**: differs between workflows and resets if one is renamed.
- **A timestamp as version code**: seconds overflow Android's 2,100,000,000 limit within
  decades, and minutes collide for two commits in the same minute.
- **EAS remote versions for Android**: gone with EAS Build for Android.
