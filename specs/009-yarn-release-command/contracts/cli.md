# Contract: `yarn release`

```text
yarn release [major|minor|patch|X.Y.Z] [--yes|-y] [--dry-run]   deliver to staging
yarn release promote [--yes|-y] [--dry-run]                     send staging to production
```

A release has two halves. The first delivers the version to staging and stops; the maintainer
validates it there; `promote` then tags the commit staging received, which starts `Release`.

| Input | Behavior |
| --- | --- |
| no argument | asks for the bump type or a version (usage error when stdin is not a terminal) |
| `major` / `minor` / `patch` | next version from the app version on `origin/main` |
| `X.Y.Z` | used as is; must be strictly higher than the current version |
| `promote` | the version on `origin/main`, once its required runs are green on its commit; refused before; an older version still on staging is skipped once a newer bump has merged |
| `--yes`, `-y` | skips only the confirmation (`current -> next`, or the promotion) |
| `--dry-run` | prints the steps it would take; changes nothing (runs `git fetch`, which only updates remote-tracking refs) |
| anything else | usage message, exit 2 |

Exit codes: `0` delivered to staging, released, already tagged, dry run done or declined; `1` refused or stopped (message and link on stderr); `2` usage error.

Output (stdout): the `current -> next` line, one line per step (`bump pull request: <url>`, `waiting for CI, E2E Android, Deliver staging on <sha>`, `X.Y.Z is on staging (<sha>)`). For `promote`: `X.Y.Z: staging -> production`, a note when staging has moved on to a later commit, `tagged vX.Y.Z on <sha>`, `Release run: <url>`. Stop messages contain the URL of the pull request or of the failed run and say to run the same command again to resume. A required run cancelled by a later push to main is reported as cancelled, with `gh run rerun <id>`. When the version on main was never released, a bump type resumes it (and says so) instead of bumping again; so does an interactive run.

Side effects, in order: branch `chore/release-X.Y.Z`; commit `chore(release): bump the app version to X.Y.Z`; push; pull request with auto-merge (squash, delete branch). Then, with `promote` only: annotated tag `vX.Y.Z` pushed. Nothing else is modified, no repository setting or ruleset.
