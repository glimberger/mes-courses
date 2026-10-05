# Implementation Plan: Server Synchronization

**Branch**: `feat/003-server-sync` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-server-sync/spec.md`

## Summary

Make the home Raspberry Pi server the source of truth (constitution v2.0.0, Principle VII), while
every device keeps working offline on its local copy. This closes the deviation recorded in 001's
and 002's plans.

Technically:

- **Node.js server on the Pi** (Fastify, `node:sqlite`) behind Caddy, which serves a Let's
  Encrypt certificate for the maintainer's domain. The Freebox forwards ports 80 and 443 to the
  Pi.
- **Shared rules**: a pure `sync-core` package, shared by app and server, holds the hybrid
  logical clock, the field-level last-writer-wins rule, the same-name merge and the protocol
  types.
- **App side**: a local outbox fills in the same transaction as every command of 001 and 002.
  Changes that can still be undone are held back. A single `POST /v1/sync` round trip pushes and
  pulls, scheduled in the foreground.
- **UI**: a shared sync status bar, plus Settings screens to pair with single-use codes and to
  list, rename and revoke devices.

The decisions are in [research.md](research.md), including the three the clarification left to
the plan: clocks (R6), deletion records (R7) and the first pairing code (R11).

## Technical Context

**Language/Version**:

- App: TypeScript 5.x (strict), Expo SDK 57, unchanged from 001.
- Server: TypeScript 5.x (strict) on Node.js 24 LTS (arm64 on the Pi).
- `sync-core`: TypeScript with no runtime dependency.

**Primary Dependencies**:

- App: 001's dependencies plus `expo-secure-store`.
- Server: `fastify` 5 and `@sentry/node`.
- Pi: Caddy 2 (system package).

The justification is in [research.md](research.md#new-dependencies-principle-iv).

**Storage**:

- App: the existing SQLite replica gains migration 2 (outbox, sync state, `created_hlc`, and no
  more unique category position).
- Server: SQLite via `node:sqlite`, in WAL mode ([data-model.md](data-model.md)).
- The device credential is kept in the operating system's secure storage.

**Testing**:

- Jest 30 in each workspace.
- Server routes through Fastify `inject`.
- The app's HTTP adapter runs against an in-process server on `127.0.0.1`.
- Two-device scenario tests run on fakes plus one in-process server.
- Fake `Clock` and `IdGenerator` everywhere (Principle III).
- dependency-cruiser covers app, server and `sync-core`.

**Target Platform**: Android and iOS phones and tablets; the server on a Raspberry Pi 4 or 5 with
Raspberry Pi OS Lite 64-bit, behind a Freebox with a full-stack IPv4 address.

**Project Type**: mobile app plus web service, as npm workspaces in one repository: the root
(app), `server/` and `packages/sync-core/`.

**Performance Goals**:

- A change reaches another open device in under 10 s (SC-001), through 5 s foreground polling.
- A full restore takes under 30 s for hundreds of rows (SC-005).
- Local actions keep 001's timings (SC-004): sync never runs on the critical path.

**Constraints**:

- Offline first: no UI action waits for the network (FR-002, FR-003).
- Every change is recorded in the same transaction as the data (FR-005).
- Each change is applied exactly once (FR-006).
- TLS is always verified, with no insecure fallback (FR-019).
- No list content in error reports, on either side (FR-022, FR-022a).
- French text only in the UI adapter; the server returns error codes.

**Scale/Scope**:

- One user, a few devices, hundreds of rows.
- 7 server routes and 1 CLI command.
- 9 new app use cases, 13 existing ones changed.
- 2 new screens, 3 dialogs and 1 shared status component.

No NEEDS CLARIFICATION remains: the server stack is the maintainer's choice (Node), the network
setup follows from the Freebox ([research.md](research.md) R4), and every other unknown is
resolved in research.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies | Status |
|---|---|---|---|
| I | Test-First (non-negotiable) | `sync-core`, the server and the app changes are driven test-first. Every merge rule, route and use case starts with a failing test. The server is new code under the same rule. | ✅ |
| II | Tests as executable specification | Every scenario of US1–US4 maps to a named test ("003 US2-5 …"). Two-device scenarios run the US2 rules end to end on fakes and an in-process server. | ✅ |
| III | Fast, deterministic, isolated | Fake `Clock` and `IdGenerator`. The server is tested through `inject`, with in-memory SQLite. The app's HTTP adapter tests use `127.0.0.1` only, never the Pi. The order-independence of merges is tested over every order of a fixed set of changes, not random ones. | ✅ |
| IV | Simplicity (YAGNI) | New dependencies: `fastify`, `@sentry/node`, `expo-secure-store` and Caddy, each justified in research. Rejected: CRDT libraries, WebSockets, background sync, tombstone purging, containers and IPv6 for now. | ✅ |
| V | Single design system | `SyncStatusBar`, Settings, ConnectServer and the dialogs use Paper and the shared module only, with tokens and no inline styles. | ✅ |
| VI | Hexagonal architecture | App: new driven ports (`ChangeRecorder`, `SyncStateRepository`, `PulledRowsApplier`, `Clock`, `SyncServer`, `CredentialStore`), with use cases in the application layer and adapters for HTTP, SQLite and secure storage. Server: the same domain → application → adapters split. `sync-core` is pure and the only shared import allowed in both domains. dependency-cruiser enforces all of this. | ✅ |
| VII | Remote source of truth, offline first | The server is authoritative (R5). Every read and write goes to the local replica first. Sync goes through the `SyncServer` port. Offline changes wait in a durable outbox. Reconciliation is deterministic and tested in `sync-core` and on the server. Tests cover no network, an unreachable server, connectivity loss and recovery. **This closes the deviation recorded by 001 and 002.** | ✅ |
| VIII | Observability | The app reports sync failures (three in a row) and untrusted servers, but never being offline. The server reports through `@sentry/node` behind its own `ErrorReporter` port, with the same privacy rules (R15). | ✅ |
| IX | Explicit screen states | `SyncStatusBar` gives every data screen its synchronization state, from one store slice. Settings' device list has loading, error, offline and success states, each tested. | ✅ |
| X | French interface, no i18n | French text only in the app's UI adapter. The server returns error codes. The one French string outside the app is the Pi command's output, read by the maintainer. | ✅ |
| QG | Quality gates and CI | CI runs typecheck, lint, tests and the architecture test across the workspaces, plus the app build. There is no deployment from CI, and no test reaches the Pi. | ✅ |
| WF | Development workflow | The spec states offline behavior, synchronization and reconciliation (US2, FR-009 to FR-015). | ✅ |

**Gate result before research**: no violation.

**Second check, after Phase 1 design**: still no violation. Points checked:

- 001's domain imports `normalizedName` from `sync-core`, a pure package with no dependency.
  That stays within Principle VI ("no dependency on any framework, library with side effects")
  and is enforced by an explicit allow rule.
- Every one of 001's and 002's command use cases gains a `changes.record` call in its existing
  transaction ([contracts/app-ports.md](contracts/app-ports.md)). This changes how existing code
  is written, so 001's and 002's plans need a migration note (see Implementation notes).
- The `present` flag exists only on the server and in payloads. Locally, items are still deleted
  rows, so 002 R4's reasons against soft deletes still hold for the device.
- The device credential never touches SQLite, logs or error reports.

## Project Structure

### Documentation (this feature)

```text
specs/003-server-sync/
├── plan.md              # This file
├── research.md          # Phase 0: stack, network, sync model, clocks, pairing, deployment
├── data-model.md        # Phase 1: shared types, device additions, server schema
├── quickstart.md        # Phase 1: automated checks, Pi and Freebox setup, two-device scenarios
├── contracts/
│   ├── sync-api.md      # HTTP API of the server + Pi command
│   ├── app-ports.md     # New ports and use cases in the app, changes to 001/002 use cases
│   └── ui-screens.md    # SyncStatusBar, Settings, ConnectServer, dialogs, French text
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
package.json                         # + "workspaces": ["server", "packages/*"]
packages/
└── sync-core/
    ├── package.json                 # @mes-courses/sync-core, no dependencies
    └── src/
        ├── hlc.ts                   # Hlc, compare, next, receive, clamp (R6)
        ├── merge.ts                 # mergeField, pickSurvivor, compareCategories (R5, R8)
        ├── name.ts                  # normalizedName (moved from 001's src/domain/name.ts)
        ├── protocol.ts              # Change, ServerRow, request/response types (contracts/sync-api.md)
        └── *.test.ts
server/
├── package.json                     # fastify, @sentry/node; scripts dev, build, start, pairing-code
├── src/
│   ├── domain/                      # applyChange, merge by name, pairing rules, authorization
│   ├── application/
│   │   ├── ports/                   # ServerStore (UnitOfWork + repos), Clock, IdGenerator, ErrorReporter, Random
│   │   ├── use-cases/               # sync, claimPairingCode, createPairingCode, listDevices, renameDevice, revokeDevice
│   │   └── testing/                 # in-memory fakes, contract suites
│   ├── adapters/
│   │   ├── http/                    # Fastify app, routes, JSON schemas, auth hook, error mapping
│   │   ├── sqlite/                  # node:sqlite store, migrations
│   │   ├── crypto/                  # credential and code generation, SHA-256
│   │   └── error-reporting/         # Sentry and console reporters
│   ├── composition/                 # main.ts (server), pairing-code.ts (CLI)
│   └── testing/                     # startTestServer() for the app's adapter tests
deploy/
├── Caddyfile                        # {$MES_COURSES_DOMAIN} → reverse_proxy 127.0.0.1:3000
├── mes-courses.service              # systemd unit
└── mes-courses.env.example          # SENTRY_DSN=, NODE_ENV=production (no values)
src/                                 # the app (001 layout), additions:
├── domain/name.ts                   # re-exports normalizedName from sync-core
├── application/
│   ├── ports/                       # + change-recorder, sync-state, pulled-rows, clock, sync-server, credential-store
│   ├── use-cases/                   # + connect-to-server, synchronize, get-sync-info, create-pairing-code,
│   │                                #   list-devices, rename-device, revoke-device, disconnect, release-held-changes
│   └── testing/                     # + fakes and contract suites for the new ports
├── adapters/
│   ├── sqlite/                      # + migration 2, change-recorder, sync-state, pulled-rows applier
│   ├── sync-http/                   # SyncServer over fetch + tests against server/src/testing
│   ├── secure-store/                # CredentialStore over expo-secure-store
│   ├── clock/                       # Date.now()
│   └── ui/
│       ├── state/                   # + sync slice, SyncScheduler (AppState, debounce, 5 s poll, backoff)
│       ├── components/              # + SyncStatusBar
│       └── screens/                 # + Settings, ConnectServer, PairingCodeDialog, device dialogs
└── composition/                     # wires the sync adapters and starts the scheduler
.dependency-cruiser.cjs              # + server/ rules, sync-core purity, sync-core allowed in both domains
.github/workflows/ci.yml             # jobs run across workspaces
```

**Structure Decision**: one repository with npm workspaces. The app stays at the root (001's
layout), the server lives in `server/`, and the rules both must share live in
`packages/sync-core/`. The server follows the same hexagonal layout as the app, so one set of
architecture rules and habits covers both. Deployment files are in `deploy/` and are used by hand
on the Pi, never by CI.

## Implementation notes for `/speckit-tasks`

- **Order**:
  1. `sync-core` (HLC, merge, name, protocol), test-first;
  2. server domain → server application → server SQLite and HTTP adapters → the CLI →
     `startTestServer`;
  3. app migration 2 and the new ports and fakes;
  4. `changes.record` in each 001/002 use case, one task per use case, with each existing test
     kept green and one new test for its recorded change;
  5. `synchronize` and `connectToServer`;
  6. the HTTP adapter against `startTestServer`;
  7. the sync slice and scheduler;
  8. the UI;
  9. the two-device scenario tests;
  10. deployment files and the quickstart on the Pi.
- **Story mapping**: US1 (P1) is the server, the outbox and the single-device sync. US2 (P1) is
  the merge rules and the two-device scenarios. US3 (P2) is the status bar. US4 (P2) is pairing,
  the device list and revocation. Pairing is needed before any real sync, so its server routes
  and `connectToServer` are foundational; the device management UI belongs to US4.
- **Migration note for 001 and 002** (constitution Governance): when this feature is
  implemented, every command use case records its changes. If 001 and 002 are already
  implemented, the tasks add `changes.record` to each with its tests kept green. Each of their
  plans gets one line under Complexity Tracking saying the Principle VII deviation is closed by
  003.
- **Prerequisite on the network side**: a full-stack IPv4 address on the Freebox, the domain's
  A record, and ports 80 and 443 forwarded. These are the maintainer's actions, listed in
  quickstart §3. They are not tasks for an agent, but the deployment task checks them with
  `curl` from mobile data.

## Complexity Tracking

No constitution violation to justify.
