# ADR-0015: Production promotes the staging server archive instead of building it

- **Status**: Proposed
- **Date**: 2026-11-10
- **Decided by**: proposed by the agent, approved by the maintainer (option 1 of #204: reuse the
  server only)
- **Supersedes**: none (revises one statement of [ADR-0006](0006-pull-based-continuous-delivery.md)
  and one of [ADR-0009](0009-version-identity-from-git.md), see Consequences)
- **Related**: [010 spec](../../specs/010-release-staging-promote/spec.md);
  [ADR-0008](0008-signed-delivery-manifests.md);
  [ADR-0011](0011-stop-copy-validate-rollback.md)

## Context

ADR-0006 says GitHub Actions "builds everything", and the production release rebuilt the server
from the tagged commit, although the same commit had already been built, delivered and tested on
staging, and the release gate requires that staging delivery to be green. The rebuild cost
about two minutes per release and, more importantly, shipped to production bytes that were not the
ones validated on staging.

The Android build cannot be reused the same way: the sync server URL, the package id, the name
and the icon are fixed when it is built (spec 013, `APP_VARIANT`). The server has no such build
input: the environment (port, data folder, Sentry environment) comes from the systemd unit at run
time. The only environment-specific content of the archive was `apps/server/build-info.json`,
holding the version (`X.Y.Z-staging.<n>` on staging, `X.Y.Z` in production), the commit and the
sequence.

## Decision

The production release **promotes** the server archive that staging delivered for the tagged
commit; it never builds one.

- The `server-artifact` job of `Release` becomes a download and verification job. It reads the
  `channel-staging` manifest, takes its server entry and downloads the asset. The entry is
  reusable when its commit is the tagged commit, or an ancestor of it with no change since that
  affects the server (the rules of `.github/scripts/delivery-targets.sh`): staging builds the
  server only when a commit changes it, and the tagged commit is usually the version bump, which
  does not.
- The checksum is compared twice: by the delivery workspace (`ci fetch-staging-server`) and by
  the workflow (`check-staging-server.sh`), against the SHA-256 in the staging manifest. A missing
  manifest, an entry that is not an ancestor of the tagged commit (staging has moved on), a server
  change since the entry, a missing asset or a checksum mismatch stops the release with a
  message. There is no silent rebuild: the fix is to deliver the commit to staging, or to tag a
  commit staging has delivered.
- The release gate runs the same lookup, so a release that cannot reuse the archive stops before
  the Android build starts. Nothing is published before the `publish` job, which comes after.
- **Nothing environment-specific is baked into the archive.** `pack-server.sh` no longer writes
  `build-info.json`. The agent writes it when it installs a release, from the manifest entry
  (`version`, `commit`, `sequence`), so staging reports `X.Y.Z-staging.<n>` and production
  `X.Y.Z` from the same bytes. The agent version becomes 1.1.0, and the manifests require it
  (`minAgentVersion`), so an older agent refuses them instead of starting a server that reports
  the commit `dev`.
- The production `publish` step still goes through `write-manifest`: it hashes the file and
  writes a production entry (commit and sequence of the tagged commit, version `X.Y.Z`) and signs
  it. The asset is uploaded under `server-<tagged commit>.tar.gz`; only its name differs.

## Consequences

- The server running in production is byte-identical to the one validated on staging, and a
  release is two minutes shorter in runner time (the `pnpm build` and packing steps). The release
  still lasts as long as the Android build, which runs in parallel and takes about 20 minutes.
- A release can only promote what staging still holds: once a later server change has reached
  staging, an older tagged commit cannot be released. This matches the `promote` command, which
  always targets the version on `origin/main`.
- The staging manifest is read through the authenticated GitHub API of this repository, and its
  signature is verified in CI against the committed `deploy/allowed_signers` (the same check as
  the agent's) before its checksum is trusted, both by the release gate and by
  `ci fetch-staging-server`. Production re-signs the archive under its own key, so without this
  check anyone able to edit the `channel-staging` assets could have a swapped archive and
  checksum laundered into a production release.
- The agent must be updated by hand to 1.1.0 before the first delivery that uses archives
  without `build-info.json` ([updating the agent](../procedures/updating-the-agent.md)). Archives
  built before this change still hold a `build-info.json`, which the agent overwrites.
- **Revises ADR-0006**: "GitHub Actions builds everything" now reads: Actions builds the server
  once, for staging, and the Android build per environment; production promotes the server.
- **Revises ADR-0009**: the server reports `{ version, commit }` from a `build-info.json` written
  by the agent at install, not from one in the artifact.

## Alternatives considered

- **Rebuild the server for production** (before): costs time and ships bytes nobody tested.
- **Rewrite `build-info.json` inside the staging archive at release time**: the archive would no
  longer be byte-identical, and the checksum comparison would prove nothing.
- **A different file name or version at install time via an environment variable**: it needs
  per-instance configuration on the Pi for what the manifest already says.
- **Reuse the APK as well**: impossible, the server URL and the app identity are build-time inputs
  (spec 013).
