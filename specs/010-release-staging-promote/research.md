# Research: Deliver a Release to Staging, Then Promote It to Production

No `NEEDS CLARIFICATION` remained. Decisions taken while building (PR #166):

## One use case, two targets

- **Decision**: `promote` is a `ReleaseTarget` of the existing use case, not a second use case.
- **Rationale**: both halves observe the same state (version on `origin/main`, pull request, runs, tag) and decide the next step with the same function, so resumption and the release rules stay shared (FR-008, and FR-012 of 009).
- **Alternatives**: a separate `runPromote` that duplicates the observation (rejected: two places to keep in step).

## Stop where the tag would go

- **Decision**: the staging half runs unchanged up to the `tag` / `push-tag` step and returns `staged` there instead of tagging; the dry run says `would stop with X.Y.Z on staging`.
- **Rationale**: the decided step is already "the three runs are green on the squash commit", which is exactly "on staging".

## Promote refuses by the decided step

- **Decision**: `promote` proceeds only when the decided step is `tag` or `push-tag`; any other step stops at once with `X.Y.Z is not delivered to staging yet`, never waiting.
- **Rationale**: no polling in `promote` (FR-004); the message names the commit when known.

## The local checkout does not matter to promote

- **Decision**: `promote` skips the prerequisites (branch, clean tree, matches `origin/main`) and the version choice; it reads the version at `origin/main`.
- **Rationale**: it only creates a tag on a commit of `origin/main` (FR-007); only the version on `origin/main` can be promoted (FR-006).

## A local tag is gated like a new one

- **Decision**: the release rules, the staging-moved-on note and the confirmation run for both `tag` and `push-tag` (a tag that exists locally only).
- **Rationale**: review finding of PR #166; the same checks must hold whatever the starting state.

## Staging named after the app version

- **Decision**: a `ci app-version` command prints the version of `apps/mobile/app.config.ts`; `ci write-manifest` defaults `--version` to it; `pack-server.sh` is given it by the workflow.
- **Rationale**: production is named after the app version; staging must show it (FR-009). One reader of `app.config.ts` (`readAppVersion`) serves the release command and CI.
- **Constraint**: `.github/workflows/` is maintainer-only; the workflow edit was applied by the maintainer and merged with #166, so the staging server reports the app version.
