# Implementation Plan: Deliver a Release to Staging, Then Promote It to Production

**Branch**: `feat/issue-165-deliver-a-release-to-staging-then-promote-it-to-production` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-release-staging-promote/spec.md`

**Note**: Retrospective plan. The feature was built through the plan route of `gl-ticket-resolve` (PR #166, commit 8721971) and this plan documents the design as built.

## Summary

The release use case of feature 009 (`application/run-release.ts`) gains a second target, `promote`, and a new outcome, `staged`. A bump or a version still runs the checks, the bump pull request and the waits, but stops where the tag used to go, with the version on staging. `promote` skips the prerequisites on the checkout, reads the version on `origin/main`, requires the step decided from the observed state to be a tagging step (the three required runs are green), re-checks the release rules, reports when staging runs a later commit, asks for confirmation, then tags the release commit. Staging deliveries are named after the app version through a new `ci app-version` command, used as the default `--version` of `ci write-manifest`. No new dependency, no new port.

## Technical Context

**Language/Version**: TypeScript 6 on Node.js 24, run with `tsx`

**Primary Dependencies**: none new

**Storage**: N/A (state is read from git, the GitHub API and the staging channel manifest)

**Testing**: Jest 30 with ts-jest in `apps/delivery`; in-memory doubles; interruption tests for both halves

**Target Platform**: maintainer's workstation, never CI (`ci app-version` also runs in the `Deliver staging` workflow)

**Project Type**: CLI tool inside the delivery workspace (hexagonal)

**Performance Goals**: unit tests in seconds (injected sleep); `promote` never polls

**Constraints**: the Git hooks always run; no repository setting changed; `.github/workflows/` is edited by the maintainer only, so the workflow change is a patch in the PR

**Scale/Scope**: one maintainer, one release at a time

## Constitution Check

*GATE: passes before Phase 0 research; re-checked after Phase 1 design, unchanged.*

| Principle | Verdict |
| --- | --- |
| I Test-First | Pass. Unit tests cover stop on staging, promote (confirmed, declined, `--yes`, `--dry-run`, any checkout, runs not green, staging moved on) and interruption at every change. |
| II Executable specification | Pass. Each acceptance scenario of the spec maps to a use-case or parser test. |
| III Fast, deterministic | Pass. Same doubles and injected sleep as 009. |
| IV Simplicity | Pass. One new target and one new outcome in the existing use case; no new port, no persistence. |
| V Design system / IX Screen states / X French interface | N/A (developer tooling, English output per the spec). |
| VI Hexagonal | Pass. The new `promote` kind lives in the domain (`release-plan.ts`), the flow in the use case, the argument parsing and the `ci` command in `composition/`. `yarn test:architecture` covers it. |
| VII Offline first / VIII Error tracking | N/A (touches no app data; every failure ends with a message and a non-zero exit code). |
| XI Monorepo | Pass. Stays in `apps/delivery`. |
| Quality Gates | `yarn test`, `yarn typecheck`, `yarn lint`, `yarn test:architecture`, `yarn test:scripts`, `prettier --check`. |

No violation, so no Complexity Tracking entry.

## Architecture Decisions

None new. Choices are recorded in [research.md](research.md); the contract change is in [contracts/cli.md](contracts/cli.md).

## Project Structure

### Documentation (this feature)

```text
specs/010-release-staging-promote/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cli.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/delivery/src/
├── domain/release-plan.ts (+ .test.ts)        # ReleaseTarget gains { kind: 'promote' }; parseTarget reads "promote"
├── application/run-release.ts (+ .test.ts)    # outcome 'staged'; prepareStaging; promote flow; stagingCommit
└── composition/
    ├── release.ts (+ .test.ts)                # USAGE, TARGET regex, exit code 0 for 'staged'
    └── ci.ts (+ .test.ts)                     # new `app-version` command; write-manifest --version defaults to it
docs/procedures/releases.md                    # the two-step procedure
docs/README.md                                 # index
specs/009-yarn-release-command/contracts/cli.md # the two commands, outputs, exit codes
.github/workflows/deliver-staging.yml          # pack-server.sh version from `ci app-version` (patch applied by the maintainer)
```

**Structure Decision**: no new file in the code base; the feature extends the use case and the `ci` command of the delivery workspace.

## Complexity Tracking

No violations.
