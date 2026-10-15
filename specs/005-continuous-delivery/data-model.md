# Data Model: Continuous Delivery to Staging and Production

This feature adds no table to the app or the server database. Its data is delivery metadata: what
CI publishes, what the Pi records, and what the server reports. All types live in
`apps/delivery/src/domain/` unless noted. The server's `BuildInfo` is its own (Principle XI: the
server does not depend on `apps/delivery`).

## Environment

A value, not a record: `'staging' | 'production'`.

| Attribute            | Staging                              | Production                         |
| -------------------- | ------------------------------------ | ---------------------------------- |
| Channel release tag  | `channel-staging`                    | `channel-production`               |
| systemd instance     | `mes-courses@staging`                | `mes-courses@production`           |
| Local port           | 3001                                 | 3000                               |
| Validation port      | 3101                                 | 3100                               |
| Android application  | `com.glimberger.mescourses.staging`  | `com.glimberger.mescourses`        |
| Sentry environment   | `staging`                            | `production`                       |

The agent's configuration maps each environment to its port and paths
([contracts/pi-layout.md](contracts/pi-layout.md)). Nothing else is configurable (Principle IV).

## Sequence

A positive integer: the number of commits reachable from a commit of `main`
(`git rev-list --count`, research R7). Two commits of `main` compare by sequence. It also serves as
the Android `versionCode`.

## ChannelManifest

What CI publishes for one environment, and the Pi's only input. The JSON format and its signature
are in [contracts/channel-manifest.md](contracts/channel-manifest.md).

| Field             | Type                       | Rule                                                                  |
| ----------------- | -------------------------- | --------------------------------------------------------------------- |
| `schema`          | `1`                        | An unknown schema is refused (reported, nothing deployed)             |
| `environment`     | Environment                | Must equal the channel the Pi read it from                            |
| `sequence`        | Sequence                   | The sequence of `commit`                                              |
| `commit`          | 40-hex string              |                                                                       |
| `version`         | semver string              | `X.Y.Z` in production; `X.Y.Z-staging.<sequence>` in staging          |
| `createdAt`       | ISO 8601 UTC               | Informational                                                         |
| `run`             | `{ id, url }`              | The workflow run that wrote it (FR-030)                               |
| `minAgentVersion` | semver string              | An older agent refuses the manifest (research R6)                     |
| `server`          | ServerEntry                | Always present: the server the environment must run                   |
| `fdroid`          | FdroidEntry \| `null`      | `null` until the first app delivery of the environment                |

**ServerEntry**: `{ commit, sequence, version, asset, sha256, nixpkgsRev }`. `commit` can be older
than the manifest's `commit` when the last delivery changed only the app: CI carries the previous
entry over (research R5). `asset` is a file name in the same release, and `sha256` is the
lowercase hex digest of that file.

**FdroidEntry**: `{ commit, versionCode, asset, sha256 }`. `versionCode` is the sequence of
`commit`.

**Validation** (domain function `parseManifest`, tested): every field is present and typed, the
hex fields have the right length, `server.sequence ≤ sequence`,
`fdroid.versionCode ≤ sequence`, and every asset name matches
`^[a-z0-9][a-z0-9.-]*\.tar\.gz$`, so that no path separator can occur.

## BuildInfo (server)

`apps/server/build-info.json`, written into the artifact by CI (research R3, R7). It is read once
at startup by `apps/server/src/composition/release.ts`.

| Field      | Type          | Absent file                                    |
| ---------- | ------------- | ---------------------------------------------- |
| `version`  | semver string | `package.json`'s `version`                     |
| `commit`   | string        | `"dev"`                                        |
| `sequence` | integer       | omitted                                        |

The `release` object of `/v1/health` ([contracts/health-endpoint.md](contracts/health-endpoint.md))
and the Sentry release name (`mes-courses-server@<version>`) come from it.

## InstanceState (agent)

What the agent remembers per environment, in `/var/lib/mes-courses-agent/<environment>.json`. It
is written atomically (a temporary file, then a rename).

| Field               | Type                                   | Meaning                                                    |
| ------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `manifestSequence`  | Sequence \| `null`                     | The last manifest fully handled                            |
| `server`            | `{ commit, sequence } \| null`         | The server release `current` points to                     |
| `previousServer`    | `{ commit, sequence } \| null`         | The release before it, the rollback target                 |
| `failedCommits`     | string[] (≤ 10, newest first)          | Server commits that failed here and are never retried      |
| `fdroid`            | `{ commit, versionCode } \| null`      | The repository being served                                |
| `lastFetchSuccessAt`| ISO 8601 \| `null`                     | For the "fetch failing for over an hour" report (R10)      |
| `signatureMismatches` | integer                             | Passes in a row whose manifest signature did not verify; reported from the third, so an upload in progress is not (contract "Upload order") |
| `inFlight`          | `{ commit, previousCommit } \| null`   | Set before the service is stopped, cleared at the outcome. A pass that finds it set rolls that deployment back (R6) |

A missing file means a fresh instance: everything is `null`. If the instance already has a
`current` release (a missing or unreadable file, FR-033), the agent does not redeploy: it keeps
the service running, reports an error, moves an unreadable file aside as `<env>.json.corrupt`,
and rebuilds `server` from the commit in the release's `build-info.json` with an empty
`failedCommits`. The quickstart's migration starts the
production instance in that state, and the agent then deploys the current production manifest
(research R8).

## Deployment (agent, in memory)

One server deployment on one instance. It is not persisted beyond its outcome, which is reported
and written into `InstanceState`.

```text
            ┌────────────┐ newer server entry, not failed, signature and checksum OK
 idle ─────▶│ installing │  (unpack, nix build runtime)
            └─────┬──────┘
                  │ installed           install error ──▶ failed (nothing was stopped)
                  ▼
            ┌────────────┐
            │ switching  │  set `inFlight`, stop service, copy database, point `current`
            └─────┬──────┘  at the new release, start it on the VALIDATION port (no phone
                  ▼         can reach it, FR-019a)
            ┌──────────────┐ health on the validation port reports the expected commit
            │ validating   │ within 60 s
            └─────┬────────┘
                  │ healthy: drop the port override, restart on the public port
                  ▼
            ┌──────────────┐ health on the public port reports the expected commit
            │ opening      │ within 60 s ──────────────────────────────────▶ succeeded
            └─────┬────────┘
                  │ timeout, or the service exited (here or in `validating`)
                  ▼
            ┌──────────────┐ previous release and database copy back, start on the
            │ rolling-back │ public port, previous version healthy within 60 s
            └─────┬────────┘ ───────────────────────────────────────────────▶ rolled-back
                  │ previous version unhealthy too
                  ▼
               degraded (previous version left in service under Restart=always,
                         critical report; never stopped on purpose, FR-019b)
```

`inFlight` is cleared at every outcome. A pass that finds it set (the agent or the Pi died
during a deployment) starts at `rolling-back`.

**Outcomes and their effects**:

| Outcome       | `InstanceState`                                                     | Report (R10)    | F-Droid step |
| ------------- | ------------------------------------------------------------------- | --------------- | ------------ |
| `succeeded`   | `previousServer ← server`, `server ← new`                           | info            | runs         |
| `failed`      | `failedCommits += new`                                              | error           | skipped      |
| `rolled-back` | `failedCommits += new`                                              | error           | skipped      |
| `degraded`    | `failedCommits += new` (`server` keeps the previous release)        | critical error  | skipped      |
| no server change, or the server entry is a commit in `failedCommits` | unchanged | none (the commit was reported when it failed) | runs, if the server now in service is healthy |

Every `failed`, `rolled-back` and `degraded` outcome is emailed to the maintainer in both
environments (FR-020, R10).

`manifestSequence` advances only when the whole manifest was handled with no failure. A failed
server deployment does not block a later manifest whose server entry is a different commit.

## Release (CI)

The facts the release gate checks (research R15). It is not stored: they are read from git, the
GitHub API and the production channel at gate time.

| Fact                            | Source                                             | Rule                         |
| ------------------------------- | -------------------------------------------------- | ---------------------------- |
| tag version                     | the pushed tag                                     | `vX.Y.Z`                     |
| app version                     | `app.config.ts` at the tagged commit               | equals the tag version       |
| on `main`                       | `git merge-base --is-ancestor <sha> origin/main`   | true                         |
| `CI`, `E2E Android`, `Deliver staging` | `gh run list --commit <sha>`                | each has a `success` run     |
| production version              | the `channel-production` manifest (if any)         | strictly lower than the tag  |

The gate prints every failed rule, not only the first, so one fix-up covers them all.

## DeliveryTargets (CI)

`{ server: boolean, app: boolean }`, produced by `.github/scripts/delivery-targets.sh` from the
paths changed since each target's last staging delivery (research R2).
