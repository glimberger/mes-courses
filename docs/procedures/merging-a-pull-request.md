# Merging a pull request

The CI workflow (`typecheck`, `lint`, `test`, `build`) runs on every pull request; a new push
cancels the run of the previous commit. Every one of its jobs must be green before merging:
`gh pr checks` shows none failing, pending or skipped.

The Android device suite (`e2e-android`, about 30 minutes) does not run on every push to a pull
request. It runs on every push to `main`, and on demand on a branch:

```sh
gh workflow run e2e.yml --ref <branch>
```

A pull request that is not documentation-only is merged only with a green `e2e-android` run on
its latest commit (constitution v2.3.0). Start the run once the pull request is final, then check
it right before merging:

```sh
gh run list --workflow e2e.yml --branch <branch> --limit 1 --json headSha,conclusion
# headSha must be the pull request's latest commit, conclusion "success"
```

`.github/scripts/app-changed.sh` decides whether a branch is documentation-only (`specs/`,
`.specify/`, Markdown files) or a release bump; the same rule tells you when a branch needs
`pnpm test:e2e:android` before it is pushed:

```sh
git diff --name-only "$(git merge-base origin/main HEAD)" HEAD |
  .github/scripts/app-changed.sh "<pull request title>" origin/main HEAD
# app=true  -> run pnpm test:e2e:android first, and the e2e workflow before merging
# app=false -> documentation only or release bump, the device suite is not needed
```

## Release bump pull request

A pull request titled `chore(release): bump ...` (opened by `pnpm release`) is a release bump
when its diff, not its title, says so (`.github/scripts/release-bump.sh`): every changed file is
`apps/mobile/app.config.ts`, `CHANGELOG.md` or `changelog.json`, and the only change in
`app.config.ts` is the `version` line. The `detect` job of the CI workflow then makes `typecheck`,
`lint`, `test` and `build` succeed at once without installing or running anything (they keep their
names, so the ruleset is satisfied), and `app-changed.sh` reports `app=false`: no `e2e-android`
run is needed. A pull request with a bump title that changes anything else runs the full CI and
needs the device suite. The workflow reads `release-bump.sh` from the base commit, so a pull
request cannot rewrite the rule that judges it.
