# Quickstart: validating the changelog feature

Prerequisites: `nix develop` (provides git-cliff), `pnpm install`.

1. Fast suite: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:architecture`, `pnpm test:scripts`; `shellcheck .github/scripts/release-notes.sh .github/scripts/release-notes.test.sh`; `actionlint`.
2. Preview: from a clean `main`, `pnpm release minor --dry-run`. Expect the `would write to CHANGELOG.md:` and `would write to changelog.json:` blocks and a clean `git status`.
3. Filtering by hand: `git cliff --context --unreleased --tag v9.9.9 | jq '.[0].commits | length'` agrees with the number of `feat`, `fix`, `perf` and breaking commits since the last tag.
4. Seed: `CHANGELOG.md` has `[2.1.0]`, `[2.0.1]`, `[1.2.0]` in that order, no `ci`, `e2e`, `test`, `delivery` scope entries; `jq length apps/mobile/src/changelog/changelog.json` is 3.
5. Notes: `sh .github/scripts/release-notes.sh 2.1.0` prints the section; `... 9.9.9` exits 1 naming the version.
6. Real release (maintainer, after merge): the bump pull request diff holds `app.config.ts`, `CHANGELOG.md`, `changelog.json`; its CI jobs succeed at once (`release-bump.sh`); the GitHub Release body of the tag equals the notes script output.

## Traceability

| Scenario | Test |
| --- | --- |
| US1.1, US1.3 | run-release test (bump commit receives the section); domain test (markdown and data from one section) |
| US1.2 | domain `parseContext` test (`(#N)`), cliff fixture test |
| US1.4 | run-release test (generator throws: stopped, no branch) |
| US2.1-US2.5 | git-cliff fixture-repo test (every type and scope, breaking, non-conventional) |
| US3.1-US3.2 | `release-notes.test.sh` |
| US4.1-US4.2 | run-release dry-run test (prints, no commit, no write) |
| US5.1-US5.2 | seed review checks in the PR, plus a Jest test reading the committed files for scope/type noise and order |
| Edge: resume, replace | domain `upsert*` tests; release-repository test with an existing section |
| Edge: empty release | domain render test |
