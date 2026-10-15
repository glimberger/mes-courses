---
description: 'Task list for continuous delivery to staging and production'
---

# Tasks: Continuous Delivery to Staging and Production

**Input**: Design documents from `specs/005-continuous-delivery/`

**Prerequisites**: plan.md, spec.md, research.md (R1 to R18), data-model.md, contracts/ (channel-manifest, health-endpoint, pi-layout, workflows), quickstart.md

**Tests**: required by the constitution (Principles I to III). Per the template rule, **a test is never a task of its own**: every task that adds behavior in code writes its failing Jest (or shell) test first, sees it fail, then implements. Workflow YAML and the systemd and Caddy files have no automated test (plan, Complexity Tracking); `actionlint` checks the YAML, and the quickstart scenarios check the rest (Phase 8).

**Organization**: grouped by user story. Paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5 from spec.md. Setup, Foundational and Polish have none.

## Path conventions

- Delivery agent and CI commands: `apps/delivery/src/{domain,application,adapters,composition}/` (hexagonal, Principle VI)
- Server: `apps/server/src/`. App: `apps/mobile/`. Pi files: `deploy/`. CI: `.github/workflows/`, `.github/scripts/`
- Shared in-memory doubles: `apps/delivery/src/application/testing/`

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: the new workspace and the tooling it needs.

- [X] T001 Create the `apps/delivery` workspace `@mes-courses/delivery` (version `1.0.0`, which is the agent version that `minAgentVersion` compares to): `package.json` with scripts `build` (`tsc -p tsconfig.json`), `test` (`jest --passWithNoTests`), `typecheck` (`tsc --noEmit`), the dependency `@sentry/node` `^11.5.0` and the dev dependencies of `apps/server/package.json` (`@types/jest`, `@types/node`, `jest`, `ts-jest`, `tsx`, `typescript`); `tsconfig.json` and `jest.config.js` copied from `apps/server`; empty `src/{domain,application/ports,application/testing,adapters,composition}/`. Run `yarn install` so `yarn.lock` lists the workspace. It must depend on neither `apps/server` nor `apps/mobile`.
- [X] T002 [P] Add the `apps/delivery` layer rules to `.dependency-cruiser.cjs`, mirroring the `apps/server` ones: `src/domain` imports only itself and no npm package or Node module; `src/application` imports only domain and application; nothing outside `src/composition` imports an adapter; adapters never import composition. `yarn test:architecture` must pass.
- [X] T003 [P] Add `actionlint` (nixpkgs) to the dev shell in `flake.nix`, and a step `nix develop --command actionlint` to the `lint` job of `.github/workflows/ci.yml`. Run it on the two existing workflows and fix whatever it reports.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: what staging delivery, release and rollback all rely on: the shared domain, the ports, the signature and the server's version report. This phase also delivers US5 scenario 1 (the server reports its release), because the agent's health probe cannot work without it.

**⚠️ CRITICAL**: no user story starts before this phase is done.

- [ ] T004 [P] Implement `apps/delivery/src/domain/semver.ts` (`parseSemver`, `compareSemver` over `X.Y.Z` and `X.Y.Z-staging.<n>`; a prerelease is lower than the same release) with `semver.test.ts` written first: ordering, equal versions, the `-staging.<n>` suffix, rejection of malformed input.
- [ ] T005 [P] Server `build-info.json` in `apps/server/src/composition/release.ts`: add `readBuildInfo(path?)` returning `{ version, commit, sequence? }` read from `apps/server/build-info.json` (two folders above `src/composition` and `dist/composition`, like `package.json`); without the file it returns `package.json`'s `version`, `commit: "dev"` and no `sequence` (data-model "BuildInfo"). `serverRelease()` becomes `mes-courses-server@<buildInfo.version>`. Extend `release.test.ts` first: with the file, without the file, malformed file falls back as without the file.
- [ ] T006 Add the `release: { version, commit }` field to the body of `GET /v1/health` only, in `apps/server/src/adapters/http/routes/health.ts` (build info injected through `apps/server/src/adapters/http/deps.ts` and `apps/server/src/composition/wiring.ts` and read once at startup from T005). Tests first in `apps/server/src/adapters/http/app.test.ts`, the cases of `contracts/health-endpoint.md`: with a build info the body's `release` equals it; without, `{ version: <package.json>, commit: "dev" }`; no other route's body has `release`; `release` has no key besides `version` and `commit`. (depends on T005)
- [ ] T007 [P] Implement `apps/delivery/src/domain/manifest.ts`: types `Environment`, `Sequence`, `ServerEntry`, `FdroidEntry`, `ChannelManifest` and `parseManifest(json)` exactly per data-model "ChannelManifest": `schema` must be `1`; every field present and typed; `commit` and `nixpkgsRev` are 40 lowercase hex characters, `sha256` is 64; `server.sequence ≤ sequence`; `fdroid.versionCode ≤ sequence`; `fdroid` is an entry or `null`; every `asset` matches `^[a-z0-9][a-z0-9.-]*\.tar\.gz$` (so no path separator can occur); `version` is `X.Y.Z` in production and `X.Y.Z-staging.<sequence>` in staging. Test first, one case per rule, including an unknown schema.
- [ ] T008 [P] Implement `apps/delivery/src/domain/instance-state.ts`: `InstanceState` (`manifestSequence`, `server`, `previousServer`, `failedCommits` (≤ 10, newest first), `fdroid`, `lastFetchSuccessAt`, `inFlight`) with an `emptyInstanceState()` for a missing file and pure update functions (`markFailed` trims to 10, `recordSuccess` moves `server` to `previousServer`, `setInFlight`, `clearInFlight`). Test first.
- [ ] T009 Define the application ports in `apps/delivery/src/application/ports/` (one file per port, types only): `ChannelSource`, `ChannelPublisher` (upload assets, signature and manifest in that order; prune), `Signer`, `SignatureVerifier`, `ReleaseStore`, `ServiceManager`, `PortOverride` (write and remove `/run/mes-courses/<env>.env`), `HealthProbe`, `DatabaseSnapshots`, `FdroidSite`, `StateStore`, `Reporter`, `Clock`, `RunHistory`, `GitFacts`, `CommandRunner`; and write the in-memory doubles of all of them in `apps/delivery/src/application/testing/` (scriptable failures and recorded calls). The doubles are exercised by the use-case tests of the stories, which is where they get their tests.
- [ ] T010 [P] Implement the `ssh-signature` adapter in `apps/delivery/src/adapters/ssh-signature/` (`Signer` with `ssh-keygen -Y sign -n mes-courses-deploy`, `SignatureVerifier` with `ssh-keygen -Y verify` against an `allowed_signers` file). Tests first against the real `ssh-keygen` in a temporary folder: a signed manifest verifies; a changed byte, a wrong key and a wrong namespace are all refused. The private key is passed as a file path in a temporary folder with mode 600, never in an argument or a log line.
- [ ] T011 [P] Implement the file `StateStore` adapter in `apps/delivery/src/adapters/filesystem/state-store.ts`: reads `/var/lib/mes-courses-agent/<env>.json` (a missing file gives `emptyInstanceState()`), writes atomically (temporary file, then rename). Tests first in a temporary folder: missing file, round trip, an interrupted write leaves the old file.

**Checkpoint**: foundation ready, stories can start.

---

## Phase 3: User Story 1 - Every merged change reaches staging on its own (Priority: P1) 🎯 MVP

**Goal**: a green merge to `main` deploys the staging server on the Pi, publishes a signed Android staging build in the staging F-Droid repository, and queues an iOS staging build on EAS.

**Independent Test**: merge a change that alters a label and a server response; within the delays of SC-001/SC-002 the staging `/v1/health` reports the commit and the staging F-Droid repository offers the new build (quickstart §4, server side).

**Scope note**: in this phase a failure after the service was stopped is only detected and reported as a critical error; the rollback itself is Phase 5 (US3). Nothing may be deployed to the real Pi before Phase 5 is done.

### CI side: which targets, which artifact

- [ ] T012 [P] [US1] Write `.github/scripts/delivery-targets.sh` (changed paths on standard input, prints `server=true|false` and `app=true|false`) with the table of research R2 and its test `.github/scripts/delivery-targets.test.sh` written first (one case per row: server-only paths and `deploy/**` except `deploy/fdroid/**`; app-only `apps/mobile/**` and `deploy/fdroid/**`; shared `packages/**`, `package.json`, `yarn.lock`, `.yarnrc.yml`, `.yarn/**`, `flake.*`; delivery files `.github/workflows/deliver-staging.yml`, `.github/scripts/delivery-*`, `apps/delivery/**` give both; docs, `specs/**`, `tests/**` and other workflows give neither). Add the root script `"test:scripts": "sh .github/scripts/delivery-targets.test.sh"` in `package.json` and a `yarn test:scripts` step to the `test` job of `.github/workflows/ci.yml`.
- [ ] T013 [P] [US1] Write `.github/scripts/server-native-check.sh <node_modules dir>` (fails when the directory holds a `.node` file or a `binding.gyp`, research R14) with `server-native-check.test.sh` written first against fixture folders (clean, with `x.node`, with `binding.gyp`), and call the test from `test:scripts` (T012). Then write `.github/scripts/pack-server.sh` (research R3): `yarn workspaces focus --production @mes-courses/server` after `yarn build`, runs the native check, writes `apps/server/build-info.json` (`version`, `commit`, `sequence` from its arguments), and archives `apps/server/{dist,package.json,build-info.json}`, `packages/sync-core/{dist,package.json}`, root `package.json` and `node_modules/` into `server-<sha>.tar.gz`. `pack-server.sh` is run for real by the workflow and by quickstart §10.
- [ ] T014 [US1] Implement the `write-manifest` use case in `apps/delivery/src/application/write-manifest.ts` and the GitHub `ChannelPublisher` adapter in `apps/delivery/src/adapters/github/channel-publisher.ts` (`gh release upload --clobber`, prune assets no longer referenced by the last three manifests). Rules from `contracts/channel-manifest.md`: start from the channel's current manifest (read through `ChannelSource`) and replace only the entries of the targets built; with no current manifest and no server built it fails; in production `version` is the tag's version and `server.version` equals it; staging versions are `X.Y.Z-staging.<sequence>`; carry the previous `server` entry over when only the app was built; `server.nixpkgsRev` comes from the lockfile argument; upload order is assets, then `manifest.json.sig`, then `manifest.json`. Tests first with the doubles of T009 (every rule, and the upload order recorded by the publisher double). Depends on T007, T009, T010.
- [ ] T015 [US1] Implement the GitHub `ChannelSource` adapter in `apps/delivery/src/adapters/github/channel-source.ts` (REST: `GET /repos/{owner}/{repo}/releases/tags/channel-<env>`, then `GET …/releases/assets/{id}` with `Accept: application/octet-stream`, bearer token, a 5-minute time limit per download, an error carrying the HTTP status so `401` and `403` can be told apart). Tests first against a local HTTP server: manifest and signature fetched, an asset streamed to a file, `401`, `404` (no channel yet), a hung response cut at the time limit. Used by `write-manifest` (T014) and the agent (T022). Depends on T009.
- [ ] T016 [US1] Implement the CI command line `apps/delivery/src/composition/ci.ts` with `write-manifest --env <env> --commit <sha> [--server <file>] [--fdroid <file>] [--version <v>]` wiring T010, T014, T015 and a `sequence` computed with `git rev-list --count <sha>` (R7); `release-gate` is added in Phase 4. Add the workspace script `"ci": "tsx src/composition/ci.ts"`. Test first the argument parsing and the failure messages (missing `--env`, unknown environment, a file that does not exist).

### App variants (FR-003, FR-004)

- [ ] T017 [P] [US1] Write `apps/mobile/build-config/app-variant.cjs` with `app-variant.test.ts` first: `appVariant(env)` returns the table of research R14 for `APP_VARIANT=staging` (name `Mes courses (test)`, package and bundle `com.glimberger.mescourses.staging`, icons under `assets/staging/`) and for unset (`Mes courses`, `com.glimberger.mescourses`, `assets/`); any other value throws; `androidVersionCode(env)` returns `undefined` when `ANDROID_VERSION_CODE` is unset and throws when it is set but not a positive integer. Then use it in `apps/mobile/app.config.ts` for `name`, `ios.bundleIdentifier`, `android.package`, `icon`, the adaptive icon, `android.versionCode`, and an `extra`/`EXPO_PUBLIC_DEFAULT_SERVER_URL` pass-through.
- [ ] T018 [P] [US1] Create the staging icons in `apps/mobile/assets/staging/` (`icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `splash-icon.png`): the same art as `apps/mobile/assets/` with a visible "test" badge (FR-003). Extend `apps/mobile/build-config/app-variant.test.ts` (T017) first with a check that every icon path the staging variant names exists on disk and has the same pixel size as its production counterpart.
- [ ] T019 [P] [US1] In `apps/mobile/src/adapters/error-reporting/sentry-error-reporter.ts` change the allowed environments from `production, preview` to `production, staging` (line 13 and the comment near line 119), updating `sentry-error-reporter.test.ts` first: `staging` is reported as `staging`, `preview` and unknown values fall back as an unknown environment does today (FR-004).
- [ ] T020 [P] [US1] Pre-fill the server address in `apps/mobile/src/adapters/ui/screens/SignInScreen.tsx` with `process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL` (scheme removed like `withoutScheme`) when `lastServerUrl` is `null`; `lastServerUrl` stays first (research R14). Test first in the screen's test file (add `SignInScreen.test.tsx` next to the stories if none exists, using the same render helpers as the other screen tests): last address wins, default is used when there is none, nothing is pre-filled when neither exists. No new visual component (Principle V).
- [ ] T021 [US1] Update `apps/mobile/eas.json`: rename profile `preview` to `staging` (`distribution: internal`, `environment: staging`, `autoIncrement: true`, `env` `APP_VARIANT=staging` and `EXPO_PUBLIC_APP_ENVIRONMENT=staging`) and delete `submit.production.android` (research R13). Grep for the remaining `preview` mentions in `apps/mobile` (including `README.md` and tests) and update them. Depends on T019.

### Android build and F-Droid repository

- [ ] T022 [P] [US1] Create `deploy/fdroid/staging/` and `deploy/fdroid/production/` (research R12): `config.yml` with no secret (`keystorepass`, `keypass` read from environment variables, `archive_older: 0`, repository name and `repo_url` of each environment), `metadata/<applicationId>.yml` with a French name, summary and description (Principle X) and the license, and the icon (the staging one marked as test). Add `.github/scripts/build-fdroid-repo.sh <variant> <apk> <sha>` that builds a work folder from `deploy/fdroid/<variant>/`, runs `fdroid update` (from `nix shell nixpkgs#fdroidserver`), and archives `repo/` as `fdroid-<variant>-<sha>.tar.gz`; add a shell test of its argument checks to `test:scripts`.
- [ ] T023 [P] [US1] Write the reusable workflow `.github/workflows/android-apk.yml` (`workflow_call`, input `variant: staging | production`, secrets per research R16) following research R11 and `contracts/workflows.md`: runner setup from `e2e.yml` (free disk, Temurin 17, Nix and its cache, Gradle cache), `APP_VARIANT`, `EXPO_PUBLIC_APP_ENVIRONMENT`, `EXPO_PUBLIC_DEFAULT_SERVER_URL` and `ANDROID_VERSION_CODE=<git rev-list --count>`, `expo prebuild --platform android --clean`, `./gradlew :app:assembleRelease`, Sentry Gradle upload (`SENTRY_AUTH_TOKEN` at step level), `zipalign`, `apksigner sign` with the keystore decoded into `$RUNNER_TEMP` and passwords read with `--ks-pass env:…`, `apksigner verify --print-certs` compared with the variable `ANDROID_CERT_SHA256`, job artifact `apk-<variant>` kept 1 day. No secret reaches a step that runs `yarn install`. `actionlint` must pass.

### The agent: forward path

- [ ] T024 [P] [US1] Implement the `ReleaseStore` adapter in `apps/delivery/src/adapters/filesystem/release-store.ts`: verify an asset's SHA-256 before unpacking; unpack with `tar --no-same-owner --no-same-permissions` into a fresh folder under `/opt/mes-courses/<env>/releases/<sha>/` and refuse any member whose path is absolute or contains `..`; switch `current` atomically (symlink created next to it, then renamed); keep the current release and the two before it and delete older ones with their `runtime` out-link. Tests first in temporary folders with real `tar`: good archive, wrong checksum (nothing unpacked), `../` member, absolute member, pruning, atomic switch. Depends on T009.
- [ ] T025 [P] [US1] Implement the `nix` runtime builder in `apps/delivery/src/adapters/nix/runtime.ts` (`nix build github:NixOS/nixpkgs/<rev>#nodejs_24 --out-link <release>/runtime`, 5-minute limit) through the `CommandRunner` port, and the `CommandRunner` adapter itself in `apps/delivery/src/adapters/process/command-runner.ts` (`node:child_process`, argument arrays only, never a shell string, time limit, captured output). Tests first: the nix argv, a command that exceeds its limit is killed and reported, an exit code is surfaced.
- [ ] T026 [P] [US1] Implement the `systemd` `ServiceManager` adapter in `apps/delivery/src/adapters/systemd/service-manager.ts` (`start`, `stop`, `restart`, `isActive` for `mes-courses@<env>` through `CommandRunner`) and the `PortOverride` adapter in `apps/delivery/src/adapters/filesystem/port-override.ts` (writes `MES_COURSES_PORT=<validation port>` to `/run/mes-courses/<env>.env`, removes it; validation ports 3100 production and 3101 staging, public ports 3000 and 3001 from the environment table of data-model). Tests first: argv of each systemctl call, file written and removed in a temporary folder.
- [ ] T027 [P] [US1] Implement the `http-health` `HealthProbe` adapter in `apps/delivery/src/adapters/http-health/health-probe.ts`: `GET http://127.0.0.1:<port>/v1/health`, returns `release.commit` or an unavailable result, polls once per second up to a given deadline, a per-request timeout of 2 seconds. Tests first against a local HTTP server: matching commit, other commit, refused connection, a slow response, a body without `release`.
- [ ] T028 [P] [US1] Implement the `sqlite-files` `DatabaseSnapshots` adapter in `apps/delivery/src/adapters/sqlite-files/database-snapshots.ts`: with the service stopped, copy `/var/lib/mes-courses/<env>/mes-courses.db` plus `-wal` and `-shm` when present to `backups/<UTC timestamp>-<previous sha>.db`, keeping the 5 most recent (data-model/R9). Restoring comes in Phase 5. Tests first in a temporary folder: copy with and without the side files, pruning to 5, the copy keeps the owner mode.
- [ ] T029 [P] [US1] Implement the `FdroidSite` adapter in `apps/delivery/src/adapters/filesystem/fdroid-site.ts`: verify the SHA-256, unpack into `/srv/fdroid/<env>/<sha>/`, swap `current` atomically, keep the current and the previous folder (contracts/pi-layout), refusing unsafe members like T024 (share the unpacking helper with T024). Tests first in temporary folders.
- [ ] T030 [P] [US1] Implement the console `Reporter` adapter in `apps/delivery/src/adapters/error-reporting/console-reporter.ts` (levels `info`, `error`, `critical`, written to standard error as one line each, no secret) and the real `Clock` in `apps/delivery/src/adapters/system/clock.ts`. Tests first for the line format.
- [ ] T031 [US1] Implement the `deploy-server` use case in `apps/delivery/src/application/deploy-server.ts` and the forward transitions of the Deployment in `apps/delivery/src/domain/deployment.ts` (data-model "Deployment"): `installing` (verify, unpack, build the runtime; any error here ends `failed` with nothing stopped, FR-019 last sentence) → `switching` (set `inFlight`, stop the service, copy the database, point `current` at the new release, write the validation-port override, start) → `validating` (health on the validation port reports the expected commit within 60 s) → `opening` (remove the override, restart on the public port, health on the public port reports the expected commit within 60 s) → `succeeded` (`previousServer ← server`, `server ← new`, `inFlight` cleared, state saved). FR-019a: nothing but the validation port is reachable before `validating` succeeds. A failure after the stop is returned as an unhandled outcome that the caller reports as critical; Phase 5 replaces it with a rollback. Tests first with the doubles: happy path with the exact order of calls, a commit already in `failedCommits` is skipped, a server not newer than `state.server` is skipped, a failure before the stop leaves the service untouched and marks the commit failed. Depends on T008, T009, T024 to T030.
- [ ] T032 [US1] Implement the `publish-fdroid` use case in `apps/delivery/src/application/publish-fdroid.ts`: when the manifest has a newer `fdroid` entry and the server now in service is healthy, download, verify and swap the repository, then store `fdroid` in the state; when the server step ended `failed` the swap is skipped; when the server entry is a commit in `failedCommits` it is ignored like an unchanged server (clarification 2026-10-14). Tests first with the doubles, including the app-only release whose carried-over server commit failed. Depends on T029, T031.
- [ ] T033 [US1] Implement `run-agent` in `apps/delivery/src/application/run-agent.ts`: one pass handles staging, then production, one after the other; per environment: read the manifest, verify the signature, `parseManifest`, check `environment` equals the channel, refuse when `minAgentVersion` is above the agent's own version, ignore when `sequence ≤ state.manifestSequence`, then `deploy-server` (T031) and `publish-fdroid` (T032); `manifestSequence` advances only when the whole manifest was handled without failure; `lastFetchSuccessAt` is set after a good fetch; a signature mismatch is reported only after it persisted for three passes (contract "Upload order"); each step has its own time limit so a slow staging cannot delay production beyond it. Tests first with the doubles: staging before production, a failing staging does not stop production, every refusal rule, the three-pass rule, an older manifest is a no-op, the same commit twice changes nothing. Depends on T031, T032.
- [ ] T034 [US1] Implement the agent command line `apps/delivery/src/composition/main.ts` with `run` and `run --only <env>` (wiring every adapter, reading `GITHUB_REPOSITORY`, `GITHUB_TOKEN` and `SENTRY_DSN` from the environment, exit code `0` unless a `degraded` outcome) and make `yarn build` emit `dist/composition/main.js`. Tests first on argument parsing and the exit code mapping; the wiring itself is covered by the use-case tests. Depends on T033.

### The workflow and the Pi files

- [ ] T035 [US1] Write `.github/workflows/deliver-staging.yml` per `contracts/workflows.md`: trigger `workflow_run` of `CI` on `main`; every job gated on `conclusion == 'success'` and `event == 'push'`; concurrency group `deliver-staging`, `cancel-in-progress: false`; checkout `workflow_run.head_sha` with `fetch-depth: 0`; jobs `plan` (reads the staging manifest, diff base is the commit last delivered per target, runs `delivery-targets.sh`, outputs `server`, `app`, `sequence`), `server-artifact` (`pack-server.sh`), `android-apk` (calls T023 with `variant: staging`), `fdroid-repo` (T022 script), `ios` (`npx eas-cli build --profile staging --platform ios --non-interactive --no-wait`, records the EAS URL, independent of `publish`), `publish` (`yarn workspace @mes-courses/delivery ci write-manifest …` with `DEPLOY_SIGNING_KEY` at step level). A docs-only commit runs the workflow, builds nothing and succeeds. `actionlint` must pass. Depends on T012, T013, T016, T021, T022, T023.
- [ ] T036 [P] [US1] Write the Pi files in `deploy/` per `contracts/pi-layout.md`: `mes-courses@.service` (replaces `mes-courses.service`, which is deleted: keeps the mail check, `Restart=always` and the hardening lines; adds `User=mes-courses-%i`, the two `EnvironmentFile` lines, `StateDirectory=mes-courses/%i`, `MES_COURSES_DB`, the release's own `runtime/bin/node`), `mes-courses.env.example` (adds `MES_COURSES_ENV` and `MES_COURSES_PORT`), `mes-courses-agent.service` (`Type=oneshot`, the sandbox of research R6, `EnvironmentFile=/etc/mes-courses/agent.env`), `mes-courses-agent.timer` (`OnBootSec=2min`, `OnUnitActiveSec=2min`, `Persistent=true`), `agent.env.example`, and `Caddyfile` with the two sites and `handle_path /fdroid/*`. `systemd-analyze verify` on the three units is run in the quickstart. Also read the server's port from `MES_COURSES_PORT` in `apps/server/src/composition/config.ts` if it does not already do so, test first in `config.test.ts`.
- [ ] T037 [US1] Commit `deploy/allowed_signers` with the public key generated in quickstart §2 step 3 (format `mes-courses-deploy <type> <key>`). This task needs the maintainer's key: when it does not exist yet, generate it with `ssh-keygen -t ed25519 -N '' -C mes-courses-deploy`, give the private half to the maintainer to store in the `DEPLOY_SIGNING_KEY` secret, and delete it from the disk. Depends on T010.

**Checkpoint**: US1 is functional end to end on a test setup (quickstart §3 to §4), without rollback or Sentry yet.

---

## Phase 4: User Story 2 - The maintainer releases to production (Priority: P1)

**Goal**: pushing a tag `vX.Y.Z` on a validated commit of `main` updates the production server, then publishes the Android build and submits the iOS build, all from that commit.

**Independent Test**: tag a validated commit; the gate passes, the production health reports the commit, then the production repository offers the version and `ios` queues the production build. Each gate rule is exercised with a scratch tag (quickstart §9).

- [ ] T038 [P] [US2] Implement `apps/delivery/src/domain/release-rules.ts`: `evaluateRelease(facts)` returns every failed rule, not only the first (data-model "Release"): tag matches `^v(\d+)\.(\d+)\.(\d+)$`; tag version equals the app version at that commit (the message names the expected version, US2 scenario 3); the commit is on `main`; `CI`, `E2E Android` and `Deliver staging` each have a `success` run on it; the tag version is strictly higher than the production manifest's (no manifest means any). Test first, one case per rule and one with several failures at once. Depends on T004.
- [ ] T039 [US2] Implement the `release-gate` use case in `apps/delivery/src/application/release-gate.ts` (gathers the facts through `GitFacts` and `RunHistory`, calls T038, prints each failed rule) and the adapters `apps/delivery/src/adapters/git/git-facts.ts` (`git merge-base --is-ancestor <sha> origin/main`, the app version through `npx expo config --json --type public` at the tagged commit) and `apps/delivery/src/adapters/github/run-history.ts` (`gh run list --commit <sha> --workflow … --json conclusion`), all through `CommandRunner`. Add the `release-gate --tag <vX.Y.Z> --commit <sha>` command to `apps/delivery/src/composition/ci.ts`. Tests first with the doubles (use case) and a fake `gh`/`git` argv check (adapters). Depends on T015, T016, T038.
- [ ] T040 [P] [US2] Add the `wait-health --url <url> --commit <sha> --timeout <seconds>` command to `apps/delivery/src/composition/ci.ts` (polls `<url>/v1/health` every 20 seconds until `release.commit` equals the commit, fails at the timeout) over a public HTTP `HealthProbe` variant. Test first with a local HTTP server and a fake clock. (`contracts/workflows.md` `wait-production-health`, research R15.)
- [ ] T041 [P] [US2] Add the rule to `apps/mobile/build-config/release-guard.cjs`: `APP_VARIANT=staging` together with `EXPO_PUBLIC_APP_ENVIRONMENT=production` stops the build and says so. Test first in `release-guard.test.ts`; the existing cases stay unchanged. (FR-013, research R14.)
- [ ] T042 [P] [US2] In `apps/mobile/eas.json` set `submit.production.ios.ascAppId` (the App Store Connect app id, a placeholder `TODO` is not allowed: ask the maintainer for the value, it is not a secret) and keep `build.production` as is. Verify `EXPO_PUBLIC_APP_ENVIRONMENT=production` is what the release guard reads. Depends on T021.
- [ ] T043 [P] [US2] Write `.github/scripts/pack-agent.sh <version>` that builds the delivery bundle `delivery-<version>.tar.gz` (`dist/`, production `node_modules`, `package.json`, and a `nixpkgs-rev` file read from `flake.lock`) for the agent update of quickstart §7; add a shell test of its argument checks to `test:scripts`.
- [ ] T044 [US2] Write `.github/workflows/release.yml` per `contracts/workflows.md`: trigger `push` of tags `v*.*.*`; concurrency group `release`, `cancel-in-progress: false`; jobs `gate` (T039), `server-artifact` (version = the tag's), `android-apk` (`variant: production`), `fdroid-repo` (production), `publish` (creates release `vX.Y.Z` with the assets, the APK for history and `delivery-<version>.tar.gz` from T043, then `write-manifest --env production --version …` updating `channel-production`), `wait-production-health` (T040, `PRODUCTION_SERVER_URL`, 20 minutes), `ios` (`eas build --profile production --platform ios --non-interactive --no-wait --auto-submit`, only after `wait-production-health`). A re-run of the failed jobs on the same run must complete a partial release without a new tag. `actionlint` must pass. Depends on T039, T040, T042, T043 and the jobs of T035 (reuse their steps, do not copy logic).

**Checkpoint**: US1 and US2 both work; a release needs one action (SC-003).

---

## Phase 5: User Story 3 - A failed server deployment does not take the server down (Priority: P1)

**Goal**: a version that does not start or does not pass its health check is replaced by the previous one, with the previous data, the maintainer is told, and the instance is never left stopped on purpose.

**Independent Test**: deliver a server build that exits at startup to staging (`deploy-file`, quickstart §10); the instance comes back on its previous version and database, the failure is reported, and production is untouched.

- [ ] T045 [US3] Extend the Deployment in `apps/delivery/src/domain/deployment.ts` and `apps/delivery/src/application/deploy-server.ts` with the failure branches of data-model "Deployment": from `validating` or `opening`, a timeout or an exited service goes to `rolling-back` (stop, restore the database copy taken for this deployment, point `current` back at `previousServer`, remove the port override, start on the public port, previous version healthy within 60 s) and ends `rolled-back` (`failedCommits += new`); when the restored version is unhealthy too the outcome is `degraded`: the service is not stopped, `Restart=always` keeps restarting it, `server` keeps the previous release, `failedCommits += new`. Add `restore` to the `DatabaseSnapshots` port, double and adapter (T028), with a test first in a temporary folder (the restored file equals the copy, including `-wal` and `-shm` handling). Tests first with the doubles for each outcome and the table "Outcomes and their effects" (state, report level, F-Droid step skipped). Replaces the "unhandled outcome" of T031. Depends on T031.
- [ ] T046 [US3] Recover from a deployment found in flight: at the start of each environment's pass in `apps/delivery/src/application/run-agent.ts`, a state with `inFlight` set starts directly at `rolling-back` for `inFlight.commit` with `inFlight.previousCommit` as the target (agent or Pi died during a deployment, including a reboot with `/run` emptied), and `inFlight` is cleared at every outcome. A commit in `failedCommits` is never retried until `forget-failure`. Tests first with the doubles: death at each state, the reboot case, no retry of a failed commit, a newer commit is deployed after a failure. (US3 scenario 3.) Depends on T045.
- [ ] T047 [P] [US3] Implement the Sentry `Reporter` in `apps/delivery/src/adapters/error-reporting/sentry-reporter.ts` per research R10 and add it to the wiring of `main.ts`: reports go to the server's project with the instance's environment and the tag `component: delivery-agent`; `rolled-back`, signature or checksum failures, a fetch failing for more than an hour, a `401` or `403`, and an agent too old for the manifest are **errors**; `degraded` is a **critical** error; `succeeded` is an **info** event with a fixed fingerprint per environment; the notice names the instance, the failed commit and the reason (FR-020). Each pass ends with `captureCheckIn` (monitor slug `mes-courses-agent`, `monitorConfig` interval 2 minutes, margin counting a pass as missed after 30 minutes), `ok`, or `error` when the pass was `degraded` (FR-020a). With no DSN it falls back to the console reporter and sends no check-in. Tests first with an injected fake Sentry client: levels, tag, fingerprint, the monitor config, the check-in status, no DSN. Never send from a test.
- [ ] T048 [P] [US3] Add the `forget-failure <env> <sha>` command (removes a commit from `failedCommits`, exit `1` when unknown) and `deploy-file <env> <server tarball>` (deploys a local artifact through the same install, validation and rollback path without a manifest or signature: the one documented exception to FR-017; exit `0` if `succeeded`, `1` otherwise) to `apps/delivery/src/composition/main.ts`, with their use cases in `apps/delivery/src/application/forget-failure.ts` and `deploy-file.ts`. Tests first with the doubles: the unknown commit, `deploy-file` reaching rollback with a failing health probe, `deploy-file` never reading the channel source or the signature verifier. Depends on T034, T045.
- [ ] T049 [US3] Document the alert in `deploy/agent.env.example` and in the README section written in T054: the issue alert rule on the tag `component:delivery-agent` in every environment, for new issues and monitor issues, emailing the maintainer (research R10, quickstart §3 step 6). It is configured in Sentry by the maintainer; this task writes the instructions only. Depends on T047.
- [ ] T058 [US3] Add the disk check to `apps/delivery/src/application/deploy-server.ts` (FR-032, research R9): before downloading, compare the free space (new `DiskSpace` port, double and adapter over `statfs`) with the release size, the runtime build and the database size plus 1 GiB; too little space ends the deployment as a failed version before anything is stopped, with the free space in the report. Tests first with the doubles: enough space, too little, the report text. Depends on T045.
- [ ] T059 [US3] Handle a missing or unreadable state file when `current` exists (FR-033, data-model "InstanceState"): in `apps/delivery/src/application/run-agent.ts` and the file `StateStore` (T011), move an unreadable file aside as `<env>.json.corrupt`, rebuild `server` from the release's `build-info.json` with an empty `failedCommits`, report an error, and neither stop nor redeploy the instance because of it. Tests first: missing file with a release, corrupt JSON, missing file without a release (a fresh instance). Depends on T011, T046.

**Checkpoint**: US1, US2 and US3 work together. The agent can now be installed on the real Pi.

---

## Phase 6: User Story 4 - Android users move from Google Play to the F-Droid repository (Priority: P2)

**Goal**: a Google Play user moves to the production F-Droid repository without losing synchronized data.

**Independent Test**: follow the guide on a phone with the Google Play install and synced data; after it, the same lists appear once signed in (quickstart §8).

- [ ] T050 [US4] Write the migration guide for users as a section "Passer de Google Play à F-Droid" in `README.md`'s Android part (Principle X: French text for users, English for the code and the rest of the README): check Settings shows no pending change then sync once more; uninstall the Google Play app (the local replica is erased, the data stays on the server); install F-Droid or Droid-ify; add the production repository from its link or QR code with the fingerprint; install "Mes courses"; sign in and check the lists, articles and categories. It states why uninstalling is required (the two installs are signed differently) and the 10-minute target (SC-007, FR-026). It also says: do not uninstall while synchronization cannot finish (unsynchronized changes are lost with the install); never add the repository address without the fingerprint; settings kept only on the device are lost. Add the maintainer's order of events (first production F-Droid release, then this guide sent to every Android user, then no more Google Play builds; `minAppVersion` stays at or below the last Google Play build until everyone has migrated).
- [ ] T051 [P] [US4] Add `.github/scripts/repo-address.sh <env>` that prints the repository address with its fingerprint (`https://<domain>/fdroid/repo?fingerprint=<SHA-256 of the repo key>`) and, with `qrencode -t ansiutf8`, the QR code (quickstart §6). Test first, in `test:scripts`, the address format from a fixture keystore fingerprint. Reference it from T050.

---

## Phase 7: User Story 5 - The maintainer sees what runs where (Priority: P3)

**Goal**: the maintainer can tell the version of each instance, the latest build of each repository and the outcome of each delivery. (US5 scenario 1 is T005 and T006.)

**Independent Test**: after a staging deployment and a release, compare the versions reported by each environment and the run summaries with the delivered commits.

- [ ] T052 [P] [US5] Write `.github/scripts/delivery-summary.sh <target> <outcome> [url]` appending a line `commit, environment, target, outcome (url)` to `$GITHUB_STEP_SUMMARY` (FR-030), with its shell test first in `test:scripts`. For `ios` the outcome recorded is "queued on EAS" with the build link. Call it from every job of `deliver-staging.yml` (T035) and `release.yml` (T044), plus a final `summary` job with `if: always()` that lists the outcome of every `needs` entry, including skipped and failed ones. `actionlint` must pass.
- [ ] T053 [P] [US5] Implement the `status` command (`apps/delivery/src/application/show-status.ts`, wired in `apps/delivery/src/composition/main.ts`): prints both `InstanceState`s (server and F-Droid commit, `failedCommits`, `lastFetchSuccessAt`) and the health of each instance, exit `0`. Test first with the doubles: fresh state, a failed commit, an unreachable instance.

---

## Phase 8: Polish & cross-cutting concerns

**Purpose**: documentation, ADRs and the checks on the real Pi.

- [ ] T054 Rewrite the README sections "On the Pi", "EAS builds and error tracking", "Releases" and "Sentry alerts" for the new workflow (FR-031): the one-time set-up (keys and secrets of quickstart §2, the Pi for two instances §3, DNS, the read-only token and its yearly renewal, device registration §5), staging delivery, the tag-based release, the rollback and `forget-failure`, the Google Play migration link (T050), and updating the agent (§7). Remove the git-pull deployment steps and the deploy key. Also write the loss and compromise procedures of the APK key (FR-022) and the F-Droid repository key (FR-023), each with its offline backup, and the production migration back-out of quickstart §3 (FR-034). Keep the manual checks and the iOS device suite as a precondition of a release. Also update the "Repository layout" section for `apps/delivery`, `deploy/` and the new workflows.
- [ ] T055 [P] Change [ADR-0006](../../docs/adr/0006-pull-based-continuous-delivery.md) and [ADR-0007](../../docs/adr/0007-android-fdroid-distribution.md) from *Proposed* to *Accepted* once the feature is merged-ready, and update `docs/adr/README.md`'s index.
- [ ] T056 Full local check: `yarn typecheck && yarn lint && yarn format:check && yarn test && yarn test:architecture && yarn test:scripts && yarn build`, `nix develop --command actionlint`, and `sh .github/scripts/server-smoke.sh`. Fix whatever fails; nothing is skipped or weakened (Principle I).
- [ ] T057 Run the Pi-side scenarios of [quickstart.md](quickstart.md) §3 (two instances, SC-006 checks), §4 steps 1 to 3 and 7 to 8 (staging delivery, targets), §9 (release, the four gate checks, the unavailability measure of SC-005, the partial release), §10 (rollback, degraded, SC-004) and §11 (race, agent silence, revoked token) on the real Pi, and record each result in the pull request's test plan (research R17). Phone-side steps (F-Droid client, iPhone installs) are not part of this task.

---

## Dependencies & execution order

### Phase dependencies

- **Setup (1)**: none. **Foundational (2)**: after Setup, blocks all stories.
- **US1 (3)**: after Foundational. **US2 (4)**: after Foundational; its workflow (T044) reuses the jobs of US1's (T035), so US2 is easiest after US1. **US3 (5)**: after US1's agent (T031 to T034).
- **US4 (6)** and **US5 (7)**: after Foundational. T052 needs the workflows of T035 and T044, so it is placed after them.
- **Polish (8)**: after the stories wanted. T057 needs a finished US1, US2 and US3 and nothing is deployed to the real Pi before US3 is done.

### Within a story

- Port, domain and test double before the use case, the use case before the adapters' wiring, the wiring before the workflow.
- Every code task starts with its failing test. Commit after each task.

### Key task dependencies

```text
T001 ─ T002, T003
T001 ─ T004, T007, T008 ─ T009 ─ T010, T011
T005 ─ T006
US1:  T012, T013 ─┐
      T014 (T007, T009, T010) ─ T016 (T014, T015) ─┐
      T015 ─────────────────────────────────────────┤
      T017─T021 (app) ─ T021 ─────────────────────────┼─ T035 (needs T022, T023)
      T022, T023 ───────────────────────────────────┘
      T024─T030 ─ T031 ─ T032 ─ T033 ─ T034
US2:  T038 ─ T039 ─ T044 (T040, T042, T043)
US3:  T045 ─ T046 ; T047, T048 (T034, T045), T049 (T047)
US5:  T052 (T035, T044), T053
```

### Parallel opportunities

- Setup: T002 and T003 together once T001 is done.
- Foundational: T004, T005, T007, T008 together; then T010 and T011 together.
- US1: T012, T013, T017 to T020, T022, T023 are independent files and can run together. T024 to T030 are seven independent adapters and can run together.
- US2: T038, T040, T041, T042, T043 together.
- US3: T047 and T048 together once T045 is done.
- US4 and US5 can proceed in parallel with US3 by another person.

### Parallel example: US1 adapters

```text
Task: "Implement the ReleaseStore adapter in apps/delivery/src/adapters/filesystem/release-store.ts"        (T024)
Task: "Implement the nix runtime builder and CommandRunner in apps/delivery/src/adapters/nix, process"      (T025)
Task: "Implement the systemd ServiceManager and PortOverride adapters"                                      (T026)
Task: "Implement the http-health HealthProbe adapter"                                                       (T027)
Task: "Implement the sqlite-files DatabaseSnapshots adapter"                                                (T028)
Task: "Implement the FdroidSite adapter"                                                                    (T029)
Task: "Implement the console Reporter and Clock adapters"                                                   (T030)
```

---

## Implementation strategy

### MVP first (User Story 1 only)

1. Phase 1 and Phase 2.
2. Phase 3 (US1). **Stop and validate on a scratch Pi setup**: staging health reports the commit, the staging repository serves the build. Do not point it at the real production data: US1 has no rollback.
3. Phase 5 (US3) before installing the agent on the real Pi, because an unattended deployment without rollback can leave production down (constitution VII). US1 plus US3 is the real minimum for a delivery that can touch the Pi.

### Incremental delivery

1. Setup, Foundational → US1 → US3 → deploy the agent on the Pi (quickstart §3) with staging only.
2. US2 → first release through a tag.
3. US4 (guide) before the first Android release that leaves Google Play.
4. US5 anytime after US1/US2.

### Notes

- [P] tasks touch different files and have no dependency on an unfinished task.
- The [Story] label maps each task to its user story. Foundational tasks T005 and T006 deliver US5 scenario 1 by design.
- Avoid: logic in workflow YAML (R17), a shell string with an interpolated value (use argument arrays), a secret in an argument or a log line, and any change that weakens or skips a test.
