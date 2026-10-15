# Research: Continuous Delivery to Staging and Production

Each entry gives the decision, the reason and the alternatives considered. Entries are referenced
from the plan and the contracts as R1, R2, and so on.

## R1. Workflow layout and triggers (FR-005, FR-009)

**Decision**: two new workflows, plus the existing ones unchanged.

- `deliver-staging.yml` runs on `workflow_run` of `CI` (`types: [completed]`,
  `branches: [main]`) and does nothing unless the run's `conclusion` is `success` and its event is
  `push`. It checks out `workflow_run.head_sha`, never the moving tip of `main`.
- `release.yml` runs on `push` of tags matching `v*.*.*`.
- Both use `concurrency` with `cancel-in-progress: false` and one group per channel
  (`deliver-staging`, `release`), so deliveries queue instead of overlapping. A later commit still
  wins, because the Pi ignores a manifest older than what it has (R6).

**Rationale**: `workflow_run` delivers only commits whose CI is green (US1 scenario 5) without
duplicating the CI jobs. The tag is the release action chosen in the spec's clarification.

**Alternatives considered**: a `needs:` chain inside `ci.yml` would mix delivery into the PR
pipeline and run its secrets-bearing jobs next to pull request code paths; rejected. A
`workflow_dispatch` release was the other option the maintainer declined.

## R2. Which targets a staging delivery builds (FR-006)

**Decision**: a new path script `.github/scripts/delivery-targets.sh`, in the same style as
`app-changed.sh`, reads changed paths on standard input and prints `server=true|false` and
`app=true|false`:

| Paths                                                                                  | server | app |
| -------------------------------------------------------------------------------------- | ------ | --- |
| `apps/server/**`, `deploy/**` (except `deploy/fdroid/**`)                              | yes    | no  |
| `apps/mobile/**`, `deploy/fdroid/**`                                                   | no     | yes |
| `packages/**`, `package.json`, `yarn.lock`, `.yarnrc.yml`, `.yarn/**`, `flake.*`       | yes    | yes |
| `.github/workflows/deliver-staging.yml`, `.github/scripts/delivery-*`, `apps/delivery/**` | yes    | yes |
| anything else (docs, specs, `tests/**`, other workflows)                               | no     | no  |

The diff base is the commit **last delivered to staging for that target**, read from the staging
channel manifest (R5), not `HEAD^`. A delivery that failed, or a target skipped because its CI
was red, is caught up by the next one. With no manifest yet, both targets are built.

The script has a shell test, `.github/scripts/delivery-targets.test.sh`, which runs in CI through
a new root script `yarn test:scripts`.

**Rationale**: `app-changed.sh` stays the single documentation-only rule of the constitution;
this script refines it into targets. Diffing from the last delivered commit makes delivery
self-healing.

**Alternatives considered**: `dorny/paths-filter` adds a third-party action whose base is the
previous push, so it would lose a failed delivery; rejected. Diffing against `HEAD^` relies on
squash merges and has the same gap.

## R3. The server artifact (FR-012, FR-014)

**Decision**: CI builds one architecture-independent tarball per commit,
`server-<sha>.tar.gz`, on the Ubuntu runner:

`.github/scripts/pack-server.sh` does it, in CI and by hand (quickstart §10):

1. `yarn workspaces focus --production @mes-courses/server` after `yarn build`, so
   `node_modules` holds only runtime dependencies;
2. archive `apps/server/{dist,package.json}`, `packages/sync-core/{dist,package.json}`, the
   root `package.json` and `node_modules/`;
3. add `build-info.json` (`{ "version", "commit", "sequence" }`, see R7) next to
   `apps/server/package.json`.

The tarball does not contain Node. The manifest names the nixpkgs revision locked in
`flake.lock` (`nodes.nixpkgs.locked.rev`), and the Pi builds the runtime with
`nix build github:NixOS/nixpkgs/<rev>#nodejs_24` into the release folder (R8). nixpkgs is public,
so this needs no credential.

**Rationale**: the server has no native dependency. `node:sqlite` is built into Node, and
`fastify`, `nodemailer` and `@sentry/node` are pure JavaScript, so an x86_64 build runs on the
Pi's aarch64. This must stay true; the plan adds a check (R14). Building in CI means the Pi no
longer needs the repository, Yarn, a deploy key or a build step, and it runs exactly what CI
built.

**Alternatives considered**:

- `git pull` and building on the Pi (today's README): it needs a repository credential that can
  read every file, a toolchain on the Pi and minutes of CPU, and the result is not the CI's build.
- A container image (GHCR): it adds Docker or Podman to the Pi only to run one Node process that
  systemd already sandboxes.
- A Nix closure pushed to a binary cache: it needs a cache service with a credential, and
  cross-building aarch64 on x86_64 runners is slow.

## R4. Where the Pi fetches from, and with what credential (FR-014, FR-015, FR-016)

**Decision**: GitHub Releases on the repository, read over the REST API by the Pi with a
**fine-grained personal access token** limited to this one repository, with the single
permission *Contents: read*.

- Two rolling prereleases act as **channels**: `channel-staging` and `channel-production`. Each
  holds the signed manifest (R5) and the assets it points to. CI uploads the assets first and the
  manifest last (`gh release upload --clobber`), so a manifest never points at a missing asset.
- Each production release also gets a permanent release `vX.Y.Z` with the same assets, for
  history.
- The channels keep the assets of the current manifest and of the two before it. Older assets
  are deleted by the workflow.

The token lives on the Pi only, in `/etc/mes-courses/agent.env` (mode 600, root). GitHub holds
nothing that reaches the Pi. The token expires after at most one year. The agent reports a `401`
or `403` as an error (R10), and the quickstart documents the renewal.

**Rationale**: the Pi makes only outbound HTTPS requests. *Contents: read* is the narrowest scope
that can download release assets of a private repository. The Pi used to need a deploy key with
the same read access; this replaces it.

**Alternatives considered**:

- Actions artifacts: they expire, and downloading them needs *Actions: read* on top.
- A GitHub App installation token: it is narrower in theory, but the Pi would hold the App's
  private key, which can mint tokens. That is more power than a read-only token, and more parts
  to run.
- A self-hosted runner on the Pi: GitHub could then run arbitrary jobs on the Pi. That is
  exactly the access the spec forbids (FR-015).
- SSH from GitHub to the Pi: forbidden by the spec.

## R5. Proving where an artifact comes from (FR-017)

Decision record: [ADR-0008](../../docs/adr/0008-signed-delivery-manifests.md).

**Decision**: CI signs each channel manifest with an Ed25519 SSH key using
`ssh-keygen -Y sign -n mes-courses-deploy`. The Pi verifies the signature with
`ssh-keygen -Y verify` against an `allowed_signers` file holding the public key, then checks the
SHA-256 of every asset it downloads against the manifest. The private key is the GitHub secret
`DEPLOY_SIGNING_KEY`. The public key is committed in `deploy/allowed_signers` and installed on the
Pi.

**Rationale**: GitHub artifact attestations would be the native answer, but on private
repositories they require GitHub Enterprise Cloud. OpenSSH is already on the runner and on the
Pi, so signing adds no dependency. A signature proves the manifest comes from a holder of the CI
secret, and the manifest records the commit and the workflow run (R7).

**Accepted risk**: whoever can run a workflow with this repository's secrets can deliver code to
the Pi. That is the nature of continuous delivery. Delivered code runs only as the unprivileged,
sandboxed service user of its instance (R8). It never runs as the agent's root.

**Alternatives considered**: minisign or cosign add a tool on both sides for the same guarantee.
Checksums without a signature would trust whatever the token can download. GPG has a heavier key
management story.

## R6. The deployment agent on the Pi (FR-014, FR-018, FR-019, FR-020)

**Decision**: a new TypeScript workspace, `apps/delivery`, hexagonal like the others
(Principle VI). It holds the agent that runs on the Pi and the two commands the workflows run
(the manifest writer and the release gate, R15), which share the manifest's types and rules. It runs from a systemd timer (`mes-courses-agent.timer`, every 2 minutes,
`Persistent=true`). One run handles both instances, staging first, then production, one after
the other (spec edge case "release during a staging deployment").

For each instance, a run:

1. fetches the channel manifest, verifies its signature (R5) and parses it (contract
   [channel-manifest.md](contracts/channel-manifest.md));
2. compares it with the instance's local state ([data-model.md](data-model.md)): it ignores a
   manifest whose `sequence` is lower than or equal to the installed one, and a server commit
   already marked as failed;
3. **server**, if the manifest names a newer one: downloads and verifies the tarball, unpacks
   it into `releases/<sha>/`, builds the runtime (R3), records the deployment as in flight in
   the instance state, stops the service, copies the database (R9), switches the `current`
   symlink, and starts the service **on the instance's validation port**, not its public one
   (R9, FR-019a). It polls `http://127.0.0.1:<validation port>/v1/health` until
   `release.commit` equals the expected commit, for at most 60 seconds. Only then does it open
   the instance to the phones (R9). If the check times out or the service exits, it rolls back:
   stop, put the previous symlink and the database copy back, start on the public port, mark the
   commit failed. A deployment found in flight at the start of a pass (the agent or the Pi died
   during it) is rolled back the same way;
4. **F-Droid repository**, if the manifest names a newer one, and only once the server step
   succeeded or had nothing to do (FR-011): downloads and verifies the repository bundle, unpacks
      it beside the served folder and swaps the folder's symlink atomically;
5. reports the outcome (R10), writes the new state, and checks in with the monitor of R10
   (FR-020a).

Every download and every runtime build has its own time limit (5 minutes), so a slow step on
one instance fails, is reported as an error, and never holds the other instance longer than
that.

The agent depends on no package beyond `@sentry/node`, which is already in the lockfile. It uses
`fetch`, `node:crypto`, `node:child_process` (for `systemctl`, `ssh-keygen`, `tar` and `nix`) and
`node:fs`. Its domain is the decision logic: what to deploy, the state transitions and when to
roll back. Its ports are the channel source, the signature verifier, the service manager, the
health probe, the database snapshot, the release store, the state store and the reporter.

**Local deployment**: `main.js deploy-file` is the one documented exception to the
verification of R5 (FR-017). Only root on the Pi can run it, which is the access that could
replace the files anyway. It goes through the same install, validation and rollback path.

**Privileges**: the agent runs as root, because it stops and starts services and copies
databases owned by the instances' users. The unit sandboxes it with `ProtectSystem=strict`,
`ProtectHome=true`, `PrivateTmp=true`, `NoNewPrivileges=true` and `ReadWritePaths` limited to
`/opt/mes-courses`, `/var/lib/mes-courses`, `/var/lib/mes-courses-agent`, `/run/mes-courses`
and `/srv/fdroid`.
Before anything is unpacked or run, it handles only data whose signature it verified.

**Updating the agent**: by hand, with a documented command that installs the `delivery` bundle
of the latest production release ([quickstart.md](quickstart.md) §7). Each manifest carries
`minAgentVersion`. An agent older than that reports an error and deploys nothing on that channel.
Self-update is left out: a broken self-updated agent stops all deliveries silently, and the agent
rarely changes (Principle IV).

**Rationale**: the rollback and ordering logic is the riskiest part of the feature. As
TypeScript with Jest and test doubles, it follows Principles I to III like the rest of the
code. A shell script would be untested or need a new test framework.

**Alternatives considered**:

- A shell script with bats: a new tool, and rollback logic in shell is hard to test against
  doubles.
- Watchtower, or a container-based pull deployment: needs containers (R3).
- `systemd` path units watching a synced folder: something still has to fetch and verify.

## R7. Version identity: sequence, version code, build-info (FR-018, FR-024, FR-029)

Decision record: [ADR-0009](../../docs/adr/0009-version-identity-from-git.md).

**Decision**: the **sequence** of a commit is `git rev-list --count <sha>` on `main`. The
history is linear (squash merges only), so it increases with every commit and is the same for
everyone. It is used as:

- the manifest's `sequence`, which the Pi compares to ignore older deliveries;
- the Android `versionCode`, for both app identities, passed to the build as
  `ANDROID_VERSION_CODE` and read by `app.config.ts` (it fails the build when the variable is
  set but is not a positive integer).

A re-run of the same commit yields the same sequence, so it is a no-op on the Pi and for the
F-Droid client (spec edge case "delivered twice"). The checkout needs `fetch-depth: 0`.

The server writes `build-info.json` into the artifact (R3), and `/v1/health` reports
`release: { version, commit }` from it ([contracts/health-endpoint.md](contracts/health-endpoint.md)).
Without the file (development, tests), it reports `{ version: <package.json version>, commit: "dev" }`.
Staging has no release version, so it reports the app configuration's version suffixed with
`-staging.<sequence>`. The Sentry release of the server becomes
`mes-courses-server@<that version>`.

**Rationale**: one integer source, derived from git, with no counter to store.
`github.run_number` differs between the two workflows and resets if a workflow is renamed.

**Alternatives considered**: a timestamp version code overflows the 2,100,000,000 limit within
decades if seconds are used, and two commits in the same minute would collide if minutes are
used. EAS remote versions are gone with EAS Build for Android.

## R8. Two instances on one Pi (FR-001, FR-002)

Decision record: [ADR-0010](../../docs/adr/0010-two-instances-on-one-pi.md).

**Decision**: the unit becomes a template, `deploy/mes-courses@.service`, with one instance per
environment: `mes-courses@production` and `mes-courses@staging`.

| Item                      | Value (`%i` = `production` or `staging`)                                          |
| ------------------------- | --------------------------------------------------------------------------------- |
| User and group            | `mes-courses-%i` (two system users, so neither can read the other's database)     |
| Environment file          | `/etc/mes-courses/%i.env` (adds `MES_COURSES_PORT` and `MES_COURSES_ENV=%i`)       |
| Database                  | `StateDirectory=mes-courses/%i` → `/var/lib/mes-courses/%i/mes-courses.db`        |
| Code                      | `/opt/mes-courses/%i/current` → `/opt/mes-courses/%i/releases/<sha>`               |
| Node                      | `/opt/mes-courses/%i/current/runtime/bin/node` (the release's own runtime, R3)    |
| Port                      | 3000 for production, 3001 for staging (`127.0.0.1` only)                           |
| Public address            | `courses.<domain>` and `staging.courses.<domain>`, both through the existing Caddy |

The template's `ExecStartPre` lines are unchanged. The mail check applies to both instances.
Staging uses the same mail relay (spec assumption).

**Migrating production** is a one-time manual step ([quickstart.md](quickstart.md) §3). Stop
`mes-courses`, copy the database, create the users, move the database to
`/var/lib/mes-courses/production/`, move `/etc/mes-courses.env` to
`/etc/mes-courses/production.env`, install the agent, and let it deploy the current production
release. Last, disable the old unit, remove `/opt/mes-courses`'s git checkout and delete the
Pi's deploy key from GitHub.

**Releases kept**: the agent keeps the current release and the two before it, and deletes older
ones. When it deletes a release, its `runtime` out-link goes too, and the store path becomes
collectable by `nix-collect-garbage`.

**Rationale**: a template unit keeps one file for both instances. Separate users give the
isolation FR-002 asks for at no extra cost.

**Alternatives considered**: two hand-copied unit files would drift apart. Containers: R3.
`DynamicUser=` would change the database owner unpredictably across releases.

## R9. Database copy and rollback (FR-019)

Decision record: [ADR-0011](../../docs/adr/0011-stop-copy-validate-rollback.md).

**Decision**: the service is stopped before the copy. With the server stopped, SQLite's WAL is
checkpointed and the files are quiescent, so a plain copy of `mes-courses.db` (plus `-wal` and
`-shm` if present) to `/var/lib/mes-courses/%i/backups/<UTC timestamp>-<previous sha>.db` is
consistent. The agent keeps the 5 most recent copies per instance and the 3 most recent releases
(FR-032 requires at least the running release, the rollback target and the latest copy).

**Disk check** (FR-032). Before downloading, the agent compares the free space of the data
volume with the release size, the runtime build and the database size, plus a margin of 1 GiB.
Too little space fails the deployment before anything is stopped (a failed version, reported with
the free space found).

**Validation port** (FR-019a). Each instance has two ports on `127.0.0.1`: the public one that
Caddy proxies (3000 production, 3001 staging) and a validation one (3100 production, 3101
staging). The unit reads `EnvironmentFile=/etc/mes-courses/%i.env`, then
`EnvironmentFile=-/run/mes-courses/%i.env`. Before it starts the new version, the agent writes
`MES_COURSES_PORT=<validation port>` into the second file, so Caddy has nothing to reach and the
phones see an unreachable server. After a healthy answer on the validation port, the agent
deletes the file, restarts the service on the public port (migrations are already applied, so
this start is short) and checks the health there once more, for at most 60 seconds. No write
from a phone can reach a version that is then rolled back. `/run` is emptied at boot, so a Pi
that reboots during a deployment starts the service on the public port; the in-flight record of
R6 makes the next agent pass roll that deployment back.

A rollback stops the service, puts back the copy taken for this deployment, switches `current`
back and starts the service **on the public port**: the previous version already served the
phones. It checks its health with the same 60-second limit. If that also fails, the outcome is
`degraded` (FR-019b): the agent does not stop the service, leaves the previous version running
under `Restart=always`, and reports a critical error.

Expected downtime: stop, copy (the database is a few MB), start with migrations, validate and
restart on the public port take about 10 to 20 seconds on the Pi, within SC-005's 30 seconds;
quickstart §9 step 5 measures it. The phones see an unreachable server,
which is a normal state (Principle VII).

**Rationale**: migrations run at startup (003) and can be destructive (004's migration 2). A copy
taken while the server is stopped is the only safe rollback. Fix-forward stays the rule for the
app (001 FR-040).

**Alternatives considered**: `sqlite3 .backup` on a live database avoids a few seconds of
downtime, but adds the `sqlite3` CLI and still needs the stop for the code switch. A
blue-green switch in Caddy would need two writers on one SQLite file; rejected. Opening the
new version to the phones at once and restoring the copy on failure was the first design: it
loses the writes accepted during the 60-second window (clarification 2026-10-14). Switching
Caddy's upstream through its admin API instead of restarting would save one start, at the cost
of a second moving part; rejected (Principle IV).

## R10. Reporting deployment outcomes (FR-020)

**Decision**: the agent reports through Sentry, to the server's project
(`mes-courses-server`), with the instance's environment (`staging` or `production`) and the tag
`component: delivery-agent`:

- a **rollback**, a signature or checksum failure, a fetch failure that lasts more than an hour,
  a `401` or `403` from GitHub, and an agent too old for a manifest are reported as **errors**.
  The README's existing alert rules ("new issue", "regression", production only) email the
  maintainer for production. A third issue alert rule, on the tag `component:delivery-agent` in
  every environment, emails the maintainer about the agent's errors, so a failed staging
  deployment reaches them too (FR-020). The other staging errors are visible in Sentry without
  an email, like today's `preview` builds;
- a deployment that ends `degraded` (the previous version failed its check after a rollback,
  FR-019b) is reported as a **critical** error with the same tag;
- a **successful deployment** is a Sentry **info** event with a fixed fingerprint per
  environment. It creates one issue, which emails once and then stays grouped. It gives a
  timeline of deployments with their commits.

Everything is also written to the journal (`journalctl -u mes-courses-agent`). The agent's DSN is
the server's (`SENTRY_DSN` in `/etc/mes-courses/agent.env`). With no DSN, it reports to the
journal only, like the server (003 R15).

**Rationale**: the spec asks for the same channel as the server's errors. Sentry's alert rules
already route production to the maintainer.

**Agent liveness** (FR-020a). Each pass ends with a Sentry Cron check-in (`captureCheckIn`,
monitor slug `mes-courses-agent`), `ok` or `error`. The first check-in creates the monitor
(`monitorConfig`): an interval of 2 minutes and a margin that counts a pass as missed after 30
minutes. A missed or failed check-in opens a monitor issue, which the alert rule above (set on
monitor issues too) emails. One monitor covers both instances, since one pass handles both, and
it also fires when the Pi is down. With no DSN there is no check-in, like the rest of the
reporting.

**Alternatives considered**: a monitor per environment adds nothing, since one pass covers both.
Without a monitor, the silence of the agent would show only in `main.js status`. A GitHub commit
status written back by the Pi would need a write token on the Pi; rejected (FR-016).

## R11. Android build and signing in GitHub Actions (FR-021, FR-022, FR-025)

**Decision**: a reusable workflow, `.github/workflows/android-apk.yml` (`workflow_call`, with
input `variant: staging | production`), called by both delivery workflows:

1. the runner setup from `e2e.yml` (free disk, Java 17 Temurin, Nix and its cache, the Gradle
   cache);
2. `APP_VARIANT=<variant> EXPO_PUBLIC_APP_ENVIRONMENT=<variant> ANDROID_VERSION_CODE=<sequence>`,
   then `yarn expo prebuild --platform android --clean` and `./gradlew :app:assembleRelease`, all
   four ABIs. The release guard applies to production through `EXPO_PUBLIC_APP_ENVIRONMENT`
   (FR-013);
3. Sentry's Gradle step uploads source maps and native debug files during the build, given
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` as secrets. That is what EAS Build did,
   so reports stay symbolicated (FR-025);
4. `zipalign` and then `apksigner sign` from the SDK's build-tools, with the keystore decoded from
   `ANDROID_KEYSTORE_BASE64` into `$RUNNER_TEMP` and the passwords passed through environment
   variables (`--ks-pass env:…`), so they never appear in a log. Then `apksigner verify`;
5. the APK is passed to the F-Droid step (R12) as a job artifact with 1-day retention.

**One upload key** for both variants (the spec allows it, FR-022), generated once with `keytool`
(RSA 4096, validity 10,000 days). It is kept offline in the maintainer's password manager and as
the four GitHub secrets.

**Rationale**: re-signing after Gradle leaves `android/` exactly as the end-to-end build makes
it, with no config plugin for signing, so the build users get is still the one Detox tests (the
reason behind `android-no-minify.cjs`).

**Alternatives considered**:

- A config plugin that writes a `signingConfigs.release` block into Gradle: more generated code
  to maintain, and the same guarantee.
- `eas build --local` in Actions: it still needs EAS credentials and the EAS CLI's local build
  path, while the spec takes Android out of EAS.

## R12. The F-Droid repositories (FR-023, FR-024, FR-026)

**Decision**: CI generates each repository, and the Pi only serves static files.

- `fdroidserver` from nixpkgs (`nix shell nixpkgs#fdroidserver`) runs `fdroid update` in a work
  folder built from `deploy/fdroid/<variant>/`. The folder holds a committed `config.yml` with no
  secret (`keystorepass` and `keypass` read from environment variables with `{env: …}`), the
  app's metadata (`metadata/<applicationId>.yml`: name, summary, description, license) and the
  icon.
- One repository per environment, each with only the latest APK (`archive_older: 0`). Fix forward
  means no one installs an older version, and keeping one APK makes the repository stateless:
  each delivery generates it from scratch.
- The index is signed with a **repository key**, separate from the APK key, held in the secrets
  `FDROID_KEYSTORE_BASE64`, `FDROID_KEYSTORE_PASSWORD` and `FDROID_KEY_PASSWORD`, one key for
  both repositories. The F-Droid client pins the key's fingerprint when the repository is added
  from a link that carries it (`…/fdroid/repo?fingerprint=<sha256>`). The quickstart prints that
  link as a QR code with `qrencode`.
- The generated `repo/` folder is archived as `fdroid-<variant>-<sha>.tar.gz` and named in the
  channel manifest. The Pi serves it at `https://<instance domain>/fdroid/repo` with Caddy's
  `handle_path /fdroid/*` and `file_server`, from `/srv/fdroid/<environment>/current`.

**Clients**: F-Droid and Droid-ify both read index v2 with a pinned fingerprint. Droid-ify checks
for updates in the background, F-Droid on its schedule. Both notify the user.

**Migration from Google Play** ([quickstart.md](quickstart.md) §8): the Play build is signed by
Google Play App Signing and the new APK by the upload key. Android refuses an update across
signing keys, so the user must uninstall, and that deletes the local replica. The guide first
checks that Settings shows no pending changes (Principle VII's synchronization status component).
It then uninstalls, installs from the repository and signs in. All synchronized data comes back.

**Rationale**: generating in CI keeps the Pi free of Java and the Android tooling that
`fdroidserver` needs to sign the index. The Pi checks one signature (R5) instead of running a
signer.

**Alternatives considered**:

- Running `fdroid update` on the Pi: it needs a JDK and the repository key on the Pi.
- Serving the APK as a plain download: no update notifications, no fingerprint pinning.
- Obtainium pointed at GitHub Releases: the repository is private.

## R13. iOS is out of scope (was: iOS through EAS from GitHub Actions)

**Decision (2026-10-15)**: this feature delivers no iOS build. App Store Connect, EAS iOS builds,
ad hoc distribution and TestFlight all need the paid Apple Developer Program (99 USD a year), and
the maintainer declined it. There is no `EXPO_TOKEN`, no `ios` job and no `ascAppId`. FR-008,
FR-027 and FR-028 are dropped, and their numbers kept.

What stays from the former decision:

- The EAS profile `preview` becomes `staging`: `distribution: internal`, `environment: staging`,
  env `APP_VARIANT=staging` and `EXPO_PUBLIC_APP_ENVIRONMENT=staging`. It is no longer started by
  a workflow; the README's seeded measurement build uses it.
- The Sentry environment is called `staging`. The app's `sentry-error-reporter.ts` allows
  `production` and `staging`, which replaces `preview` (FR-004). The README's alert rules are
  unchanged: they filter on `production`.
- `submit.production.android` is removed. EAS no longer builds or submits Android.
- The `production` profile has no iOS submit section.

**Alternatives considered**: waiting for the program to be paid for later. If iOS comes back, a
new feature adds the `ios` jobs after `wait-production-health`, as the design of R15 left room
for.

## R14. App variants in `app.config.ts` (FR-003)

**Decision**: `APP_VARIANT` (`staging` or unset) selects:

| Item                           | Production                    | Staging                                     |
| ------------------------------ | ----------------------------- | ------------------------------------------- |
| Name                           | `Mes courses`                 | `Mes courses (test)`                        |
| Android package / iOS bundle   | `com.glimberger.mescourses`   | `com.glimberger.mescourses.staging`         |
| Icons                          | `assets/icon.png`, …          | `assets/staging/*.png` (same art, a badge)  |
| `EXPO_PUBLIC_DEFAULT_SERVER_URL` | `https://courses.<domain>`  | `https://staging.courses.<domain>`          |

The variant logic lives in `apps/mobile/build-config/app-variant.cjs`, unit-tested like
`release-guard.cjs`. The release guard also refuses `APP_VARIANT=staging` together with
`EXPO_PUBLIC_APP_ENVIRONMENT=production`, so a staging identity cannot be released.

`EXPO_PUBLIC_DEFAULT_SERVER_URL` pre-fills the server address of the sign-in screen when no
address was used before (`lastServerUrl` stays first). It is a build variable, set in the
delivery workflows and in the EAS environments. It is not a secret.

The server's architecture check: a new CI step, `.github/scripts/server-native-check.sh`, fails
the build when `node_modules` of the focused server install contains a `.node` file or a
`binding.gyp`, which would make the x86_64 artifact unusable on the Pi (R3).

**Alternatives considered**: Expo's `expo-dev-client` variants are for development builds. A
separate `app.staging.config.ts` would duplicate the plugin list.

## R15. Release gates (FR-010, FR-011, FR-012)

**Decision**: `release.yml` has a first job, `gate`, and nothing else starts unless it succeeds.
It checks:

1. the tag matches `^v(\d+)\.(\d+)\.(\d+)$`, and its version equals `version` in
   `apps/mobile/app.config.ts` at the tagged commit (read with
   `npx expo config --json --type public`);
2. the tagged commit is an ancestor of, or equal to, `origin/main`
   (`git merge-base --is-ancestor`);
3. `CI` and `E2E Android` both have a successful run on that exact commit
   (`gh run list --commit <sha> --workflow … --json conclusion`);
4. `Deliver staging` has a successful run on that commit, so nothing reaches production without
   passing staging (SC-008). That workflow runs after every green CI on `main`, and a run with no
   target to build still succeeds, because staging is then already up to date for that commit
   (R2);
5. the version is higher than the one in the current production manifest (semantic version
   comparison). An equal or lower version fails, because fixes go forward.

The gate is a use case of `apps/delivery` (R6), run with `tsx` and unit-tested. Its `gh` and
`git` calls go through ports with test doubles.

The order of the jobs after `gate` gives FR-011:

```text
gate ─┬─ server-artifact ─┐
      └─ android-apk ── fdroid-repo ─┴─ publish (vX.Y.Z release + channel-production manifest)
                                         └─ wait-production-health (≤ 20 min)
```

The Pi itself deploys the server before it swaps the F-Droid repository (R6, step 4).
`wait-production-health` polls the public `https://courses.<domain>/v1/health` until
`release.commit` is the tagged commit. That address is already public, and the request is
outbound from the runner.

**Rationale**: all the gates are checks of facts GitHub already has. No new state is introduced.

**Alternatives considered**: GitHub environments with required reviewers would add a second
manual approval after the tag. On a private repository they need a paid plan, so they are not
available here (constitution, "Quality Gates").

## R16. GitHub secrets (FR-022, FR-028)

The plan uses repository secrets: environments and environment secrets are not available on this
private repository's plan (R15).

| Secret                                             | Used by                | What it is                               |
| -------------------------------------------------- | ---------------------- | ---------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | `android-apk.yml` | The APK upload key (R11) |
| `FDROID_KEYSTORE_BASE64`, `FDROID_KEYSTORE_PASSWORD`, `FDROID_KEY_PASSWORD` | F-Droid step | The repository index key (R12) |
| `DEPLOY_SIGNING_KEY`                               | publish jobs           | The Ed25519 manifest signing key (R5)    |
| `SENTRY_AUTH_TOKEN`                                | `android-apk.yml`      | Uploads source maps (R11)                |

Plain repository **variables** (not secrets): `SENTRY_ORG`, `SENTRY_PROJECT`,
`EXPO_PUBLIC_SENTRY_DSN` (a DSN only allows sending, as the README already notes),
`PRODUCTION_SERVER_URL` and `STAGING_SERVER_URL`.

Secrets are passed only to the steps that need them (`env:` at step level), never to steps that
run `yarn install` scripts. Delivery workflows never run on `pull_request` events, so pull
request code cannot reach them.

**No secret grants access to the Pi** (FR-015, SC-006).

## R17. Checking the workflows themselves (Principle I and II, Quality Gates)

**Decision**: workflow YAML cannot be developed test-first, so the logic is taken out of the
YAML:

- tested code: the path rules (R2, a shell test), the manifest writer and the release gate (R15,
  Jest), the agent (R6, Jest), the app variants (R14, Jest) and the server's `/v1/health`
  `release` field (R7, Jest);
- `actionlint` (from nixpkgs, added to the dev shell) checks every workflow in the `lint` job of
  CI, so a typo in an expression fails the pull request;
- the end-to-end behavior of the workflows and the Pi is verified by the scenarios of
  [quickstart.md](quickstart.md), each run once on the real Pi before the feature's PR is
  merged, and recorded in its test plan. This is the same rule as the device checks of 001.

The workflows' YAML stays thin: each step calls a script or a workspace command.

## R18. Sizing and what is not built (Principle IV)

New dependencies: none in `package.json`. `fdroidserver`, `actionlint` and `qrencode` come from
nixpkgs. `fdroidserver` and `qrencode` are used only in a workflow step or a one-time setup
command, and `actionlint` joins the dev shell. No new runtime dependency.

New workspace: `apps/delivery` ([ADR-0006](../../docs/adr/0006-pull-based-continuous-delivery.md)).

Not built:

- agent self-update (R6);
- deploying several commits at once to compare them;
- canary or partial rollouts: there are a few users;
- automatic rollback of the app;
- a dashboard: the health endpoints, the channel releases and Sentry answer US5;
- iOS in any form (out of scope, R13);
- closing the Google Play listing (spec assumption).
