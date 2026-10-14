# Implementation Plan: Continuous Delivery to Staging and Production

**Branch**: `feat/005-continuous-delivery` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-continuous-delivery/spec.md`

## Summary

Every green CI run on `main` delivers to **staging**, and a `vX.Y.Z` tag delivers to
**production**. Both cover the sync server and the app on both platforms.

Technically:

- **Built in GitHub Actions, published as signed channels** (research R1, R3, R5,
  [ADR-0006](../../docs/adr/0006-pull-based-continuous-delivery.md)). CI builds an
  architecture-independent server tarball and the Android repository. It publishes them on a
  rolling GitHub release per environment (`channel-staging`, `channel-production`), next to a
  manifest signed with an SSH key.
- **Pulled by the Pi** (R4, R6, R8, R9, R10). A new workspace, `apps/delivery`, holds a
  deployment agent run by a systemd timer. It fetches the manifests with a read-only,
  single-repository token, verifies them, and deploys each instance of a new template unit
  (`mes-courses@staging`, `mes-courses@production`). It copies the database with the service
  stopped, checks health and rolls back on failure. It reports to Sentry. No inbound port, and
  no credential to the Pi in GitHub.
- **Android out of EAS and Google Play** (R7, R11, R12,
  [ADR-0007](../../docs/adr/0007-android-fdroid-distribution.md)). Gradle builds the APK in
  Actions, `apksigner` signs it with an upload key held in secrets, and `fdroidserver`
  generates one signed F-Droid repository per environment. The Pi's Caddy serves them under
  `/fdroid/repo`. `versionCode` is the commit's position on `main`.
- **iOS stays on EAS** (R13). GitHub Actions starts the builds with an Expo robot token. The
  `preview` profile becomes `staging` (ad hoc, internal). Production builds go to TestFlight with
  `--auto-submit`, but only once the production server reports the release commit.
- **Staging app variant** (R14). `APP_VARIANT=staging` gives a separate identity,
  "Mes courses (test)", with its own icon, installable next to production. Both variants
  pre-fill their server address.
- **Release gate** (R15). The tag must match `app.config.ts`, be on `main`, have green CI,
  E2E Android and staging delivery runs, and be newer than production.
- **Traceability** (R7). `/v1/health` gains `release: { version, commit }`, and each run's
  summary lists every target's outcome.

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 24 from the flake, as for the server, for
the `apps/delivery` workspace. POSIX `sh` for the CI path scripts. GitHub Actions YAML.

**Primary Dependencies**:

- `apps/delivery`: `@sentry/node` (already in the lockfile, used by the server). Everything else
  comes from Node's standard library (`fetch`, `node:crypto`, `node:child_process`, `node:fs`).
  For development: Jest, ts-jest and tsx, as the server uses them.
- CI tools from nixpkgs, not npm: `fdroidserver` (the F-Droid step), `actionlint` (added to the
  dev shell) and `qrencode` (a one-time setup command). Android build-tools (`zipalign`,
  `apksigner`) come from the runner's SDK. `eas-cli` is run with `npx`, as today.
- App and server: no new dependency.

The justification is in [research.md R18](research.md#r18-sizing-and-what-is-not-built-principle-iv).

**Storage**: no database change. The agent keeps one JSON state file per environment
(`/var/lib/mes-courses-agent/<env>.json`, [data-model.md](data-model.md#instancestate-agent)). It
keeps 5 database copies and 3 server releases per instance on the Pi.

**Testing**:

- Jest for `apps/delivery`: the domain (manifest validation, deployment decisions, the state
  transitions of the rollback, semver), the use cases with in-memory doubles of every port, and
  the adapters against real technology in temporary folders (`ssh-keygen` sign and verify, `tar`
  unpacking and refusing unsafe paths, the file state store, the HTTP channel source against a
  local HTTP server).
- Jest for the server's `/v1/health` `release` field and `build-info.json`, and for
  `app-variant.cjs` and the release guard's new rule.
- A shell test for `delivery-targets.sh` (`yarn test:scripts`).
- `actionlint` for the workflows.
- The scenarios of [quickstart.md](quickstart.md), run on the real Pi before merging (R17).

**Target Platform**: GitHub-hosted `ubuntu-latest` runners. The Raspberry Pi (Raspberry Pi OS Lite
64-bit, aarch64, systemd, Nix, Caddy). EAS Build for iOS. Android phones with F-Droid or
Droid-ify.

**Project Type**: delivery tooling for the existing monorepo (mobile app and sync server), plus a
small agent application on the Pi.

**Performance Goals**: staging server live within 15 minutes of green CI (SC-001), Android staging
build offered within 30 minutes (SC-002), rollback within 5 minutes (SC-004), production downtime
under 30 seconds per deployment (SC-005).

**Constraints**: no inbound port beyond the existing 80 and 443, and no GitHub credential that
reaches the Pi (FR-014, FR-015). The Pi's token is read-only (FR-016). The repository is private
on a plan with no environments and no branch protection (R15, R16). Runner minutes are limited
(R13: EAS runs with `--no-wait`). The EAS Free plan has a monthly iOS build allowance (R13).

**Scale/Scope**: one Pi, two instances, about ten users, a few merges a week. Five workflows (two
new, one reusable new, two changed), one new workspace, and about ten files in `deploy/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Status |
| --------- | ---------------------- | ------ |
| I. Test-First | Every behavior in code is driven by a failing test first: the agent, the manifest writer, the release gate, the path rules, the `/v1/health` `release` field, the app variants and the release guard rule. The workflow YAML holds no logic (R17). | Pass, see Complexity Tracking for the YAML itself |
| II. Tests as specification | US3 maps to agent use-case tests (each Deployment transition). US2 scenarios 3 to 5 map to release-gate tests. US1 scenarios 3 and 4 map to path-rule tests. US5 scenario 1 maps to the server health test. US1 scenario 6 maps to the app variant tests. The rest (live workflows, the Pi, the phones) maps to quickstart scenarios. | Pass, see Complexity Tracking |
| III. Fast, deterministic tests | The agent's clock, HTTP, process and file system are ports. Domain and use-case tests use in-memory doubles. Adapter tests use temporary folders and a local HTTP server, never GitHub or the Pi. | Pass |
| IV. Simplicity | No new npm dependency. One new workspace, justified (R6). No self-update, no canary, no dashboard, no app rollback (R18). | Pass |
| V. Single design system | No new screen. The staging icon is an asset, and the server address pre-fill uses the existing text field. | Pass |
| VI. Hexagonal | `apps/delivery` has domain, application and adapters layers. Its domain imports neither Node nor Sentry. The architecture test gains its rules. The server change stays in its composition (`release.ts`) and HTTP adapter. | Pass |
| VII. Offline first | The app's behavior is unchanged. A server restart during deployment is an unreachable server, a normal state. Staging and production data never mix (spec "Offline Behavior"). | Pass |
| VIII. Observability | The agent reports through a port (Sentry adapter, console without a DSN). Rollbacks and failures are errors, and deployments are info events (R10). The Android build in Actions still uploads source maps (R11). The app reports the `staging` environment instead of `preview`. No test sends to Sentry. | Pass |
| IX. Explicit screen states | No screen state changes. | Pass |
| X. French interface | The new user-facing text is the app name "Mes courses (test)" and the F-Droid metadata (summary and description in French). The agent and the workflows have no user-facing text. | Pass |
| XI. Monorepo | `apps/delivery` is a workspace with its own `package.json`, under the shared toolchain and CI. It depends on neither `apps/server` nor `apps/mobile`, and they do not depend on it. The server reads `build-info.json` with its own type. | Pass |
| Quality Gates | CI keeps running on every PR and push. The new delivery workflows never run on `pull_request`. The `E2E Android` gate before merging is unchanged, and it also becomes a gate before production (R15). The iOS device suite stays a manual precondition of releases (README). | Pass |
| Development Workflow | Two ADRs (0006, 0007). The README's "Releases" and "On the Pi" sections are rewritten (FR-031). | Pass |

**Post-design re-check (after Phase 1)**: the contracts add no dependency and no layer violation.
`deploy-file` (contracts/pi-layout.md) deploys without a signature. It is root-only and uses the
same deployment path, so it adds no untested route. Still **Pass**.

## Architecture Decisions

- Creates [ADR-0006](../../docs/adr/0006-pull-based-continuous-delivery.md): continuous delivery
  is built in GitHub Actions and pulled by the Pi (Proposed).
- Creates [ADR-0007](../../docs/adr/0007-android-fdroid-distribution.md): Android leaves EAS and
  Google Play for a self-hosted F-Droid repository (Proposed). It narrows
  [ADR-0001](../../docs/adr/0001-react-native-expo.md)'s use of EAS Build to iOS.
- Relies on [ADR-0002](../../docs/adr/0002-yarn-workspaces-monorepo.md) (the new workspace) and
  [ADR-0004](../../docs/adr/0004-detox-end-to-end-tests.md) (the device suite becomes a release
  gate).

## Project Structure

### Documentation (this feature)

```text
specs/005-continuous-delivery/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── channel-manifest.md
│   ├── health-endpoint.md
│   ├── pi-layout.md
│   └── workflows.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
apps/delivery/                          # NEW workspace @mes-courses/delivery (research R6)
├── package.json                        # version = agent version (minAgentVersion compares to it)
├── src/
│   ├── domain/
│   │   ├── manifest.ts                 # ChannelManifest, parseManifest
│   │   ├── semver.ts                   # compare, used by the gate and minAgentVersion
│   │   ├── deployment.ts               # Deployment transitions and outcomes
│   │   ├── instance-state.ts           # InstanceState and its updates
│   │   └── release-rules.ts            # the gate's rules over gathered facts
│   ├── application/
│   │   ├── ports/                      # ChannelSource, SignatureVerifier, ReleaseStore, ServiceManager,
│   │   │                               # HealthProbe, DatabaseSnapshots, FdroidSite, StateStore, Reporter,
│   │   │                               # Clock, RunHistory, GitFacts
│   │   ├── run-agent.ts                # one pass: staging then production
│   │   ├── deploy-server.ts            # the Deployment state machine against ports
│   │   ├── publish-fdroid.ts
│   │   ├── write-manifest.ts           # CI side (contracts/channel-manifest.md)
│   │   ├── release-gate.ts             # CI side (research R15)
│   │   └── testing/                    # in-memory doubles of every port
│   ├── adapters/
│   │   ├── github/                     # channel source (REST + token), run history (gh)
│   │   ├── ssh-signature/              # ssh-keygen -Y verify / sign
│   │   ├── filesystem/                 # release store (tar, symlinks), state store, F-Droid site
│   │   ├── systemd/                    # systemctl
│   │   ├── nix/                        # runtime out-link
│   │   ├── http-health/
│   │   ├── sqlite-files/               # database copy and restore (files, service stopped)
│   │   ├── git/
│   │   └── error-reporting/            # Sentry and console reporters
│   └── composition/
│       ├── main.ts                     # Pi CLI: run, status, forget-failure, deploy-file
│       └── ci.ts                       # CI CLI: write-manifest, release-gate
└── jest.config.js, tsconfig.json

apps/server/src/
├── composition/release.ts              # + build-info.json (version, commit)
└── adapters/http/routes/health.ts      # + release field

apps/mobile/
├── app.config.ts                       # + APP_VARIANT, ANDROID_VERSION_CODE
├── build-config/app-variant.cjs        # NEW, tested
├── build-config/release-guard.cjs      # + refuses a staging identity in production
├── assets/staging/                     # NEW staging icons
├── eas.json                            # preview → staging; Android submit removed; iOS ascAppId
└── src/…/sentry-error-reporter.ts      # allowed environments: production, staging
    src/…/SignInScreen.tsx              # pre-fills EXPO_PUBLIC_DEFAULT_SERVER_URL when no last address

deploy/
├── mes-courses@.service                # replaces mes-courses.service
├── mes-courses-agent.service, mes-courses-agent.timer, agent.env.example, allowed_signers
├── mes-courses.env.example             # + MES_COURSES_ENV, MES_COURSES_PORT
├── Caddyfile                           # two sites, /fdroid/*
└── fdroid/{staging,production}/        # config.yml (no secret), metadata, icon

.github/
├── workflows/deliver-staging.yml       # NEW
├── workflows/release.yml               # NEW
├── workflows/android-apk.yml           # NEW, reusable
├── workflows/ci.yml                    # + actionlint, + yarn test:scripts
└── scripts/
    ├── delivery-targets.sh             # NEW (R2) + delivery-targets.test.sh
    ├── pack-server.sh                  # NEW (R3)
    └── server-native-check.sh          # NEW (R14)

.dependency-cruiser.cjs                 # + apps/delivery layer rules
flake.nix                               # + actionlint in the dev shell
package.json                            # + test:scripts
README.md                               # Releases, On the Pi, EAS builds rewritten (FR-031)
```

**Structure Decision**: the monorepo of ADR-0002, with one more application workspace,
`apps/delivery`, which is hexagonal like `apps/server`. It holds the logic the Pi and the
workflows run. The workflows and `deploy/` only wire that logic to GitHub and systemd.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Workflow YAML and the systemd and Caddy files are not driven by failing tests (Principle I), and some acceptance scenarios (live delivery, phone install, Pi rollback) are verified by quickstart runs instead of automated tests (Principle II). | GitHub Actions, EAS, the F-Droid client and the Pi's systemd cannot run in the fast suite. Testing them would mean a fake GitHub and a fake Pi, which would test the fakes. | All logic is pulled out of these files into tested code (R17). `actionlint` checks the YAML in CI. Each quickstart scenario runs once on the real Pi before merging and is recorded in the PR's test plan, the same rule the constitution already applies to the device checks. |
| The agent runs as root (sandboxed), not as an unprivileged user. | It stops and starts both instances' services and copies databases owned by two different users. | A sudoers or polkit setup per command adds configuration that is just as privileged and harder to review. The sandbox (R6) limits writes to four folders, and nothing unsigned is unpacked or run. |
