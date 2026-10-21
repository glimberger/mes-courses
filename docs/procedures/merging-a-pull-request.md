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
`.specify/`, Markdown files); the same rule tells you when a branch needs
`yarn test:e2e:android` before it is pushed:

```sh
git diff --name-only "$(git merge-base origin/main HEAD)" HEAD | .github/scripts/app-changed.sh
# app=true  -> run yarn test:e2e:android first, and the e2e workflow before merging
# app=false -> documentation only, the device suite is not needed
```
