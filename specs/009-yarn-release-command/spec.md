# Feature Specification: One-Command Release

**Feature Branch**: `feat/issue-142-add-a-yarn-release-command-that-bumps-merges-and-tags-a-release-in-one-run`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Add a `yarn release` command that bumps, merges and tags a release in one run (issue #142)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ship a release with one command (Priority: P1)

A maintainer wants to ship a new version of the app. Today this takes three manual steps in three places: edit the version in a pull request, wait for it to merge, then push a version tag by hand. A tag that breaks a release rule only fails after it is pushed. The maintainer runs one command from a local checkout, chooses the bump (major, minor, patch, or an explicit version), sees `current -> next`, confirms, and the command carries the release through to a pushed tag, without the maintainer opening or merging any pull request.

**Why this priority**: This is the whole feature: the value is replacing the manual, error-prone sequence with one guarded run.

**Independent Test**: With a clean checkout of the main branch, run the command with `patch` and confirm; check that a single bump commit lands on the main branch, that the required checks are awaited, and that the release tag is pushed on that commit and the release workflow starts.

**Acceptance Scenarios**:

1. **Given** a clean checkout on the main branch matching the remote, **When** the maintainer runs the command with `minor` and confirms, **Then** the next version is computed from the app version on the remote main branch, one bump commit titled `chore(release): bump the app version to X.Y.Z` lands on main, and the tag `vX.Y.Z` is pushed on that commit.
2. **Given** the same checkout, **When** the maintainer runs the command with an explicit version `X.Y.Z` higher than the current one, **Then** that version is used with no prompt for the bump type.
3. **Given** the same checkout, **When** the maintainer runs the command with no argument, **Then** it asks for the bump type or a version before continuing.
4. **Given** the command is run with the skip-confirmation option, **When** all checks pass, **Then** it proceeds without asking for confirmation.
5. **Given** the maintainer is shown `current -> next`, **When** they answer no, **Then** the repository and the remote are left untouched.

---

### User Story 2 - Be stopped early when the release cannot succeed (Priority: P1)

The maintainer wants to learn about a rule violation before anything is changed, not after a tag is pushed.

**Why this priority**: Failing after the tag is pushed is the pain point the issue describes; early refusal is core to the value.

**Independent Test**: Run the command with a version whose tag already exists, with a version not higher than production, and from a dirty or non-main checkout; each is refused with a clear message and nothing changes.

**Acceptance Scenarios**:

1. **Given** the local checkout is not on main, has uncommitted changes, or differs from the remote main branch after a fetch, **When** the command runs, **Then** it refuses to continue and says why.
2. **Given** an explicit version that is not of the form `X.Y.Z` or is not strictly higher than the current version, **When** the command runs, **Then** it rejects the version.
3. **Given** the tag `vX.Y.Z` already exists locally or on the remote, or the version is not higher than the production version, **When** the command runs, **Then** it refuses before any change.
4. **Given** the dry-run option, **When** the command runs, **Then** it prints the steps it would take and changes nothing.

---

### User Story 3 - Wait for the release gate and stop on failure (Priority: P2)

After the bump lands, the release gate needs the main-branch CI, the Android end-to-end run and the staging delivery to be green on the tagged commit. The Android end-to-end run takes about 20 minutes. The maintainer wants the command to wait for them, and to stop with a link if one fails, instead of tagging a commit that the gate would reject.

**Why this priority**: Needed for a correct end-to-end release, but the bump and early checks already deliver value on their own.

**Independent Test**: Simulate a failed required run on the bump commit; the command stops with the link to the failed run and creates no tag.

**Acceptance Scenarios**:

1. **Given** the bump pull request is open with auto-merge, **When** a required check fails, **Then** the command stops with the link to the pull request.
2. **Given** the app version on the remote main branch equals the requested version, **When** `CI`, `E2E Android` and `Deliver staging` have all succeeded on that commit, **Then** the command re-checks the gate rules, creates the annotated tag `vX.Y.Z` on that commit, pushes it, and prints the link to the `Release` workflow run.
3. **Given** one of the three runs fails, **When** the command observes it, **Then** it stops with the link to the failed run and does not tag.

---

### User Story 4 - Resume after an interruption (Priority: P2)

The maintainer may interrupt the command (for example Ctrl-C during the 20-minute wait) or lose the connection. Running it again with the same version must pick up at the next step.

**Why this priority**: The run is long, so interruption is expected; without resumption it would risk duplicate pull requests or commits.

**Independent Test**: Interrupt the command after the pull request is opened, run it again with the same version, and confirm no second pull request and no second bump commit exist.

**Acceptance Scenarios**:

1. **Given** a bump pull request for this version is already open, **When** the command is run again with the same version, **Then** it reuses that pull request and does not open another.
2. **Given** the bump is already on the remote main branch, **When** the command is run again, **Then** it creates no second commit and continues with waiting for the runs and tagging.
3. **Given** the tag already exists on the right commit, **When** the command is run again, **Then** it reports the release as already tagged and creates nothing.

---

### Edge Cases

- The app version on the remote main branch changes between the confirmation and the bump (another release landed): the command detects it and stops rather than bumping from a stale base.
- The branch `chore/release-X.Y.Z` already exists on the remote: it is reused, not recreated.
- The bump pull request is closed without merging: the command stops and reports it.
- The bump pull request was merged but its commit is no longer on `origin/main` (reverted): the command stops and reports it, instead of waiting for runs that will never come.
- The network or the GitHub API is unavailable mid-run: the command stops with a message and can be resumed.
- Another commit lands on main after the bump: the tag goes on the bump commit, not on the new head, and the gate is evaluated for that commit.
- A tool the command needs (git, the GitHub command-line client) is missing or not authenticated: it refuses with a message before changing anything.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The command MUST refuse to run unless the local checkout is on the main branch, has no uncommitted changes, and matches the remote main branch after a fetch.
- **FR-002**: The maintainer MUST be able to pass `major`, `minor`, `patch` or an explicit `X.Y.Z` as an argument and run without prompts; with no argument the command MUST ask for the bump type or a version.
- **FR-003**: The command MUST provide an option that skips the confirmation, for scripted use.
- **FR-004**: The command MUST compute the next version from the app version on the remote main branch, following semantic versioning, and MUST reject an explicit version that is not of the form `X.Y.Z` or not strictly higher than the current version.
- **FR-005**: Before any change, the command MUST print `current -> next` and ask for confirmation; answering no MUST leave the repository and the remote untouched.
- **FR-006**: Before any change, the command MUST refuse to continue when the tag `vX.Y.Z` already exists (locally or remotely) or when the version is not higher than the production version.
- **FR-007**: The command MUST provide a dry-run option that prints the steps it would take and changes nothing.
- **FR-008**: When the app version on the remote main branch is still the old one, the command MUST create the branch `chore/release-X.Y.Z`, commit `chore(release): bump the app version to X.Y.Z`, push it, open a pull request (or reuse the one already open for that branch), enable auto-merge in squash mode with branch deletion, and wait until the pull request is merged. If a required check fails, it MUST stop with the link to the pull request.
- **FR-009**: Once the app version on the remote main branch equals the requested version, the command MUST wait for `CI`, `E2E Android` and `Deliver staging` on that commit. If one fails, it MUST stop with the link to the failed run and MUST NOT tag.
- **FR-010**: When all three runs succeeded, the command MUST re-check the release gate rules, create the annotated tag `vX.Y.Z` on that commit, push it, and print the link to the `Release` workflow run.
- **FR-011**: The command MUST derive where it stands from git and the GitHub API (open bump pull request, version on the remote main branch, workflow runs, existing tag) so that running it again with the same version resumes at the next step, never opening a second pull request or creating a second commit.
- **FR-012**: The command MUST reuse the existing release rules (version comparison, tag naming, rule evaluation) rather than duplicate them, so the pre-tag checks and the release gate cannot disagree.
- **FR-013**: The command MUST NOT change any repository setting or ruleset.
- **FR-014**: The version computation, the explicit-version validation and the next-step decision MUST be covered by automated unit tests run by the project's test command.
- **FR-015**: The project README MUST document how to run a release with this command, what it waits for, and how to resume it.

### Key Entities

- **Release request**: the target version (from a bump type or an explicit value), the current version, and whether confirmation is skipped or the run is a dry run.
- **Release state**: what is observed from git and GitHub at a given moment (version on the remote main branch, open bump pull request, status of the three required runs, existing tag), from which the next step is decided.
- **Release step**: one of checking prerequisites, opening the bump, waiting for the merge, waiting for the required runs, tagging, or done.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A maintainer ships a release by running one command and answering at most one confirmation, with zero manual pull-request or tag operations.
- **SC-002**: 100% of releases whose tag already exists or whose version is not higher than production are refused before any change is made.
- **SC-003**: The command never pushes a tag on a commit where `CI`, `E2E Android` or `Deliver staging` has not succeeded.
- **SC-004**: After an interruption at any step, running the command again with the same version completes the release with no duplicate pull request and no duplicate bump commit.
- **SC-005**: In a dry run, 0 changes are made to the local repository or the remote, and every step that would run is listed.

## Assumptions

- The maintainer has push rights, an authenticated GitHub command-line client and a local checkout of the repository.
- Auto-merge is enabled on the repository and the main branch ruleset stays as it is today (pull request plus required checks, no bypass).
- The version source of truth is the app version in the mobile app configuration on the remote main branch.
- The "production version" is the version the production environment currently runs, as already read by the release gate.
- The command is for maintainers only and runs from a local checkout, never from CI.
- The command does not roll back: a failed run leaves the pull request or the failed run for the maintainer to handle, then the command is resumed.
- Output language for the command's messages is English (developer tooling, not part of the French app interface).
