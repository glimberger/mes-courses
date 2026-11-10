# Research: Changelog with git-cliff

## R1. One git-cliff run, rendering in TypeScript

- **Decision**: run `git cliff --context` (filtered commits as JSON) and render the markdown and `changelog.json` from the same parsed `ChangelogSection` in `domain/changelog.ts`. `cliff.toml` holds the filtering and grouping only (`commit_parsers`); its body template is not used for output.
- **Rationale**: FR-006 (same data in both files) holds by construction; rendering, the empty-section line, the French titles and the replace-on-resume rule are pure functions that unit tests cover without the binary (Principles I, III).
- **Alternatives**: two git-cliff runs with a markdown and a JSON template (two outputs can drift, JSON escaping done in a template); markdown only plus parsing it back (fragile).

## R2. Filtering in `cliff.toml`

- **Decision**: `conventional_commits = true`, `filter_unconventional = true`; ordered `commit_parsers`: breaking first (`breaking = true` keeps any type or scope, group `breaking`), then skip scopes `ci|e2e|test|delivery`, then `feat` -> `features`, `fix` -> `fixes`, `perf` -> `performances`, then skip everything else. `tag_pattern = "^v[0-9]+\\.[0-9]+\\.[0-9]+$"` so `channel-staging` and `channel-production` tags are ignored.
- **Rationale**: the order encodes the spec (a breaking change beats a dropped scope or type; `fix(e2e)` is dropped). `(#N)` is parsed in TypeScript from the message, so the config stays free of repository URLs.
- **To verify in the first Red step**: that `--context` omits skipped commits, exposes `breaking`, `group`, and the message without the type prefix. Where git-cliff differs, adjust `cliff.toml` or the parser in the domain module, never the spec.

## R3. Commit range and tag

- **Decision**: the adapter runs `git cliff --context --unreleased --tag vX.Y.Z` over `origin/main` (range since the last matching tag reachable from it), with the release's version passed as the tag so the section is named for it. The bump commit does not exist yet, so it is not listed. With no previous tag, the whole history is used.
- **Rationale**: matches the spec ("commits since the last tag are the section of the version being released"); `origin/main` is what the bump branch is created from.

## R4. Where generation runs in the flow

- **Decision**: in the `open-bump` step of `run-release.ts`, before `commitBump`, through the `Steps` indirection: the real step calls the generator and passes the section to `commitBump(version, branch, section)`; the dry-run step calls the generator too (read-only) and prints the markdown and the JSON, writes nothing. A generator error is caught by the existing `runRelease` guard and returned as `stopped`; at that point no branch, commit, push or pull request exists.
- **Rationale**: reuses the existing resume logic; `commitBump` already returns early when the remote branch exists, so a resume does not rewrite the files.
- **Alternatives**: generating in `prepareStaging` (also before anything changes, but an interrupted run that only waits would regenerate for nothing).

## R5. Writing the files and idempotence

- **Decision**: `commitBump` (after `git switch -C branch origin/main`) reads the two files from that tree, upserts the section (replace the `## [X.Y.Z]` block or the JSON entry of the same version, else insert at the top), writes them, `git add` them with `app.config.ts`, one commit. Missing files start empty (first release). Section date: the release command's clock, `YYYY-MM-DD` (UTC).
- **Rationale**: spec edge cases (resume, version already present). A version present in the file but not released is replaced.

## R6. Release body

- **Decision**: `.github/scripts/release-notes.sh <version> [file]` prints the lines from `## [<version>]` (excluded heading line kept out of the body) up to the next `## [` heading, trimmed; exits 1 with a message naming the version when absent or empty. The workflow runs it and passes the result to `gh release create --notes-file`.
- **Rationale**: the workflow stays independent of git-cliff (spec); shell script tested like the other `.github/scripts` and shellchecked. Exact-body requirement: the body is the section content under the heading (SC-003, the heading is the release title context).
- **Open point resolved**: "exactly the section" is taken as the section including its group headings and bullets, without the `## [X.Y.Z] - date` line, since the GitHub Release already has the tag as title.

## R7. Seeding

- **Decision**: a throwaway `tsx` script, not committed, calls the real adapter and the domain renderer for each of `v1.2.0`, `v2.0.1`, `v2.1.0` (range between consecutive tags, date = the tag date) and writes the two files; the output is reviewed, Prettier-checked and committed as generated data. Versions after `v2.1.0` that are on `main` but not tagged are not part of the seed; they land in the next release's section.
- **Rationale**: spec says "once"; keeping a seed command would be speculative (Principle IV).

## R8. Tests needing the binary

- **Decision**: the cliff adapter test builds a temporary git repository (fixed author dates, commits of every type and scope, a tag) and runs the real `git cliff`; it runs inside `nix develop`, as all repository commands do, and fails with a clear message if the binary is missing (never skipped). All other release tests use the fake generator.
- **Rationale**: spec clarification on FR-011; fast (a handful of commits).

## R9. Formatting of generated files

- **Decision**: `JSON.stringify(data, null, 2)` plus a final newline, markdown lists with `-`, blank lines around headings, so `prettier --check` passes without an ignore entry. A test asserts both outputs are Prettier-stable for a sample section.
