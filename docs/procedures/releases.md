# Releases

A release is a version tag. Android users get it from the production F-Droid repository on the
Pi. `staging` and `development` builds are not releases. iOS is not delivered: it needs the paid
Apple Developer Program.

1. Do the manual checks first. Record in the test plan of the last pull request every manual check
   of quickstart §6 and the [device checks](device-checks.md). These checks are a precondition of a release: the
   pipeline does not run them, and `yarn release` does not either.
2. From a clean `main` that matches `origin/main`, run `yarn release`:

   ```sh
   yarn release [major|minor|patch|X.Y.Z] [--yes|-y] [--dry-run]
   ```

   - With `major`, `minor` or `patch` it computes the next version from the app version on
     `origin/main` (MINOR for a new feature, PATCH for fixes only). With `X.Y.Z` it uses that
     version, which must be strictly higher than the current one. With no argument it asks, so it
     needs a terminal.
   - It prints `current -> next` and asks for confirmation. `--yes` skips only that question.
   - `--dry-run` prints the steps it would take and changes nothing (it only runs `git fetch`).
   - It refuses, listing every reason, when you are not on `main`, the tree is dirty, `main`
     differs from `origin/main`, the tag already exists, or the version is not higher than the
     current one or the production version.

   Then it takes the steps itself: branch `chore/release-X.Y.Z`, commit
   `chore(release): bump the app version to X.Y.Z`, push, and a pull request with auto-merge
   (squash, delete branch). It waits for that pull request to merge, then for `CI`, `E2E Android`
   (about 20 minutes) and `Deliver staging` to be green on the squash commit. It checks the rules
   of `Release` again on that commit, creates the annotated tag `vX.Y.Z` and pushes it, then prints
   the link of the `Release` run.

   Try the change on staging while it waits.

   If it stops (a failed or closed pull request, a failed run, a network error, Ctrl+C), the
   message gives the link and the cause. Fix it and run the same command again: it looks at the
   current state and resumes where it stopped. A version that is already tagged ends with
   "already released".

   Exit codes: `0` released, already released, dry run done or declined; `1` refused or stopped;
   `2` usage error.

   Fallback, if the command is unusable: wait for the three runs yourself, then tag the squash
   commit by hand with `git tag vX.Y.Z <sha> && git push origin vX.Y.Z`.

3. `Release` checks the rules (the tag matches `version` in `app.config.ts`, the commit is on
   `main` with a green `E2E Android` run, the version is new), builds the production server, the
   APK, the F-Droid repository and the agent bundle, and publishes the release and the
   `channel-production` manifest. The agent deploys it like a staging delivery, and the run waits
   for the production health to report the commit.
4. Install the update on the phones from the F-Droid client and check the lists are still there.

If the health check times out (for example the agent was stopped), the run fails but the delivery
is not lost: once the agent is back, _Re-run failed jobs_ on the same run, with no new tag.

A faulty release is fixed forward, never rolled back by hand: a new pull request with the fix, then
these steps again with the next version. The agent already rolls back a deployment that fails to
start (see [Rollback and failed deployments](rollback.md)). An older version does not open data saved by a
newer one (FR-040).
