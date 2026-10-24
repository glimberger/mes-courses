# Feature Specification: Deliver a Release to Staging, Then Promote It to Production

**Feature Branch**: `feat/issue-165-deliver-a-release-to-staging-then-promote-it-to-production`

**Created**: 2026-10-24

**Status**: Implemented (retrospective specification, written after the merge of PR #166)

**Input**: User description: "Deliver a release to staging, then promote it to production (issue #165)". Extends [009-yarn-release-command](../009-yarn-release-command/spec.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deliver a version to staging and stop there (Priority: P1)

Today the release command bumps the version, waits for the required runs and tags the commit at once, so production starts as soon as staging is green, before anyone has tried the app on staging. The maintainer wants the release to stop once the version is on staging, so the app can be validated there, and to be told how to go on.

**Why this priority**: This is the point of the feature: a release gets a validation window between staging and production.

**Independent Test**: From a clean checkout of the main branch, run the release command with `minor`; check that the bump pull request is opened and merged, that the three required runs are awaited, and that the command ends with `X.Y.Z is on staging (<sha>)` and exit code 0, without any tag created.

**Acceptance Scenarios**:

1. **Given** a clean checkout on the main branch matching the remote, **When** the maintainer runs the release command with a bump type or an explicit version and confirms, **Then** the bump pull request is opened, auto-merged, and the command waits for `CI`, `E2E Android` and `Deliver staging` on the squash commit.
2. **Given** the three runs succeeded, **When** the command ends, **Then** it prints `X.Y.Z is on staging (<sha>)`, says how to promote the version, exits with code 0 and has created no tag.
3. **Given** all the checks and steps of the previous release command (refusals, confirmation, dry run, skip-confirmation option), **When** the maintainer uses them, **Then** they behave as specified in feature 009.

---

### User Story 2 - Promote the staged version to production (Priority: P1)

After validating the version on staging, the maintainer wants to ship that same version to production without going again through the bump, the merge and the waits.

**Why this priority**: Without it, a version delivered to staging could never reach production.

**Independent Test**: With version X.Y.Z on staging and its runs green, run the promote command, confirm, and check that the tag `vX.Y.Z` exists on the release commit and that the link to the `Release` run is printed.

**Acceptance Scenarios**:

1. **Given** the version on the remote main branch has reached staging and its required runs are green, **When** the maintainer runs the promote command and confirms `Promote X.Y.Z (<sha>) to production?`, **Then** the annotated tag `vX.Y.Z` is created on the commit of that version, pushed, and the link to the `Release` run is printed.
2. **Given** the skip-confirmation option, **When** the promote command runs, **Then** it tags without asking.
3. **Given** the dry-run option, **When** the promote command runs, **Then** it prints what it would do and changes nothing.
4. **Given** the maintainer answers no to the confirmation, **When** the command ends, **Then** nothing was created and the exit code is 0.
5. **Given** the version is already tagged, **When** the promote command runs, **Then** it reports `already released` and creates nothing.

---

### User Story 3 - Be refused when the version is not ready (Priority: P1)

The maintainer wants a promotion that cannot succeed, or that would not ship what was validated, to be refused or flagged immediately, without waiting.

**Why this priority**: The safety of the two-step flow rests on it: production must never get a version that did not pass staging.

**Independent Test**: Run the promote command while a required run is not green, and while the version has not reached staging; each is refused at once with a message and no tag.

**Acceptance Scenarios**:

1. **Given** a required run of the version is not green, or the version has not reached staging, **When** the promote command runs, **Then** it refuses without waiting and says which run or step is missing.
2. **Given** pull requests merged after the bump have reached staging since, **When** the promote command runs, **Then** it says that staging runs a later commit and that production gets the bump commit.
3. **Given** a newer bump has merged on the main branch, **When** the promote command runs, **Then** it targets that newer version, never an older version still on staging.
4. **Given** the promote command is given a bump type or a version, **When** it parses its arguments, **Then** it fails with a usage error (exit code 2).

---

### User Story 4 - Promote from anywhere, resume after an interruption (Priority: P2)

Promoting only makes a tag, so the maintainer wants to do it from any checkout, even on another branch or with uncommitted work. Either command, interrupted, must resume where it stopped.

**Why this priority**: Convenience and robustness; the two commands already deliver value without it.

**Independent Test**: Run the promote command from a feature branch with a dirty tree, then interrupt each command at every state change and run it again.

**Acceptance Scenarios**:

1. **Given** a checkout on another branch or with uncommitted changes, **When** the promote command runs, **Then** it does not refuse because of the checkout.
2. **Given** either command was interrupted, **When** it is run again, **Then** it resumes at the next step, creating no second pull request, commit or tag.

---

### User Story 5 - Staging shows the version production will get (Priority: P2)

Staging and production are versioned independently, so the version shown on staging says nothing about the one production will get. The maintainer wants each staging delivery to be named after the app version, so that validating `X.Y.Z-staging.<n>` means validating the future `X.Y.Z`.

**Why this priority**: Makes the validation meaningful, but the two-step flow works without it.

**Independent Test**: Deliver a version to staging and read the staging manifest and the staging server health: both report `X.Y.Z-staging.<n>` where `X.Y.Z` is the app version.

**Acceptance Scenarios**:

1. **Given** the app version is `X.Y.Z`, **When** a delivery to staging is made, **Then** the staging manifest and the staging server report `X.Y.Z-staging.<n>`.

---

### Edge Cases

- A run required by the promotion is still in progress: refused at once, not waited for.
- Staging has moved on to a later commit than the bump (other merges since): the promotion is allowed and the maintainer is told.
- The version on the remote main branch is already released: reported as already released, exit code 0.
- The promote command is used with a main branch whose version was never delivered to staging: refused.
- The workflow file that names staging deliveries is a guarded folder that only the maintainer edits: the change is handed over as a patch in the pull request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The release command MUST keep all the checks and steps of feature 009 (prerequisites, confirmation, dry run, bump pull request, auto-merge, wait for `CI`, `E2E Android` and `Deliver staging`), but MUST stop once the version is on staging, print `X.Y.Z is on staging (<sha>)` and how to promote, exit with code 0 and create no tag.
- **FR-002**: The system MUST provide a promote command that takes the version on the remote main branch and, once its required runs are green and the release rules hold, asks for confirmation, creates and pushes the annotated tag `vX.Y.Z` on that version's commit, and prints the link to the `Release` run.
- **FR-003**: The promote command MUST accept a skip-confirmation option (long and short forms) and a dry-run option that changes nothing, and MUST reject any other argument with a usage error.
- **FR-004**: The promote command MUST refuse without waiting when a required run is not green or the version has not reached staging, and MUST say why.
- **FR-005**: The promote command MUST tell the maintainer when staging runs a later commit than the one it will tag.
- **FR-006**: The promote command MUST always target the version on the remote main branch.
- **FR-007**: The promote command MUST work from any checkout (other branch, uncommitted changes): it only creates a tag.
- **FR-008**: Both commands MUST derive where they stand from git and GitHub, so that running either again after an interruption resumes at the next step; interruption tests MUST cover both halves.
- **FR-009**: Each staging delivery MUST be named `X.Y.Z-staging.<n>`, `X.Y.Z` being the app version of the mobile app configuration, in the staging manifest and on the staging server.
- **FR-010**: The release procedure and the command contract of feature 009 MUST describe the two-step flow.
- **FR-011**: The project's tests, type check, lint and architecture checks MUST pass.

### Key Entities

- **Staged version**: a version whose bump has merged and whose required runs are green on its commit; the only thing the promote command can tag.
- **Release commit**: the squash commit of the bump; it receives the tag even when staging runs a later commit.
- **Staging delivery name**: `X.Y.Z-staging.<n>`, the app version followed by the delivery sequence number.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of releases pause once the version is on staging: no tag is created before an explicit promotion.
- **SC-002**: A maintainer promotes a staged version with one command and at most one confirmation, with no new bump, merge or wait.
- **SC-003**: 100% of promotions of a version whose required runs are not green are refused immediately, without waiting.
- **SC-004**: After an interruption at any step of either command, running it again completes the work with no duplicate pull request, commit or tag.
- **SC-005**: The version shown on staging always starts with the version production will get.

## Assumptions

- Feature 009 (one-command release) is in place; this feature changes where it stops and adds the promotion.
- The `Release` workflow keeps checking its own rules when the tag is pushed.
- The staging naming change in the guarded workflow folder is applied by the maintainer; until then the staging server may still report the server package version.
- The manual device checks remain a precondition of a release and are not run by the commands.
- Output language of the commands is English (developer tooling).
