# Implementation Plan: Changelog Generated with git-cliff in the Release Bump

**Branch**: `feat/issue-202-generate-the-changelog-with-git-cliff-in-the-release-bump` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-changelog-git-cliff/spec.md`

## Summary

`pnpm release` (use case `application/run-release.ts`) gains one step in the staging half: before the bump branch exists, it asks a new driven port, `ChangelogGenerator`, for the section of the version being released. The adapter runs `git cliff --context` (JSON of the filtered commits since the last `vX.Y.Z` tag) configured by a root `cliff.toml`. A pure domain module turns that context into a `ChangelogSection` and renders it both as markdown and as JSON data, so the two files carry the same data by construction (FR-006). The git adapter `commitBump` writes the section into `CHANGELOG.md` and `apps/mobile/src/changelog/changelog.json` (replacing the section of the same version, so a resume never duplicates it) and commits them with the version change. A failure of the generator stops the run before any branch or push (FR-007); `--dry-run` prints the section and the data and writes nothing. The `Release` workflow takes the body of the GitHub Release from the committed `CHANGELOG.md` through a small shell script, no git-cliff needed. git-cliff comes from the Nix dev shell. The three existing tags are seeded once.

## Technical Context

**Language/Version**: TypeScript 6 on Node.js 24 (`apps/delivery`), POSIX shell for the workflow script, git-cliff from nixpkgs (`nixos-26.05`, pinned by `flake.lock`)

**Primary Dependencies**: git-cliff (dev shell tool, not an npm dependency). Justification (Principle IV): the issue asks for it; it already parses Conventional Commits, scopes, breaking changes and `(#N)` subjects, which would otherwise be hand-written and tested here. No npm package added.

**Storage**: two committed generated files, `CHANGELOG.md` and `apps/mobile/src/changelog/changelog.json`

**Testing**: Jest 30 in `apps/delivery` (domain, use case with fake generator, git adapter with a temporary repository, git-cliff adapter with a throwaway fixture repository); `sh` tests for the notes script added to `pnpm test:scripts`; `shellcheck` on the script

**Target Platform**: maintainer's workstation (release command) and GitHub Actions `ubuntu-latest` (notes script only)

**Project Type**: CLI tool inside the delivery workspace (hexagonal) plus a CI script

**Performance Goals**: fast suite stays in seconds; fixture-repo tests run a local `git cliff` over a few commits

**Constraints**: hooks always run; `.github/workflows/` is edited by the maintainer only (agent guardrails), so the `release.yml` change is a hand-off through the PR description (T011), see Workflow change below; `changelog.json` is a stable contract for #203 and #204; Prettier must pass on both generated files

**Scale/Scope**: one maintainer, one section per release, history of three tags

## Constitution Check

*GATE: passes before Phase 0; re-checked after Phase 1 design, unchanged.*

| Principle | Verdict |
| --- | --- |
| I Test-First | Pass. Every task pairs the failing test with its code (render, upsert, use-case step, git adapter, cliff adapter, notes script). |
| II Executable specification | Pass. Each acceptance scenario of the spec maps to a test, see the traceability table in [quickstart.md](quickstart.md). |
| III Fast, deterministic | Pass. Use-case tests use a fake generator and an injected clock; only the cliff adapter test starts a binary, on a local fixture repository, with fixed commit dates. |
| IV Simplicity | Pass. One new port, one domain module, one adapter, one script. git-cliff justified above. No config option beyond `cliff.toml`. |
| V, IX, X (UI, states, French UI) | N/A. Developer tooling. The French group titles are data (`changelog.json` keys stay English; titles live in the markdown renderer and, later, the app screens of #203/#204). |
| VI Hexagonal | Pass. Domain `changelog.ts` is pure; port `ChangelogGenerator` in `application/ports`; adapters `adapters/changelog/git-cliff-generator.ts` and the extended `adapters/git/release-repository.ts`; wiring in `composition/release.ts`. `pnpm test:architecture` covers it. |
| VII Offline first, VIII Error tracking | N/A. Touches no app data. Every failure ends with a message and exit code 1. |
| XI Monorepo | Pass. Stays in `apps/delivery`; `apps/mobile` only receives a data file, no import. |
| Quality Gates | `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:architecture`, `pnpm test:scripts`, `shellcheck`, `actionlint`. The bump-PR detector `release-bump.sh` matches only the bare names `CHANGELOG.md` and `changelog.json`, not `apps/mobile/src/changelog/changelog.json`, so task T014 makes it accept the full path (test first in `release-bump.test.sh`, shellcheck clean; `.github/scripts/` is not guarded); without it the bump PR would not be recognised and its CI jobs would run. |

No violation, so no Complexity Tracking entry.

## Architecture Decisions

- New: ADR-0014, changelog generated with git-cliff in the release bump (the tool, the dev-shell pinning, the generated-never-edited rule, the `changelog.json` contract). Written in this feature's pull request.
- Relies on: [ADR-0009](../../docs/adr/0009-version-identity-from-git.md) (linear squash history, one commit per pull request) and the release flow of features 009 and 010.

## Project Structure

### Documentation (this feature)

```text
specs/014-changelog-git-cliff/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── changelog-data.md      # changelog.json shape and CHANGELOG.md rendering
│   └── cli.md                 # delta of `pnpm release` and the notes script
└── tasks.md
```

### Source Code (repository root)

```text
cliff.toml                                              # filtering and grouping (FR-001, FR-002)
flake.nix                                               # + pkgs.git-cliff (FR-004)
CHANGELOG.md                                            # generated, seeded (FR-010)
apps/mobile/src/changelog/changelog.json                # generated, seeded; contract for #203/#204
apps/delivery/src/
├── domain/changelog.ts (+ .test.ts)                    # context -> section, render, upsert, empty rule
├── application/ports/changelog-generator.ts            # driven port
├── application/run-release.ts (+ test)                 # generate step, dry run, failure
├── application/testing/in-memory-doubles.ts            # InMemoryChangelogGenerator, repository records files
├── adapters/changelog/git-cliff-generator.ts (+ test)  # runs `git cliff --context`; fixture-repo test
├── adapters/git/release-repository.ts (+ test)         # commitBump writes and commits the two files
└── composition/release.ts (+ test)                     # wires generator and clock
.github/scripts/release-notes.sh (+ .test.sh)           # prints the section of a version from CHANGELOG.md
.github/scripts/release-bump.sh (+ .test.sh)            # accepts apps/mobile/src/changelog/changelog.json (T014)
# .github/workflows/release.yml: not edited here; diff in the PR description for the maintainer (T011)
docs/procedures/releases.md, README.md, docs/adr/0014-*.md, docs/adr/README.md
package.json                                            # test:scripts gains release-notes.test.sh
```

**Structure Decision**: all logic in `apps/delivery` following 009/010; the workflow keeps no logic of its own and calls a script, as the other jobs do.

## Workflow change (hand-off)

`.github/workflows/` is outside what agents may edit (`docs/agent-guardrails.md`), so no task edits `release.yml`. The implementation PR contains the notes script and its test (T010); the `release.yml` change (job `publish`: write the notes with `sh .github/scripts/release-notes.sh "${TAG#v}" > "$RUNNER_TEMP/notes.md"` in a step running with `set -e`, and use `--notes-file` in place of `--generate-notes`) is delivered as an exact, actionlint-clean diff in the PR description (T011). The maintainer applies and merges it, as was done for #166; the 'GitHub Release body' acceptance criterion stays open until then. Until then the workflow still works (generated notes).
