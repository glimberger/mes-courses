# Contract: delivery workflows (FR-005 to FR-013, FR-021, FR-027, FR-030)

The GitHub Actions workflows and what each job promises. The steps call scripts or workspace
commands; the YAML holds no logic of its own (research R17).

## `deliver-staging.yml`

**Trigger**: `workflow_run` of `CI`, `completed`, branch `main`. The jobs run only when
`conclusion == 'success'` and `event == 'push'`.
**Concurrency**: group `deliver-staging`, `cancel-in-progress: false`.
**Checkout**: `workflow_run.head_sha`, `fetch-depth: 0`.

| Job               | Needs                | Condition        | Does                                                                                             |
| ----------------- | -------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `plan`            | —                    | always           | reads the staging manifest; computes `sequence` and DeliveryTargets (R2); outputs `server`, `app`, `sequence` |
| `server-artifact` | `plan`               | `server == true` | builds `server-<sha>.tar.gz` (R3), runs the native-module check (R14)                            |
| `android-apk`     | `plan`               | `app == true`    | calls `android-apk.yml` with `variant: staging`                                                  |
| `fdroid-repo`     | `android-apk`        | `app == true`    | runs `fdroid update` for `deploy/fdroid/staging`, archives `fdroid-staging-<sha>.tar.gz`          |
| `publish`         | `server-artifact`, `fdroid-repo` | at least one ran and none failed | uploads the assets, writes and signs the manifest, uploads it last, prunes old assets |

Every job writes its outcome to the run summary
(FR-030).

## `release.yml`

**Trigger**: `push` of tags `v*.*.*`.
**Concurrency**: group `release`, `cancel-in-progress: false`.

| Job                      | Needs                         | Does                                                                                          |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------- |
| `gate`                   | —                             | `release-gate` (research R15); prints every failed rule                                       |
| `server-artifact`        | `gate`                        | as in staging, `version` = the tag's                                                          |
| `android-apk`            | `gate`                        | `android-apk.yml` with `variant: production` (the release guard applies)                      |
| `fdroid-repo`            | `android-apk`                 | for `deploy/fdroid/production`                                                                |
| `publish`                | `server-artifact`, `fdroid-repo` | creates release `vX.Y.Z` with the assets, the APK (attached for history) and the agent bundle `delivery-<agent version>.tar.gz` (research R6), then updates `channel-production` |
| `wait-production-health` | `publish`                     | polls `PRODUCTION_SERVER_URL/v1/health` every 20 s, for up to 20 min, until `release.commit` is the tag's commit |

If `wait-production-health` times out, the release run fails, and the Pi's own report
(rollback, R10) says why. The F-Droid repository is not swapped, because the agent swaps it only
after a healthy server.

**Partial release**: if the server turns healthy only after the wait expired, the Pi swaps the
F-Droid repository but the run is failed. The maintainer completes the release with *Re-run failed
jobs* on the same run: `wait-production-health` polls again, on the tag's
commit. Jobs that succeeded (`publish`) are not run again and no new tag is needed.

## `android-apk.yml` (reusable)

**Input**: `variant` (`staging` | `production`). **Secrets**: the APK key and `SENTRY_AUTH_TOKEN`
(research R16).
**Output**: job artifact `apk-<variant>`, holding `app-<variant>-<versionCode>.apk`, kept 1 day.

The steps follow research R11. The job fails if `apksigner verify --print-certs` does not show
the expected certificate SHA-256, which is stored in the repository variable
`ANDROID_CERT_SHA256`.

## Changes to existing workflows

- `ci.yml`'s `lint` job adds `actionlint`. Its `test` job adds `yarn test:scripts`
  (`delivery-targets.test.sh`). The `delivery` workspace is covered by the existing `yarn test`,
  `yarn typecheck` and `yarn build`, which run over all workspaces.
- `e2e.yml` is unchanged. Its name `E2E Android` is part of the gate's contract.

## Secrets and variables

As listed in [research.md R16](../research.md#r16-github-secrets-fr-022-fr-028). No workflow
triggered by `pull_request` uses any of them.
