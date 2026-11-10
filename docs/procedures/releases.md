# Releases

A release is a version tag. Android users get it from the production F-Droid repository on the
Pi. `staging` and `development` builds are not releases. iOS is not delivered: it needs the paid
Apple Developer Program.

1. Do the manual checks first. Record in the test plan of the last pull request every manual check
   of [quickstart §6](../../specs/001-shopping-lists/quickstart.md) and the [device checks](device-checks.md). These checks are a precondition of a release: the
   pipeline does not run them, and `pnpm release` does not either.
2. Deliver the version to staging. From a clean `main` that matches `origin/main`, run:

   ```sh
   pnpm release [major|minor|patch|X.Y.Z] [--yes|-y] [--dry-run]
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
   `chore(release): bump the app version to X.Y.Z` (the version and the changelog, see
   [The changelog](#the-changelog)), push, and a pull request with auto-merge
   (squash, delete branch). It waits for that pull request to merge, then for `CI`, `E2E Android`
   (about 20 minutes) and `Deliver staging` to be green on the squash commit. It stops there:
   staging now runs `X.Y.Z-staging.<n>`, the version production will get, and the command prints
   `X.Y.Z is on staging (<sha>)`.

3. Validate the version on staging: install "Mes courses (test)" from the staging F-Droid
   repository and try the change.

4. Promote it to production, from any checkout:

   ```sh
   pnpm release promote [--yes|-y] [--dry-run]
   ```

   It takes the version on `origin/main`, checks that its runs (`Deliver staging` included) are
   green on its commit and the rules of `Release`, asks `Promote X.Y.Z (<sha>) to production?`,
   then creates the annotated tag `vX.Y.Z` on that commit, pushes it and prints the link of the
   `Release` run. Nothing is merged or waited for again. It refuses a version that has not reached
   staging yet. When pull requests merged after the bump have reached staging since, it says so:
   production gets the bump commit, not what staging runs now.
   It always targets the version on `origin/main`: once a newer bump has merged, an older version
   still on staging can no longer be promoted, and the newer one is promoted instead.

   If a command stops (a failed or closed pull request, a failed run, a network error, Ctrl+C),
   the message gives the link and the cause. Fix it and run the same command again: it looks at
   the current state and resumes where it stopped. A version that is already tagged ends with
   "already released".

   Exit codes: `0` delivered to staging, released, already released, dry run done or declined;
   `1` refused or stopped; `2` usage error.

   Fallback, if the command is unusable: wait for the three runs yourself, then tag the squash
   commit by hand with `git tag vX.Y.Z <sha> && git push origin vX.Y.Z`.

5. `Release` checks the rules (the tag matches `version` in `app.config.ts`, the commit is on
   `main` with a green `E2E Android` run, the version is new, and staging holds a server archive to
   reuse), takes the server archive staging delivered, builds the APK, the F-Droid repository and
   the agent bundle, and publishes the release and the `channel-production` manifest. The agent deploys it like a staging delivery, and the run waits
   for the production health to report the commit.
6. Install the update on the phones from the F-Droid client and check the lists are still there.

### The production server is the staging server

`Release` does not build the server: it takes the archive that `Deliver staging` built and the Pi
ran on staging ([ADR-0015](../adr/0015-production-reuses-the-staging-server-artifact.md)). The
`gate` and the `server-artifact` job look in the `channel-staging` manifest for the server entry
of the tagged commit: the entry of that commit, or of an earlier one when no later commit changed
the server (the version bump usually does not). They check the commit and the SHA-256 of the
download, and the workflow compares the checksum again, so production runs the same bytes you
validated on staging. Only the version name, the commit and the signature are written for
production, by the `write-manifest` step; the agent writes `build-info.json` on the Pi.

The release stops before anything is published, with a message, when:

- staging has no manifest: deliver the commit to staging first;
- the staging archive was built at a commit that is not an ancestor of the tag: staging has moved
  past it (a later server change was delivered). Promote the version on `origin/main` instead;
- the server changed since the staging archive: wait for `Deliver staging` to build it, then
  tag again;
- the asset is gone or its checksum differs from the manifest.

The server is never rebuilt as a fallback. The Android build is still made for production, because
the server URL and the app identity are fixed when it is built.

**First release with ADR-0015.** The agent 1.1.0 writes `build-info.json` itself, and the manifests
now require it. Update the agent on the Pi from the `delivery-1.1.0.tar.gz` asset
([updating the agent](updating-the-agent.md)) before the first delivery that uses it: an older agent
refuses the manifest (`needs agent 1.1.0 or newer`) and the instances stay on their version.

If the health check times out (for example the agent was stopped), the run fails but the delivery
is not lost: once the agent is back, _Re-run failed jobs_ on the same run, with no new tag.

A faulty release is fixed forward, never rolled back by hand: a new pull request with the fix, then
these steps again with the next version. The agent already rolls back a deployment that fails to
start (see [Rollback and failed deployments](rollback.md)). An older version does not open data saved by a
newer one (FR-040).

## The changelog

Each release has a changelog entry, generated by [git-cliff](https://git-cliff.org) (provided by
the Nix dev shell, so run `pnpm release` from `nix develop`). `pnpm release` writes it in the
bump commit, so it is reviewed in the bump pull request with the version change:

- `CHANGELOG.md` at the repository root, for people (French group titles, newest version first);
- `apps/mobile/src/changelog/changelog.json`, the same data for the app screens.

Both files are generated: never edit them by hand. Re-running `pnpm release` after a stop
replaces the section of the same version, never duplicating it.

**What is listed.** The commits since the last release tag (`vX.Y.Z`; the `channel-*` tags are
not releases), filtered by [`cliff.toml`](../../cliff.toml), the first matching rule wins:

1. a breaking change (`!` or a `BREAKING CHANGE` footer) is kept, whatever its type or scope, under
   "Changements incompatibles";
2. any commit with the scope `ci`, `e2e`, `test` or `delivery` is dropped, even a `feat` or a `fix`;
3. `feat` goes under "Nouveautés", `fix` under "Corrections", `perf` under "Performances";
4. every other type (`chore`, `docs`, `refactor`, `test`, `build`, ...) and every commit that is
   not a Conventional Commit is dropped.

An entry is the commit subject without its `type(scope):` prefix, linked to its pull request when
it ends with `(#N)` (squash merges do). A release with nothing to list still gets its section,
holding `No user-facing changes.`

**Preview.** `pnpm release minor --dry-run` prints `would write to CHANGELOG.md:` and
`would write to changelog.json:` with what the bump commit would hold, and changes nothing. If an
entry is wrong or missing, fix the rule in `cliff.toml` (or the commit conventions), never the
generated files, then run it again. When the generation fails (git-cliff missing, bad
configuration), the release stops before creating the branch, with the reason; fix it and run the
same command again.

**GitHub Release body.** The `Release` workflow publishes the section of the released version as
the body of the GitHub Release (`.github/scripts/release-notes.sh X.Y.Z`), and fails when the
version has no section. That change of `release.yml` is applied by the maintainer (the workflows
are not edited by agents, see [Agent guardrails](../agent-guardrails.md); the diff is in
[the hand-off](../../specs/014-changelog-git-cliff/release-yml-handoff.md)); until then the
workflow still generates the notes itself.
