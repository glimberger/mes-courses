# Contract: command and script deltas

Command line of `pnpm release` is unchanged ([009](../../009-yarn-release-command/contracts/cli.md), [010](../../010-release-staging-promote/contracts/cli.md)). Delta:

| Case | Output | Exit |
| --- | --- | --- |
| Normal run | the bump commit also holds `CHANGELOG.md` and `changelog.json` | 0 |
| Generator fails (tool missing, bad config) | the reason, then the resume hint; no branch, push or pull request | 1 |
| `--dry-run` | after `would ...` lines: `would write to CHANGELOG.md:` + the section, then `would write to changelog.json:` + the section as JSON; no file changed | 0 |

## `.github/scripts/release-notes.sh <X.Y.Z> [CHANGELOG.md]`

| Case | stdout | stderr | Exit |
| --- | --- | --- | --- |
| Section found | the section body (group headings and entries, without the `## [X.Y.Z]` line, trimmed) | | 0 |
| Version missing or section empty | | `No changelog section for X.Y.Z in CHANGELOG.md` | 1 |
| Missing argument or file | | usage / file name | 2 |
