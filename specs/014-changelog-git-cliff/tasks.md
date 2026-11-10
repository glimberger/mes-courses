# Tasks: Changelog Generated with git-cliff in the Release Bump

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Required (constitution Principle I). Each task pairs its failing test with the code that turns it green: write the test first, see it fail for the expected reason, then implement, all in one commit. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:architecture` before each commit.

**Format**: `- [ ] [ID] [P?] [Story?] Description with file path`. `[P]` = different files, no dependency on an unfinished task.

## Phase 1: Setup

- [x] T001 Add `pkgs.git-cliff` to the dev shell packages in `/flake.nix` (header description too); confirm `nix develop --command git cliff --version` works and `flake.lock` is unchanged or only gains what nixpkgs needs
- [x] T002 [P] Write ADR-0014 `docs/adr/0014-changelog-with-git-cliff.md` from `docs/adr/0000-template.md` (tool and dev-shell pinning, generated-never-edited, `changelog.json` contract, single run + TypeScript rendering) and add it to `docs/adr/README.md`

## Phase 2: Foundational (blocks all stories)

**Purpose**: the filtering config, the pure domain model, the port and its doubles.

- [x] T003 Create `/cliff.toml` per R2 of research.md (ordered `commit_parsers`: breaking, skipped scopes `ci|e2e|test|delivery`, `feat`/`fix`/`perf` groups `features`/`fixes`/`performances`, skip the rest; `filter_unconventional = true`; `tag_pattern`), driven by the fixture-repo test of T004 and committed with it (a config alone has no test; T003 and T004 land in one commit)
- [x] T004 Create `apps/delivery/src/adapters/changelog/git-cliff-generator.ts` and `git-cliff-generator.test.ts`: test first builds a throwaway git repository (fixed dates, a tag `v1.0.0`, commits of every type and scope, a breaking `chore!`, a `feat(ci)`, a `fix(e2e)`, a non-conventional message, subjects with `(#N)` and with markdown/JSON special characters), runs the real `git cliff --context --unreleased --tag vX.Y.Z` through the `CommandRunner`, and asserts the resulting `ChangelogSection` (FR-001, FR-002, FR-003, every scenario US2.1 to US2.5, SC-002, the special-character edge case, `(#N)` link, no previous tag covers whole history; check each scenario against a test name before the commit); fails with a clear message when git-cliff is missing or the config is bad. Depends on T003, T005, T006
- [x] T005 [P] Create `apps/delivery/src/application/ports/changelog-generator.ts` (`ChangelogGenerator.generate(version, date): Promise<ChangelogSection>`) and `InMemoryChangelogGenerator` (scriptable result or error, records the call) in `apps/delivery/src/application/testing/in-memory-doubles.ts`, with its double test in `release-doubles.test.ts`
- [x] T006 [P] Create `apps/delivery/src/domain/changelog.ts` and `changelog.test.ts`: types `ChangelogEntry` (`text` string without type prefix and without trailing `(#N)`, `pr` number or null) and `ChangelogSection` (`version`, `date` `YYYY-MM-DD`, `features`, `fixes`, `performances`, `breaking`: always-present arrays), `parseContext` (cliff context to section, `(#N)` extraction, breaking only in `breaking`), `renderMarkdownSection` (French group titles, order breaking/features/fixes/performances, empty groups omitted, `No user-facing changes.` when all empty, link `- text ([#N](<url>/pull/N))`), `renderDocument`, `serializeData` (2-space JSON plus final newline), `upsertMarkdown` and `upsertSection` (replace the same version, else insert newest first, create when empty; a resume never duplicates), test that both outputs are Prettier-stable (R9). Resolve the repository link base here (R-note in data-model.md)

**Checkpoint**: domain, port, adapter and config are green on their own.

## Phase 3: User Story 1 - A release brings its changelog (P1)

**Goal**: the bump commit holds `CHANGELOG.md` and `changelog.json` with the section.

**Independent Test**: run the release step with the fake generator and a temporary git repository: the bump commit contains the two files; a generator failure stops before the branch.

- [x] T007 [US1] Extend `ReleaseRepository.commitBump(version, branch, section)` in `apps/delivery/src/application/ports/release-repository.ts` and `apps/delivery/src/adapters/git/release-repository.ts`, test first in `release-repository.test.ts` (temporary origin and work repositories): after `switch -C origin/main` it reads both files (missing = empty), upserts the section, writes, adds them with `app.config.ts` into the single bump commit, existing section of the same version is replaced, remote branch already present stays a no-op. Update `InMemoryReleaseRepository.commitBump` to record the section (US1.1, US1.3, resume edge case)
- [x] T008 [US1] Wire the generator into `apps/delivery/src/application/run-release.ts` (new `changelog: ChangelogGenerator` and `clock: Clock` in `ReleaseDeps`; the `open-bump` step generates with the date `YYYY-MM-DD` from the clock, before `commitBump`, then passes the section), test first in `run-release.test.ts`: section reaches `commitBump` (US1.1), generator error returns `stopped` with the reason and the resume hint and nothing was branched, pushed or opened (US1.4, FR-007)
- [x] T009 [US1] Wire `createGitCliffGenerator` and `createSystemClock` in `apps/delivery/src/composition/release.ts`, test first in `composition/release.test.ts` (dependency wiring as the existing tests do)

**Checkpoint**: `pnpm release` produces the changelog files in the bump PR (MVP).

## Phase 4: User Story 2 - Only meaningful changes are listed (P1)

No task of its own: the filtering behaviour (US2.1 to US2.5, SC-002) is delivered and tested by T003, T004 and T006. A test-only task here would either be a no-op or leave the fast suite red, which the constitution forbids.

## Phase 5: User Story 3 - The GitHub Release body is the changelog entry (P1)

**Goal**: `release.yml` publishes the version's section as the Release body.

**Independent Test**: `release-notes.test.sh` on a `CHANGELOG.md` fixture.

- [x] T010 [P] [US3] Create `.github/scripts/release-notes.sh` and `.github/scripts/release-notes.test.sh` (test first, style of `release-bump.test.sh`): prints the body of `## [X.Y.Z]` up to the next `## [` heading, trimmed, without the heading line (US3.1); exits 1 with `No changelog section for X.Y.Z in CHANGELOG.md` when the version is missing or the section empty (US3.2); exit 2 on usage error; version matching is exact (`2.1.0` does not match `2.1.01`); add the test to `test:scripts` in `/package.json`; `shellcheck` both files clean
- [x] T011 [US3] Hand-off of the `release.yml` change (no file edit by the agent: `.github/workflows/` is maintainer-only, see `docs/agent-guardrails.md`). Put in the PR description the exact diff for job `publish` of `.github/workflows/release.yml`: write the notes with `sh .github/scripts/release-notes.sh "${TAG#v}" > "$RUNNER_TEMP/notes.md"` (the step runs with `set -e` so a missing section fails the job) and replace `--generate-notes` by `--notes-file "$RUNNER_TEMP/notes.md"`; check the diff against `actionlint` on a scratch copy outside the repository. Add an explicit item to the PR checklist: "maintainer applies and merges the release.yml change; the 'GitHub Release body' acceptance criterion (US3) stays open until then". Until applied, the workflow keeps generating notes as today

## Phase 6: User Story 4 - Preview before releasing (P2)

**Goal**: `--dry-run` shows the section and data and changes nothing.

**Independent Test**: dry run on the in-memory doubles prints both blocks and records no write.

- [x] T012 [US4] In `apps/delivery/src/application/run-release.ts` make the dry-run `commitBump` step print `would write to CHANGELOG.md:` plus the markdown section, then `would write to changelog.json:` plus the section as JSON (contracts/cli.md), calling the generator (read-only) but never the repository; test first in `run-release.test.ts` (US4.1, US4.2: no branch, commit, push, PR; generator failure in dry run is also reported)

## Phase 7: User Story 5 - The existing releases are seeded (P2)

**Goal**: committed `CHANGELOG.md` and `changelog.json` for `v2.1.0`, `v2.0.1`, `v1.2.0`.

**Independent Test**: the committed files hold three sections, newest first, no noise.

- [x] T013 [US5] Seed the committed files, test first, in one commit. Write `apps/delivery/src/adapters/changelog/changelog-seed.test.ts` (reads the committed `CHANGELOG.md` and `apps/mobile/src/changelog/changelog.json` from the repository root): versions `2.1.0`, `2.0.1`, `1.2.0` in this order, unique, markdown and data carry the same entries, no entry whose subject starts with a dropped type or scope, JSON follows the contract shape (US5.1, US5.2, SC-002); see it fail for the missing files. Then produce the seed once with an uncommitted `tsx` script (not added to the repo, R7) using the real adapter and the domain renderer for the ranges up to `v1.2.0`, `v2.0.1`, `v2.1.0` (date of each tag); write `/CHANGELOG.md` and `apps/mobile/src/changelog/changelog.json`; review by hand, run `prettier --write` if needed, until the test passes. Depends on T004, T006

## Phase 8: Polish & Cross-Cutting

- [x] T014 [P] Let `.github/scripts/release-bump.sh` recognise the real changelog data path (`.github/scripts/` is not guarded, an agent may edit it). The script accepts only the bare names `CHANGELOG.md` and `changelog.json`, but the file is `apps/mobile/src/changelog/changelog.json`, so a real bump PR would not be recognised and its CI jobs would not be skipped. Test first in `.github/scripts/release-bump.test.sh`: a case "version, `CHANGELOG.md` and `apps/mobile/src/changelog/changelog.json`" expecting `bump=true` (create the nested file in the fixture repository; the existing bare `changelog.json` fixture and case are replaced by the full path), plus a case where a bare `changelog.json` at the root is now `bump=false`; see it fail, then change the `case` in `release-bump.sh` to `"$config" | CHANGELOG.md | apps/mobile/src/changelog/changelog.json` and update its header comment; add the matching `app-changed.sh` case if its rule reads the same list; `shellcheck` clean on both scripts; `pnpm test:scripts` green. Lands in this feature's PR, before T016 and T017. It only takes effect after that PR is merged: `ci.yml` runs `release-bump.sh` as read from the base commit of each pull request, so the first bump PR opened from a `main` that holds this change is the first one judged by the new rule (constitution 2.7.1 allows exactly these three paths)
- [ ] T015 [P] Document the changelog in `docs/procedures/releases.md` (generated files in the bump PR, filtering rules, French group titles, `pnpm release minor --dry-run` preview, never edit by hand, fix in `cliff.toml` then regenerate, Release body source, failure on generation) and mention git-cliff in the dev shell in `/README.md` (FR-012)
- [ ] T016 [P] Update `specs/014-changelog-git-cliff/spec.md` status and check each box of `specs/014-changelog-git-cliff/checklists/` if present; leave the US3 'GitHub Release body' criterion open until the maintainer applies the `release.yml` change (T011)
- [ ] T017 Run the full gates (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:architecture`, `pnpm test:scripts`, `shellcheck` on new and edited scripts, `actionlint` on the diff of T011) and the quickstart steps 2 to 5; confirm `git diff --stat origin/main...HEAD` lists only this feature's files and no file under `.github/workflows/`

## Dependencies and order

- Phase 1 then Phase 2. T005 and T006 are parallel; T004 (with T003) needs T005 and T006.
- US1 (T007 to T009) needs Phase 2. US2 has no task (covered by T003, T004, T006). US3 (T010, T011) is independent of the others after Phase 1; T011 is a PR-description hand-off, not a file edit. US4 (T012) needs T008. US5 (T013) needs T004 and T006.
- Phase 8 last. T014 (release-bump.sh) depends on no other task and lands in this PR before T016 and T017 (so before the PR is marked ready). It takes effect only once this PR is merged, because `ci.yml` reads `release-bump.sh` from the pull request's base commit; the first release after the merge is the first bump PR it recognises.

## Parallel examples

- After T001: T002, T005, T006, T010 together.
- After Phase 2: T007, T010, T013, T014 together (different files).

## Implementation strategy

MVP = Phase 1, Phase 2 and US1 (the bump PR carries the files). Then US3 (notes script and hand-off), US4 (preview), US5 (seed), polish. One pull request, small commits, each green.

**Totals**: 17 tasks, 8 phases (Setup 2, Foundational 4, US1 3, US2 0, US3 2, US4 1, US5 1, Polish 4).
