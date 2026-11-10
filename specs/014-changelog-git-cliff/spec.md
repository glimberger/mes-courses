# Feature Specification: Changelog Generated with git-cliff in the Release Bump

**Feature Branch**: `feat/issue-202-generate-the-changelog-with-git-cliff-in-the-release-bump`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Generate the changelog with git-cliff in the release bump: `cliff.toml` keeps `feat`, `fix`, `perf` and breaking changes and drops the noise types and scopes; git-cliff is in the Nix dev shell; `pnpm release` commits `CHANGELOG.md` and `apps/mobile/src/changelog/changelog.json` with the version change, in the bump pull request; `release.yml` uses the version's entry as the GitHub Release body; `--dry-run` prints what would be written; the existing tags are seeded once." (issue #202, part of epic #199). Builds on [009-yarn-release-command](../009-yarn-release-command/spec.md) and [010-release-staging-promote](../010-release-staging-promote/spec.md). Unblocks #203 and #204, which consume `changelog.json` in the app.

## Clarifications

### Session 2026-11-10

Questions were answered with the recommended option (no interactive session).

- Q: Which commits does the changelog list? -> A: Conventional Commits of type `feat`, `fix` and `perf`, plus any breaking change. Types `chore`, `docs`, `ci`, `test`, `refactor`, `build`, `style` and the scopes `ci`, `e2e`, `test`, `delivery` are dropped, even for a `feat` or `fix` type (for example `fix(e2e)`). A breaking change is kept whatever its type or scope.
- Q: Which language and wording are used? -> A: Entries keep the commit subject as written (English). Only the group titles are French: "Nouveautés" for `feat` and "Corrections" for `fix`, stored under the keys `features` and `fixes` in the data. `perf` and breaking changes get their own groups, "Performances" (`performances`) and "Changements incompatibles" (`breaking`).
- Q: How is an entry linked to its pull request? -> A: Pull requests are squash-merged and the subject ends with `(#N)`: the number becomes a link to that pull request. A commit without a number is listed without a link.
- Q: Which section is "unreleased" when `pnpm release` runs? -> A: The commits since the last `vX.Y.Z` tag are rendered as the section of the version being released (the bump target), dated the day of the bump, not as an "Unreleased" section.
- Q: What if a release has no entry to list (only dropped types)? -> A: The section is still written, with a single line "No user-facing changes.", so that the version has an entry and the GitHub Release body is never empty.
- Q: Is the generated file edited by hand? -> A: No. Both files are generated and never hand-edited; a fix is made in `cliff.toml` or in the commit history source, then regenerated.
- Q: What is the order of sections and of the seed? -> A: Newest version first. The seed covers `v1.2.0`, `v2.0.1` and `v2.1.0`; the seed is produced once by running git-cliff over the history and reviewed before commit.
- Q: What is the shape of `changelog.json`? -> A: A JSON array of sections, newest first: `{ version, date, features[], fixes[], performances[], breaking[] }`, each entry `{ text, pr }` with `pr` a number or `null`; empty groups are empty arrays. The shape is a stable contract for #203 and #204 and is covered by a test.
- Q: Does the `Release` workflow need git-cliff to get the body? -> A: No. It extracts the version's section from the committed `CHANGELOG.md` (between its heading and the next one) and passes it to `gh release create --notes-file`, replacing `--generate-notes`. This keeps the workflow independent of git-cliff.
- Q: Where is the section date taken from, and what is a section heading? -> A: The date is the bump day (`YYYY-MM-DD`, from the release command's clock). The heading is `## [X.Y.Z] - YYYY-MM-DD`, so the extraction can match on the bare version.
- Q: Does a filtering test need a real git-cliff? -> A: Filtering tests (FR-011) run git-cliff against a throwaway fixture repository inside the Nix dev shell; release-step unit tests in `apps/delivery` use a fake generator port (Hexagonal Architecture), so they stay fast and need no binary.
- Q: Does the staging/production flow change? -> A: No. The changelog is part of the existing bump pull request; the tag, the `Deliver staging` run and `pnpm release promote` are unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A release brings its changelog (Priority: P1)

The maintainer runs `pnpm release`. The bump commit contains, besides the version change, the updated `CHANGELOG.md` and `changelog.json` with a section for the version being released, built from the commits since the previous tag.

**Why this priority**: It is the core of the feature: without it there is no changelog.

**Independent Test**: In a fixture repository with a previous tag and Conventional Commits, run the release step: the bump commit contains the two files, and the new section lists the expected entries.

**Acceptance Scenarios**:

1. **Given** commits since `v2.1.0` of types `feat`, `fix`, `chore` and `docs`, **When** the maintainer releases `2.2.0`, **Then** the bump commit contains `CHANGELOG.md` and `changelog.json` with a `2.2.0` section listing only the `feat` and `fix` entries.
2. **Given** an entry whose subject ends with `(#123)`, **When** the changelog is generated, **Then** the entry links to pull request 123.
3. **Given** the same commits, **When** the two files are read, **Then** they hold the same entries (the markdown is a rendering of the data).
4. **Given** the generation fails (tool missing, bad config), **When** `pnpm release` runs, **Then** it stops before creating the branch or pushing anything and says why.

---

### User Story 2 - Only meaningful changes are listed (Priority: P1)

A reader of the changelog sees features, fixes and performance work, and breaking changes, with no CI, test or tooling noise.

**Why this priority**: The changelog is only useful if it reads well; the history is full of noise.

**Independent Test**: Run the filter on a fixture history that mixes every type and scope: the output matches the expected list exactly.

**Acceptance Scenarios**:

1. **Given** commits `feat: ...`, `fix: ...`, `perf: ...`, **When** generated, **Then** they appear under "Nouveautés", "Corrections" and "Performances".
2. **Given** `fix(e2e): ...`, `fix(ci): ...`, `fix(test): ...`, `feat(delivery): ...`, **When** generated, **Then** none appears.
3. **Given** `chore`, `docs`, `ci`, `test`, `refactor`, `build` and `style` commits, **When** generated, **Then** none appears.
4. **Given** a commit marked breaking (`!` or a `BREAKING CHANGE` footer) of a dropped type, **When** generated, **Then** it appears under "Changements incompatibles".
5. **Given** a commit that is not a Conventional Commit, **When** generated, **Then** it is ignored and does not stop the generation.

---

### User Story 3 - The GitHub Release body is the changelog entry (Priority: P1)

When the version is promoted and the GitHub Release is created, its description is the version's entry from `CHANGELOG.md`, not auto-generated notes.

**Why this priority**: It publishes the changelog where users and testers look first.

**Independent Test**: Extract the entry of a version from a `CHANGELOG.md` fixture; run the extraction for a missing version.

**Acceptance Scenarios**:

1. **Given** a `CHANGELOG.md` with sections for `2.1.0` and `2.0.1`, **When** the `Release` workflow publishes `v2.1.0`, **Then** the Release body is exactly the `2.1.0` section.
2. **Given** the tag's version has no section, **When** the workflow runs, **Then** it fails with a message naming the version rather than publishing an empty body.

---

### User Story 4 - Preview before releasing (Priority: P2)

The maintainer runs `pnpm release --dry-run` and sees what would be written, without any file being changed.

**Why this priority**: Lets the maintainer check wording and filtering before the pull request exists; secondary to the generation itself.

**Independent Test**: Run with `--dry-run` on a fixture: the output shows the would-be section; the working tree is unchanged.

**Acceptance Scenarios**:

1. **Given** commits since the last tag, **When** `pnpm release minor --dry-run` runs, **Then** it prints the section that would be added to `CHANGELOG.md` and the data that would go to `changelog.json`, and changes no file.
2. **Given** `--dry-run`, **When** it ends, **Then** no branch, commit, push or pull request exists.

---

### User Story 5 - The existing releases are seeded (Priority: P2)

On the first run, the changelog already has entries for the existing tags, so the app and readers have history from day one.

**Why this priority**: Nice to have at launch; the feature works without it for future releases.

**Independent Test**: Read the committed `CHANGELOG.md`: sections for `2.1.0`, `2.0.1`, `1.2.0`, no CI or test noise.

**Acceptance Scenarios**:

1. **Given** the committed seed, **When** read, **Then** it has one section per existing tag, newest first.
2. **Given** the seed, **When** scanned, **Then** it contains no entry of a dropped type or scope.

---

### Edge Cases

- No previous tag (first release): the section covers the whole history.
- No entries after filtering: the section holds "No user-facing changes." (see Clarifications).
- A commit subject containing characters that are special in markdown or JSON: rendered and encoded correctly.
- The release is re-run after a stop (resume): the changelog is not duplicated; the section of the version is replaced, not appended.
- The git-cliff version differs between a local machine and CI: prevented by one pinned version in the Nix dev shell.
- A version already released: refused by its tag (an existing `vX.Y.Z` tag, local or remote), as today; `CHANGELOG.md` is not what decides. A section already in `CHANGELOG.md` for a version that is not released yet (no tag) is replaced, not appended.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A `cliff.toml` at the repository root MUST keep `feat`, `fix`, `perf` and breaking changes, and drop the types `chore`, `docs`, `ci`, `test`, `refactor`, `build`, `style` and the scopes `ci`, `e2e`, `test`, `delivery`.
- **FR-002**: Entries MUST be grouped as "Nouveautés" (`features`), "Corrections" (`fixes`), "Performances" (`performances`) and "Changements incompatibles" (`breaking`), the text being the commit subject as written.
- **FR-003**: Each entry MUST link to its pull request when the subject carries a `(#N)` number.
- **FR-004**: git-cliff MUST be provided by the Nix dev shell (`flake.nix`) so that local use and CI run the same version.
- **FR-005**: `pnpm release` MUST generate the section of the version being released from the commits since the last tag, and commit `CHANGELOG.md` and `apps/mobile/src/changelog/changelog.json` together with the version change, in the same bump pull request.
- **FR-006**: `CHANGELOG.md` and `changelog.json` MUST carry the same data; the markdown is its rendering.
- **FR-007**: A failure to generate the changelog MUST stop `pnpm release` before any branch, push or pull request is created, with a clear reason.
- **FR-008**: `pnpm release --dry-run` MUST print what would be written to both files and change nothing.
- **FR-009**: The `Release` workflow MUST use the entry of the released version, taken from `CHANGELOG.md`, as the GitHub Release body instead of generated notes, and MUST fail with a clear message when the entry is missing.
- **FR-010**: The changelog MUST be seeded for `v1.2.0`, `v2.0.1` and `v2.1.0` by running git-cliff over the history once, with no CI or test noise.
- **FR-011**: A test or fixture repository MUST check the filtering (FR-001, FR-002, FR-003); unit tests in `apps/delivery` MUST cover the release step, including dry-run and failure.
- **FR-012**: The README or `docs/procedures/releases.md` MUST explain the changelog, its filtering rules and how to preview it.

### Key Entities

- **Changelog section**: one released version: number, date, and entries grouped by kind.
- **Changelog entry**: the commit subject, its kind (feature, fix, performance, breaking) and an optional pull request number.
- **Changelog data**: the structured list of sections consumed by the app; **changelog document**: its markdown rendering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of releases made with `pnpm release` include a changelog section for their version in the bump pull request, with no manual step.
- **SC-002**: 0 entries of a dropped type or scope appear in the seed or in a generated section on the fixture history.
- **SC-003**: The body of each GitHub Release equals its version's section of `CHANGELOG.md`.
- **SC-004**: A maintainer can preview the next section in a single command, with no file changed.
- **SC-005**: Updated and new tests and the quality gates are green.

## Assumptions

- Pull requests are squash-merged with a Conventional Commit subject ending in `(#N)`, so one commit equals one pull request.
- The app screens that show `changelog.json` are out of scope (#203, #204); this feature only produces the file.
- The pinned git-cliff version comes from the Nix dev shell; adding the dependency is decided by the user (issue #202), and CI gets it the same way as other tooling.
- Release flow, tagging, staging and promotion are unchanged apart from the extra files in the bump commit.
- Group titles are French, matching the French interface (Principle X); entry text stays English as in the commits.
- Offline first and synchronization (Principle VII) do not apply: this is release tooling run by the maintainer, not application behavior; the app only receives a committed data file.
