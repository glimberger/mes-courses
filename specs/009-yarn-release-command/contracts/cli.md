# Contract: `yarn release`

```text
yarn release [major|minor|patch|X.Y.Z] [--yes|-y] [--dry-run]
```

| Input | Behavior |
| --- | --- |
| no argument | asks for the bump type or a version (usage error when stdin is not a terminal) |
| `major` / `minor` / `patch` | next version from the app version on `origin/main` |
| `X.Y.Z` | used as is; must be strictly higher than the current version |
| `--yes`, `-y` | skips only the `current -> next` confirmation |
| `--dry-run` | prints the steps it would take; changes nothing (runs `git fetch`, which only updates remote-tracking refs) |
| anything else | usage message, exit 2 |

Exit codes: `0` released, already tagged, dry run done or declined; `1` refused or stopped (message and link on stderr); `2` usage error.

Output (stdout): the `current -> next` line, one line per step (`bump pull request: <url>`, `waiting for CI, E2E Android, Deliver staging on <sha>`, `tagged vX.Y.Z on <sha>`, `Release run: <url>`). Stop messages contain the URL of the pull request or of the failed run and say to run the same command again to resume. A required run cancelled by a later push to main is reported as cancelled, with `gh run rerun <id>`. When the version on main was never released, a bump type resumes it (and says so) instead of bumping again; so does an interactive run.

Side effects, in order: branch `chore/release-X.Y.Z`; commit `chore(release): bump the app version to X.Y.Z`; push; pull request with auto-merge (squash, delete branch); annotated tag `vX.Y.Z` pushed. Nothing else is modified, no repository setting or ruleset.
