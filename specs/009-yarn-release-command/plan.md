# Implementation Plan: One-Command Release

**Branch**: `feat/issue-142-add-a-yarn-release-command-that-bumps-merges-and-tags-a-release-in-one-run` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-yarn-release-command/spec.md`

## Summary

`yarn release [major|minor|patch|X.Y.Z] [--yes] [--dry-run]` runs from the maintainer's checkout and carries a release from the version bump to the pushed tag. It is a new entry point in the existing `apps/delivery` workspace (`src/composition/release.ts`), reached through a thin root script. The release rules stay in `domain/release-rules.ts` and `domain/semver.ts` and are reused unchanged, so the pre-tag checks and the `Release` workflow gate cannot disagree. New pure domain code computes versions, edits the version in the `app.config.ts` text and decides the next step from an observed state; a new application use case orchestrates the steps through ports; adapters wrap `git`, `gh` and `node:readline`. The command holds no state of its own: it derives its position from git and GitHub on every run, which makes it resumable. No new dependency.

## Technical Context

**Language/Version**: TypeScript 6 on Node.js 24, run with `tsx` (as `ci.ts`)

**Primary Dependencies**: none new (`node:readline/promises`, `node:child_process` through the existing command runner; external tools `git` and `gh`)

**Storage**: N/A (state is read from git and the GitHub API)

**Testing**: Jest 30 with ts-jest in `apps/delivery`; in-memory doubles of the ports; adapters tested against a throwaway local git repository and a fake `CommandRunner` for `gh`

**Target Platform**: maintainer's workstation (macOS or Linux, Nix dev shell), never CI

**Project Type**: CLI tool inside the delivery workspace (hexagonal)

**Performance Goals**: unit tests run in seconds (injected sleep, no real polling); polling every 30 s while waiting

**Constraints**: no network in tests; the Git hooks always run; no repository setting changed; resumable; the wait for `E2E Android` takes about 20 minutes (overall limit 90 minutes per wait, then stop and say to resume)

**Scale/Scope**: one maintainer, one release at a time

## Constitution Check

*GATE: passes before Phase 0 research; re-checked after Phase 1 design, unchanged.*

| Principle | Verdict |
| --- | --- |
| I Test-First | Pass. Every task pairs the test and its implementation, test written first. |
| II Executable specification | Pass. Each acceptance scenario of the spec maps to a domain or use-case test (see tasks). |
| III Fast, deterministic | Pass. Sleep, clock and prompts are injected; no network, real `git` or `gh` in unit tests. Adapter tests use a temp git repo and a fake runner. |
| IV Simplicity | Pass. No dependency, no config file, no persistence; new ports only where existing ones do not cover the need. |
| V Design system | N/A (no UI). |
| VI Hexagonal | Pass. Pure domain (`release-plan.ts`), use case in `application/`, ports in `application/ports/`, adapters in `adapters/{git,github,terminal}/`, wiring only in `composition/release.ts`. `yarn test:architecture` covers it. |
| VII Offline first | N/A for the command (developer tooling, needs the network by nature, touches no app data). A network failure stops the run cleanly and it can be resumed (FR-011). |
| VIII Error tracking | N/A (interactive maintainer tool). No error is swallowed: every failure ends the run with a message and a non-zero exit code. |
| IX Screen states | N/A. |
| X French interface | Pass. Developer tooling output, not an app screen; English per the spec's assumption. |
| XI Monorepo | Pass. Stays in `apps/delivery`; the root `package.json` only forwards to the workspace. |
| Quality Gates | Not documentation-only (touches `apps/delivery` and the root manifest): fast suite, lint, format, architecture test, and the Android device suite before pushing, as for any workspace change. |

No violation, so no Complexity Tracking entry.

## Architecture Decisions

None. The choice (an entry in the delivery workspace, reusing its rules) matters only here and is recorded in [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/009-yarn-release-command/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cli.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
package.json                                   # + "release": "yarn workspace @mes-courses/delivery release"
README.md                                      # Releases section documents the command (FR-015)
apps/delivery/
├── package.json                               # + "release": "tsx src/composition/release.ts"
└── src/
    ├── domain/
    │   ├── release-plan.ts (+ .test.ts)       # bump/target parsing, app.config.ts version read/write, decideStep, refusal rules
    │   └── release-rules.ts, semver.ts        # reused unchanged
    ├── application/
    │   ├── ports/
    │   │   ├── release-repository.ts          # local git + remote main facts and writes
    │   │   ├── release-pull-requests.ts       # find/open PR, auto-merge
    │   │   ├── release-runs.ts                # state and link of the required workflows on a commit, Release run link
    │   │   └── prompter.ts                    # ask / confirm
    │   ├── run-release.ts (+ .test.ts)        # the use case: observe, decide, act, loop
    │   └── testing/in-memory-doubles.ts       # + release doubles
    ├── adapters/
    │   ├── git/release-repository.ts (+ .test.ts)
    │   ├── github/release-pull-requests.ts (+ .test.ts)
    │   ├── github/release-runs.ts (+ .test.ts)
    │   └── terminal/prompter.ts (+ .test.ts)
    └── composition/
        └── release.ts (+ release.test.ts)     # argument parsing, wiring, exit codes
```

**Structure Decision**: a new composition entry beside `ci.ts` and `main.ts` in the delivery workspace, because it already owns the release rules, the command runner and the `gh` adapters. The root script is a one-line forward; no shell script is added (so no shellcheck target).

## Complexity Tracking

No violations.
