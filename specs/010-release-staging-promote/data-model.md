# Data Model: Deliver a Release to Staging, Then Promote It to Production

No persisted data. Types touched in `apps/delivery`:

- **ReleaseTarget**: `bump` | `version` | `ask` | `promote`. `promote` carries nothing: the version is the one on `origin/main`.
- **ReleaseResult.outcome**: `released` | `staged` | `declined` | `stopped`. `staged` means the version runs on staging and awaits the promotion; exit code 0.
- **Release state** (unchanged from 009): version on `origin/main`, bump pull request, status of `CI`, `E2E Android` and `Deliver staging`, production version, tag, release commit.
- **Staging commit**: the commit field of the `staging` channel manifest; compared with the release commit to say that staging moved on.
- **Staging delivery name**: `X.Y.Z-staging.<n>` (app version, delivery sequence number).

State transitions: a version goes `on main (unreleased)` → `on staging` (all three runs green, command ends `staged`) → `tagged` (promotion). Both halves derive their position from the observed state, so either can be re-run.
