---

description: "Task list for deliver-to-staging-then-promote (retrospective: every task is done, see PR #166)"
---

# Tasks: Deliver a Release to Staging, Then Promote It to Production

**Input**: Design documents from `/specs/010-release-staging-promote/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md

**Tests**: Each test is written first inside the task that implements it (constitution, Development Workflow); no test-only task.

**Organization**: Grouped by user story. Retrospective: the work was merged in PR #166 (commit 8721971) and every box is ticked.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational

**Purpose**: the vocabulary both halves share.

- [X] T001 Add `{ kind: 'promote' }` to `ReleaseTarget` and make `parseTarget('promote')` return it, with tests, in `apps/delivery/src/domain/release-plan.ts` and `apps/delivery/src/domain/release-plan.test.ts`
- [X] T002 [P] Add the `staged` outcome to `ReleaseResult` and a `stagingCommit` reader of the staging channel manifest in `apps/delivery/src/application/run-release.ts`

---

## Phase 2: User Story 1 - Deliver a version to staging and stop there (Priority: P1)

**Goal**: `yarn release [bump|X.Y.Z]` ends with the version on staging, no tag.

**Independent Test**: run it against the in-memory doubles; it ends `staged` with `X.Y.Z is on staging (<sha>)` and no tag.

- [X] T003 [US1] Extract the prerequisites, version choice and `Deliver X.Y.Z to staging?` confirmation into `prepareStaging` in `apps/delivery/src/application/run-release.ts`
- [X] T004 [US1] Test first, then implement: stop at the `tag` / `push-tag` step with outcome `staged` (no tag, declined, dry run), print `X.Y.Z is on staging (<sha>)` and the promote hint; in a dry run print `would stop with X.Y.Z on staging`, in `apps/delivery/src/application/run-release.test.ts` and `apps/delivery/src/application/run-release.ts`
- [X] T005 [US1] Exit code 0 for `staged` and the two-line usage text in `apps/delivery/src/composition/release.ts` and `apps/delivery/src/composition/release.test.ts`

---

## Phase 3: User Story 2 - Promote the staged version to production (Priority: P1)

**Goal**: `yarn release promote [--yes|-y] [--dry-run]` tags the release commit after a confirmation.

**Independent Test**: with the three runs green, promote with confirmation creates `vX.Y.Z` on the release commit and prints the `Release` run link.

- [X] T006 [US2] Test first, then implement: parse `promote` (with `--yes`, `-y`, `--dry-run`, any order) and reject it with a bump or a version, in `apps/delivery/src/composition/release.ts`
- [X] T007 [US2] Test first, then implement the promote flow (confirmed, declined, `--yes`, `--dry-run`, already released) in `apps/delivery/src/application/run-release.test.ts` and `apps/delivery/src/application/run-release.ts`: read the version on `origin/main`, skip the checkout prerequisites, re-check the release rules, ask `Promote X.Y.Z (<sha>) to production?`, tag and push, print the `Release` run link

---

## Phase 4: User Story 3 - Be refused when the version is not ready (Priority: P1)

**Goal**: a promotion that cannot succeed, or that ships something other than what staging runs, is refused or flagged at once.

**Independent Test**: promote with a run not green, then with a version not on staging: stopped, no wait, no tag.

- [X] T008 [US3] Test first, then implement: stop at once with `X.Y.Z is not delivered to staging yet` when the decided step is not a tagging step, in `apps/delivery/src/application/run-release.ts`
- [X] T009 [US3] Test first, then implement (runs not green, staging moved on, newer bump merged, local tag): print `staging now runs <b>, not <a>: production gets <a>` when the staging commit differs from the release commit; target only the version on `origin/main`; gate a tag that exists locally like a new one, in `apps/delivery/src/application/run-release.test.ts` and `apps/delivery/src/application/run-release.ts`

---

## Phase 5: User Story 4 - Promote from anywhere, resume after an interruption (Priority: P2)

**Goal**: promote ignores the checkout; either command resumes.

**Independent Test**: promote from another branch with a dirty tree; interrupt each command at every change and run it again.

- [X] T010 [US4] Test first, then make it hold: promote from another branch and a dirty tree; resume after an interruption at every change for both halves, in `apps/delivery/src/application/run-release.test.ts` and `apps/delivery/src/application/run-release.ts`

---

## Phase 6: User Story 5 - Staging shows the version production will get (Priority: P2)

**Goal**: staging deliveries are named `X.Y.Z-staging.<n>` from the app version.

**Independent Test**: `ci app-version` prints the app version; `ci write-manifest` without `--version` uses it.

- [X] T011 [US5] Add the `app-version` command (no option) and default `--version` of `write-manifest` to the app version, with tests, in `apps/delivery/src/composition/ci.ts` and `apps/delivery/src/composition/ci.test.ts`
- [X] T012 [US5] Name the staging server pack after `ci app-version` in `.github/workflows/deliver-staging.yml`, applied by the maintainer and merged with #166 (guarded folder)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T013 [P] Document the two-step procedure, the exit codes and the fallback in `docs/procedures/releases.md` and the index in `docs/README.md`
- [X] T014 [P] Describe both commands and their outputs in `specs/009-yarn-release-command/contracts/cli.md`
- [X] T015 Run `yarn test`, `yarn typecheck`, `yarn lint`, `yarn test:architecture`, `yarn test:scripts` and `prettier --check` on the changed files
- [X] T016 Dry-run the commands against GitHub (`yarn release promote --dry-run`, `yarn release promote minor` exits 2), as in the PR test plan

---

## Dependencies & Execution Order

- Phase 1 blocks everything. US1 and US2 share `run-release.ts`, so US2 follows US1; US3 builds on US2; US4 only adds tests on top; US5 is independent (different files) and may run in parallel with US2 to US4.
- Polish (docs, checks) comes last.

## Implementation Strategy

MVP = Phase 1 + US1 + US2: stop on staging, then promote. US3 adds the guards that make the promotion safe, US4 and US5 are refinements.
