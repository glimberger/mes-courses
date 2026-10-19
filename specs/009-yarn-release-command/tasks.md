---

description: "Task list for the one-command release (yarn release)"
---

# Tasks: One-Command Release

**Input**: Design documents from `/specs/009-yarn-release-command/` (plan.md, spec.md, research.md, data-model.md, contracts/cli.md, quickstart.md)

**Tests**: Required (constitution Principle I). Each task below holds the test and the code it drives: write the test first, see it fail, then make it pass; the task is committed only when the fast suite is green. All paths are under `apps/delivery/src/` unless noted. Tests use in-memory doubles, an injected sleep and no network.

**Format**: `[ID] [P?] [Story] Description`. [P] = different files, no dependency on an unfinished task.

## Phase 1: Setup

- [x] T001 Add the scripts: `"release": "tsx src/composition/release.ts"` in `apps/delivery/package.json` and `"release": "yarn workspace @mes-courses/delivery release"` in `package.json` (root). No new dependency. The entry file is created in T010; until then check only that both manifests stay valid and `yarn install --immutable` is unchanged.

## Phase 2: Foundational (blocks every story)

- [x] T002 Domain: in `domain/release-plan.ts` with `domain/release-plan.test.ts` written first, add `nextVersion(current, bump)` (major -> `M+1.0.0`, minor -> `M.m+1.0`, patch -> `M.m.p+1`), `parseTarget(arg)` returning `{kind:'bump'}`, `{kind:'version'}` or `{kind:'ask'}` for no argument, `validateExplicitVersion(version, current)` (must match `^\d+\.\d+\.\d+$`, no `-staging.n`; strictly higher with `compareSemver`; error messages tested), and `readAppVersion(source)` / `setAppVersion(source, next)` on the text of `apps/mobile/app.config.ts` (one `version: 'X.Y.Z'` line; throw when zero or several match; test against a sample of the real file). Reuse `parseSemver`/`compareSemver` from `domain/semver.ts`. Covers FR-002, FR-004, FR-014.
- [x] T003 Domain: in `domain/release-plan.ts` and its test (after T002, same files), add the types `ReleaseState` and `ReleaseStep` of data-model.md and `decideStep(version, state)`: tag on the right commit -> `done`; main version equals target and the three runs `success` -> `tag`; any run `failed` -> `stop-run-failed {url}`; runs pending -> `wait-runs`; main version old: PR `merged` -> `wait-runs` after re-observation, PR `open` -> `wait-merge`, PR checks failed -> `stop-pr-failed {url}`, PR `closed` -> `stop-pr-closed {url}`, no PR -> `open-bump`. One test per branch, including "tag exists on another commit -> refuse". Covers FR-011.
- [x] T004 Application: create the ports `application/ports/release-repository.ts`, `release-pull-requests.ts`, `release-runs.ts`, `prompter.ts` (signatures in data-model.md, `REQUIRED_WORKFLOWS` reused for the runs) and the in-memory doubles in `application/testing/in-memory-doubles.ts` (scripted sequences of states, call recorder, fake sleep, recorded output lines). Covered by a small test of the doubles in `application/testing/in-memory-doubles.test.ts` if that file exists for the other doubles, otherwise by the use-case tests of the next tasks; `yarn typecheck` and `yarn test:architecture` must pass.

**Checkpoint**: domain and ports ready, user stories can start.

## Phase 3: User Story 1 - Ship a release with one command (P1) MVP

**Goal**: one run goes from the choice of bump to the pushed tag.
**Independent test**: use-case test with doubles runs `minor` with confirmation and records, in order: bump branch/commit/push, PR opened, auto-merge enabled, merge awaited, runs awaited, re-check, annotated tag created and pushed, Release run link printed.

- [x] T005 [US1] Use case: `application/run-release.ts` with `application/run-release.test.ts` written first. `runRelease(deps, request)` observes, computes the next version from the remote main version (FR-004), prints `current -> next`, asks for confirmation unless `assumeYes` (answer no -> nothing mutated, FR-005), asks for the bump or version when the target is `ask` (FR-002), and loops `decideStep` for the steps `open-bump` (commit `chore(release): bump the app version to X.Y.Z` on `chore/release-X.Y.Z`, push, open PR or reuse, enable auto-merge in squash mode with branch deletion, FR-008), `wait-merge`, `wait-runs`, `tag` (re-check with the existing `evaluateRelease`, FR-010 and FR-012; annotated tag on the release commit, push it, print the `Release` run link). Waits use the injected sleep (30 s step, 90 min limit, stop with "run it again to resume"). Re-reads the remote main version before the commit and stops if it changed (edge case). Tests: scenarios 1.1 to 1.5 of the spec.
- [x] T006 [P] [US1] Adapter: `adapters/git/release-repository.ts` with `adapters/git/release-repository.test.ts` written first, against a temporary git repository plus a local bare "origin": `currentBranch`, `isClean`, `fetch`, `isUpToDate`, `appVersionAt(ref)` (via `git show <ref>:apps/mobile/app.config.ts` and `readAppVersion`), `commitBump(version)` (switch to or create `chore/release-X.Y.Z`, `setAppVersion`, commit with the exact message, push with upstream, switch back to `main`, delete the local branch; the Git hooks always run), `createTag`/`pushTag` (annotated), `tagCommit`, `releaseCommit(version)` (`git log -G` fallback of research R7). Uses `CommandRunner`.
- [x] T007 [P] [US1] Adapter: `adapters/github/release-pull-requests.ts` with its `.test.ts` written first, against a fake `CommandRunner`: `findBump(branch)` (`gh pr list --head ... --state all --json number,state,url,mergeCommit,statusCheckRollup`, picks the open one, else the merged one), `open(branch, title)` (`gh pr create`), `enableAutoMerge(pr)` (squash, delete branch, through `gh`). Assert argument arrays and JSON parsing.
- [ ] T008 [P] [US1] Adapter: `adapters/github/release-runs.ts` with its `.test.ts` written first, against a fake `CommandRunner`: `requiredRuns(sha)` (for each of `REQUIRED_WORKFLOWS`, `gh run list --commit --workflow --json conclusion,status,url`, newest run decides: success / failed / pending, none = pending, URL kept) and `releaseRunUrl(sha)` (`--workflow Release`, short polling through the injected sleep, fallback to the Actions page).
- [ ] T009 [P] [US1] Adapter: `adapters/terminal/prompter.ts` with its `.test.ts` written first, using `node:readline/promises` on injected input/output streams: `ask(question)`, `confirm(question)` (y/yes accepted, anything else is no), and a clear error when input is not a terminal and a question is needed.
- [ ] T010 [US1] Composition: `composition/release.ts` with `composition/release.test.ts` written first. `parseReleaseArgs(argv)` (`major|minor|patch|X.Y.Z`, `--yes`/`-y`, `--dry-run`, unknown option or two targets -> usage error, exit 2 per contracts/cli.md) and the wiring of the adapters, `createCommandRunner()`, `createGithubChannelSource` (needs `GITHUB_REPOSITORY` and a token: derive both from `gh repo view` / `gh auth token` for the maintainer, test the derivation with the fake runner) and the production version via `parseManifest`; exit codes 0/1/2 and messages to stderr, `if (require.main === module)` guard as in `ci.ts`. Depends on T005 to T009.

**Checkpoint**: `yarn release minor` works end to end on the happy path.

## Phase 4: User Story 2 - Be stopped early (P1)

**Goal**: every refusal happens before any change.
**Independent test**: use-case tests with dirty, wrong-branch, behind-remote, bad or lower version, existing tag, version not above production; assert zero mutating calls.

- [ ] T011 [US2] Domain: in `domain/release-plan.ts` and its test, add `checkPrerequisites({branch, clean, upToDate})` (not on `main`, uncommitted changes, differs from `origin/main`: one message each, all reported, FR-001) and `checkNewVersion({version, mainVersion, productionVersion, tagExists})` (version not higher than the current one, tag `vX.Y.Z` exists locally or remotely, not higher than production by running the existing `evaluateRelease` rules, FR-004 and FR-006; no duplicated comparison).
- [ ] T012 [US2] Use case: in `application/run-release.ts` and its test, run the checks of T011 first (tools missing or `gh` not authenticated through the repository port are refusals too), refuse with exit status `1` and print every reason before any change; add `dryRun` (FR-007, SC-005): the observation still runs, every mutating call goes through one `steps` object that prints "would ..." and does nothing, no wait, and a test asserts zero mutating calls on every double. Tests: scenarios 2.1 to 2.4 of the spec.

## Phase 5: User Story 3 - Wait for the gate and stop on failure (P2)

**Goal**: never tag a commit the gate would reject; stop with a link.
**Independent test**: scripted run states with one failed required run -> the use case ends with the run URL and no `createTag`/`pushTag` call.

- [ ] T013 [US3] Use case: in `application/run-release.ts` and its test, cover the waiting paths: PR check fails or PR closed unmerged -> stop with the PR link (3.1); runs pending then success -> tag (3.2); one of `CI`, `E2E Android`, `Deliver staging` failed -> stop with that run link, no tag (3.3, SC-003); wait limit reached -> stop with "run it again to resume"; tag goes on the bump commit even when `origin/main` has moved on (edge case); `gh`/network error mid-wait -> stop with a message, no crash.

## Phase 6: User Story 4 - Resume after an interruption (P2)

**Goal**: rerunning with the same version continues at the next step with no duplicate PR or commit.
**Independent test**: start the use case in each of the states (PR open, bump merged, runs green, tag exists) and assert only the remaining steps run.

- [ ] T014 [US4] Use case: in `application/run-release.ts` and its test, drive the loop only from the observed state: PR already open -> reuse it (no second PR, no second commit, no second auto-merge enable if already on); remote branch `chore/release-X.Y.Z` exists -> reuse it; bump already on `origin/main` -> no commit, go to the runs; tag exists on the right commit -> print "already tagged" and create nothing, exit 0 (4.1 to 4.3, SC-004); tag exists on another commit -> refuse. Add a table test that interrupts after each step of the happy path and reruns, asserting the total mutating calls equal one uninterrupted run.

## Phase 7: Polish and cross-cutting

- [ ] T015 [P] README: in `README.md`, section "Releases", replace steps 1 to 3 with `yarn release` usage (arguments, `--yes`, `--dry-run`), list what it waits for (`CI`, `E2E Android` about 20 minutes, `Deliver staging`), what it creates (branch, PR with auto-merge, annotated tag), how to resume (run the same command again), and that the manual checks of step 1 still come first. Keep the fallback manual tag command as a note. Run `yarn format:check`.
- [ ] T016 Final checks from the repository root: `yarn typecheck`, `yarn lint`, `yarn format:check`, `yarn test`, `yarn test:architecture` all green; confirm no shell script was added (shellcheck not applicable); run the quickstart steps 2 to 4 by hand (refusals, dry run, decline); step 5 stays for the next real release. The Android device suite is run before pushing, per the Quality Gates, because `apps/delivery` and the root manifest change.

## Dependencies and order

- T001 -> T002 -> T003 -> T004 -> (T005) -> T006..T009 [P] -> T010 (US1) -> T011 -> T012 (US2) -> T013 (US3) -> T014 (US4) -> T015 [P], T016.
- T006, T007, T008, T009 are independent files and can be done in parallel after T004; T005 only needs the doubles, so it can run in parallel with them, T010 needs all five.
- US2, US3 and US4 all extend `run-release.ts`, so they are sequential in practice; each is independently testable through its own use-case tests.

## Implementation strategy

MVP = Phase 1 to 3 (happy path through to the tag). Then US2 (refusals and dry run) before the first real use, then US3 and US4, then the README and final checks. Counts: 16 tasks (Setup 1, Foundational 3, US1 6, US2 2, US3 1, US4 1, Polish 2).
