# Implementation Plan: Multi-User Accounts

**Branch**: `feat/004-multi-user` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-multi-user/spec.md`

## Summary

Open the server of [003](../003-server-sync/plan.md) to a few invited people, each with private
data, signing in with an email and a password instead of a pairing code.

Technically:

- **One database, several accounts** (research R1, [ADR-0005](../../docs/adr/0005-accounts-and-authentication.md)):
  an `account` table is the root; the data tables and the devices carry `account_id` with cascade
  deletion. The server's repositories are bound to one account when a transaction opens, so 003's
  merge and pull logic runs unchanged, one account at a time.
- **Sign-in creates a device** (R5): the device credential of 003 is kept; a password replaces the
  pairing code as the way to get one. Temporary passwords, a reset flow that never locks the owner
  out, scrypt hashing and attempt limits (R3, R4, R6).
- **Email through a port** (R8): SMTP submission with `nodemailer`, French text in the mail adapter;
  a test double everywhere else.
- **The maintainer's data is attached by migration** (R2): migration 2 creates a setup account that
  owns every existing row and device; a `create-admin` command names it. The maintainer's devices
  keep syncing with no sign-in.
- **App**: sign-in, choose-password and forgot-password screens replace pairing; Settings gains the
  account section; administrators get an Accounts screen. A device holds one account's data at a
  time, enforced by one tested rule (R11).

The decisions are in [research.md](research.md), including the ones the spec left to the plan: the
mail service (R8), the password rules and attempt limits (R3, R6) and the French wording
([contracts/ui-screens.md](contracts/ui-screens.md)). The security review of the spec
([checklists/security.md](checklists/security.md)) is answered item by item in research R18. It
added: NFC passwords and `SameAsCurrent` (R3), the resend/reset distinction and the accepted risk of
mailed passwords (R4), unbounded offline lifetime and TLS-only password routes (R5), pruning of
attempt records (R6), the named remnants of a deletion (R16), a `set-password` command for recovery
without mail (R17), an "expired invitation" flag in Accounts (R12), and the count of lost changes
in the signed-out notice (R11). Four points need the spec's wording, not the plan (R18).

## Technical Context

**Language/Version**: unchanged from 003: TypeScript 5.x (strict), Expo SDK 57 for the app, Node.js
24 LTS for the server, `sync-core` with no runtime dependency.

**Primary Dependencies**:

- Server: 003's, plus `nodemailer` (SMTP submission) and, for development only, `smtp-server` (a
  real SMTP server in the mail adapter's tests). Passwords use `node:crypto`.
- App: none new.
- `sync-core`: none (it gains `normalizeEmail` and `validateNewPassword`, pure).

The justification is in [research.md](research.md#r14-sizing-and-what-is-not-built-principle-iv).

**Storage**:

- Server: SQLite via `node:sqlite`, migration 2 ([data-model.md](data-model.md)): `account`,
  `ended_credential`, `auth_attempt`; `account_id` on the data tables and devices; the pairing
  tables dropped.
- App: migration 3 adds `sync_state.account_id`. Passwords are never stored on the device; the device
  credential stays in secure storage.

**Testing**:

- Jest 30 in each workspace; server routes through Fastify `inject`; fake `Clock`, `IdGenerator`,
  `Mailer`, `PasswordHasher` (cheap parameters) everywhere (Principle III).
- The contract suites of the server's repositories run against the in-memory fake and SQLite, and
  gain the two-account isolation tests.
- The mail adapter runs against an in-process SMTP server. The app's HTTP adapters run against an
  in-process server on `127.0.0.1`, from `tests/sync/` (Principle XI, 003 R1).
- `tests/sync/` gains the scenarios: two accounts and a device each; sign-in on a device holding
  another account's copy; suspension, reactivation, revocation and deletion seen by a device; the
  maintainer's migrated device syncing with its old credential.
- Storybook stories for every new screen state ([contracts/ui-screens.md](contracts/ui-screens.md)),
  rendered by 001's story test; the changed Detox journey `sync-unreachable`.
- dependency-cruiser keeps covering app, server and `sync-core`.

**Target Platform**: unchanged: Android and iOS phones and tablets; the server on a Raspberry Pi
behind a Freebox.

**Project Type**: mobile app plus web service, in the Yarn workspaces monorepo: `apps/mobile/`,
`apps/server/`, `packages/sync-core/`, `tests/e2e/`, `tests/sync/`.

**Performance Goals**:

- A sign-in (scrypt included) answers in under 1 s on the Pi; a sync stays under 003's timings
  because sign-in hashing runs on the thread pool (R3).
- The administrator invites in under 30 s (SC-002); an invited person is in their empty lists within
  3 minutes of the email (SC-001); a forgotten password is recovered in under 3 minutes (SC-006).

**Constraints**:

- Offline first: a signed-in device never needs the network to open or edit (FR-007). Only signing
  in, resetting, and the account actions need the server.
- No data crosses accounts, enforced by repositories, keys and tests (FR-009, SC-003).
- No password, temporary password or email address in any log or report (FR-018, SC-008).
- No email is sent by a test; a mail failure never breaks the server (FR-020).
- French text only in the UI adapter and the mail adapter; the server's routes return codes.

**Scale/Scope**:

- About 10 accounts, a few devices each, hundreds of rows per account.
- 12 new server routes (3 authentication, 3 account, 6 administration) and 2
  removed; 2 new CLI commands (`create-admin`, `set-password`), 1 removed.
- About 14 server use cases and 12 app use cases; 3 new screens (SignIn, ChoosePassword,
  Accounts) and about 12 dialogs.

No NEEDS CLARIFICATION remains: every unknown is resolved in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | How this plan complies | Status |
|---|---|---|---|
| I | Test-First (non-negotiable) | Every rule, route and use case starts with a failing test: password rules, attempt limits, isolation, each admin refusal, the local copy rule. The migration is tested on a database filled by the previous version. | ✅ |
| II | Tests as executable specification | Every scenario of US1–US6 maps to a named test ("004 US4-2 …"), including the clarified reset behavior (US4-2, US4-5). | ✅ |
| III | Fast, deterministic, isolated | Fake clock, ids, mailer and a cheap password hasher. Attempt windows are tested with the fake clock. The SMTP and HTTP adapter tests use `127.0.0.1` only. | ✅ |
| IV | Simplicity (YAGNI) | Two new server dependencies (`nodemailer`, and `smtp-server` for tests only), each justified in research. Rejected: sessions, tokens, a ticket table, mail queues, jobs for expiry, a second administrator, email change, per-account database files. | ✅ |
| V | Single design system | All new screens and dialogs use Paper and the shared module only, with design tokens and no inline styles. Password fields reuse the shared `NameField` pattern through a shared `PasswordField`, added to the module in this feature. | ✅ |
| VI | Hexagonal architecture | New driven ports: `AccountRepository`, `EndedCredentialRepository`, `AuthAttemptRepository`, `PasswordHasher` and `Mailer` on the server; `AccountServer`, `AdminServer` and `LocalDataEraser` in the app. The account binding is inside the store adapter, so the domain and use cases never see an `account_id`. dependency-cruiser enforces the layers. | ✅ |
| VII | Remote source of truth, offline first | The server stays authoritative, reconciled per account by 003's rules. A signed-in device works offline for as long as it needs; suspension, deletion and revocation apply at the next contact (SC-004). Sign-in requires the server by nature. Offline tests cover a device with a suspended or deleted account, and sign-out while offline. | ✅ |
| VIII | Observability | Mail failures and unexpected route errors are reported with the opaque `accountId` as the only identifier; an adapter-side scrubber removes address-like strings; wrong passwords and limits are not errors. SC-008 has its own test. | ✅ |
| IX | Explicit screen states | The Accounts list, the Settings account section and every new screen have loading, empty, error and success states, each with a story and a test; the sync bar gains the three new connection states. | ✅ |
| X | French interface, no i18n | French text is in the app's UI adapter, and the emails' French is kept in the server's mail adapter, which is a message-delivering adapter (Principle X, v2.6.0): the domain and application layers return typed results and the mail port carries no text. No i18n layer. | ✅ (v2.6.0) |
| XI | Single repository (monorepo) | No new workspace. The email and password rules live in `sync-core`, pure, so the app and the server agree; the HTTP adapters are tested from `tests/sync/`; the app and the server still never import each other. | ✅ |
| QG | Quality gates and CI | CI jobs unchanged, covering the new code. The Android device suite runs on the branch's last commit before merge (not documentation-only). The iOS device suite runs on the Mac before merge, after the Android one, because the app version in `apps/mobile/app.json` changes (app configuration, T036); no native dependency is added. | ✅ |
| WF | Development workflow | Offline behavior, synchronization and reconciliation are in the spec (the edge cases and FR-007, FR-009). | ✅ |

**Note on Principle X**: since v2.6.0 the principle lets a driven adapter that delivers messages
outside the interface hold the French text it sends. The server's `adapters/mail/` holds the two
French emails (invitation, new temporary password) under that clause; its port carries typed data
only.

**Gate result before research**: no violation.

**Second check, after Phase 1 design**: still no violation. Points checked:

- `ServerStore` now has two entry points, `run` (directory only) and `runForAccount` (directory plus
  bound data). Both are ports in the application layer; the SQLite and in-memory adapters implement
  them, and one contract suite checks both implementations (research R1).
- Removing pairing changes 003's behavior and tests (`claimPairingCode`, `createPairingCode`,
  `connectToServer`, their routes and stories). They are deleted with their tests in the same task as
  the sign-in that replaces them, because a deleted behavior's tests change when the behavior itself
  changes (Principle I). 003's plan gets a note under Complexity Tracking saying pairing was replaced
  by 004.
- The emails carry the temporary password in clear: that is what the spec asks for (FR-003). The
  password is single-purpose, expires in 7 days and must be replaced at first use (FR-004, FR-005).
- `ended_credential` keeps a hash after deletion (research R7). SC-007 is read as "none of the
  account's data"; the test names this table as the only exception.
- The security review's additions (research R16–R18) stay inside the same layers: `set-password`
  is a composition-layer command like `create-admin` (Principle IV: it reuses its prompt and
  checks, and is the only recovery when the relay is down); `SameAsCurrent` and NFC live in
  `sync-core`'s pure rule and the hasher adapter; the new French strings are in the UI adapter
  (Principle X); each new screen state has its story (Principle IX). No new dependency.
- No sign-in is exercised by a Detox journey (it would need a trusted TLS certificate on the
  emulator, 003 FR-019); `tests/sync/` and the quickstart cover it.

## Architecture Decisions

- [ADR-0005: Accounts live in one database, bound per request; passwords use scrypt](../../docs/adr/0005-accounts-and-authentication.md)
  (Proposed, created by this plan).
- Relies on [ADR-0002](../../docs/adr/0002-yarn-workspaces-monorepo.md) (monorepo) and on 003's
  decisions for the sync protocol ([003 research](../003-server-sync/research.md) R5, R9, R11 for the
  device credential).

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-user/
├── plan.md              # This file
├── research.md          # Phase 0: tenancy, setup account, passwords, reset, limits, mail, app rules
├── data-model.md        # Phase 1: shared types, server migration 2, app migration 3, states
├── quickstart.md        # Phase 1: automated checks, Pi upgrade, hands-on scenarios
├── contracts/
│   ├── auth-api.md      # HTTP API changes: sign-in, account, administration, errors, the CLI
│   ├── app-ports.md     # New ports and use cases on the server and in the app
│   └── ui-screens.md    # Screens, dialogs, French text, emails, stories and journeys
├── checklists/
│   ├── requirements.md
│   └── security.md      # reviewer-owned; answered in research R18
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
docs/adr/0005-accounts-and-authentication.md       # new
.dependency-cruiser.cjs                            # + rules for adapters/mail and the new ports (same layers)
apps/
├── server/
│   ├── package.json                               # + nodemailer, smtp-server (dev); scripts create-admin, create-admin:dev, set-password; − pairing-code
│   └── src/
│       ├── domain/
│       │   ├── account.ts                         # derived state, canLoseAdministrator, temporary password expiry
│       │   ├── attempts.ts                        # windows and limits (replaces pairing.ts rate-limit parts)
│       │   └── pairing.ts                         # removed; cleanDeviceName moves to device.ts
│       ├── application/
│       │   ├── ports/                             # + account-repository, ended-credential, auth-attempt, password-hasher, mailer;
│       │   │                                      #   store.ts: run / runForAccount; − pairing-code, pairing-failure
│       │   ├── use-cases/                         # + sign-in, choose-password, request-password-reset, get-account,
│       │   │                                      #   change-password, delete-own-account, invite-account, list-accounts,
│       │   │                                      #   suspend-account, reactivate-account, delete-account, resend-credentials,
│       │   │                                      #   authenticate-device; − claim-pairing-code, create-pairing-code
│       │   └── testing/                           # in-memory store bound per account, FakeMailer, FakePasswordHasher,
│       │                                          #   isolation contract suite
│       ├── adapters/
│       │   ├── http/routes/                       # + auth.ts, account.ts, admin.ts; − pairing.ts; auth hook resolves (device, account)
│       │   ├── sqlite/                            # migration 2, account-bound repositories, account/ended/attempt repositories
│       │   ├── crypto/                            # scrypt PasswordHasher, temporary password generator
│       │   ├── mail/                              # SMTP mailer, ConsoleMailer, French templates (+ tests)
│       │   └── error-reporting/                   # + address scrubber
│       └── composition/                           # + create-admin.ts, set-password.ts (shared prompt); wiring reads the mail variables; − pairing-code.ts
├── mobile/
│   └── src/
│       ├── application/
│       │   ├── ports/                             # + account-server, admin-server, local-data-eraser; sync-state gains accountId
│       │   └── use-cases/                         # + sign-in, choose-initial-password, request-password-reset, get-account-settings,
│       │   │                                      #   change-password, sign-out, delete-my-account, acknowledge-signed-out,
│       │   │                                      #   list-accounts, invite-account, suspend-account, reactivate-account,
│       │   │                                      #   resend-credentials, delete-account-as-admin; synchronize changed;
│       │   │                                      #   − connect-to-server, create-pairing-code, disconnect
│       ├── adapters/
│       │   ├── error-reporting/                   # + address scrubber (research R10)
│       │   ├── sqlite/                            # migration 3, local-data-eraser, sync-state accountId
│       │   ├── sync-http/                         # + account and admin HTTP adapters
│       │   └── ui/                                # SignIn, ChoosePassword, Accounts, account dialogs, SignedOutNotice,
│       │                                          #   shared PasswordField, SyncStatusBar rows; − ConnectServer, PairingCodeDialog
│       └── composition/                           # wires the new adapters
packages/sync-core/src/
├── account.ts                                     # normalizeEmail, validateNewPassword (pure, tested)
└── protocol.ts                                    # auth, account, admin request/response types; accountId in responses
tests/
├── sync/src/                                      # + account scenarios, adapters against startTestServer()
└── e2e/journeys/sync-unreachable.e2e.ts           # changed: SignIn instead of ConnectServer
deploy/mes-courses.env.example                     # + MES_COURSES_SMTP_URL, MES_COURSES_MAIL_FROM, MES_COURSES_PUBLIC_URL (no values)
```

**Structure Decision**: no new workspace and no new layer. The server and the app keep their
hexagonal layout; accounts are one more entity in the server's domain, bound inside the store
adapter. The rules both sides must agree on (address normalization, password rules) go in
`sync-core` with the protocol types, as 003 did for the merge rules.

## Implementation notes for `/speckit-tasks`

- **Order** (each step test-first, each test grouped with its implementation, constitution
  Development Workflow):
  1. `sync-core`: `normalizeEmail`, `validateNewPassword`, protocol types, `accountId` in the
     envelope;
  2. server domain (`account.ts`, `attempts.ts`) and the new ports;
  3. the **store**: `run`/`runForAccount`, the in-memory fake bound per account, the isolation
     contract suite, then migration 2 and the SQLite adapter against the same suite. This is the
     riskiest step: it rewrites every repository's statements, with 003's existing contract and
     use-case tests staying green throughout;
  4. server use cases: `authenticateDevice`, `signIn`, `choosePassword`, `requestPasswordReset`,
     then account and administration use cases, then the mail adapter;
  5. HTTP routes and the auth hook; remove pairing; `create-admin`; `startTestServer` gains accounts;
  6. app migration 3, ports, fakes, the **local copy rule**, `signIn` and the other use cases;
     remove `connectToServer`, `disconnect`, `createPairingCode`;
  7. the HTTP adapters, tested from `tests/sync/`;
  8. the sync slice (`signedOut`, `suspended`) and the scheduler's slow backoff for `suspended`;
  9. the UI, each screen state with its story added to the required list, and the
     `sync-unreachable` journey changed first;
  10. cross-stack scenarios in `tests/sync/`;
  11. `deploy/` variables, README, the upgrade procedure and the quickstart on the Pi.
- **Story mapping**: US1 and US2 (P1) are the invitation, the mail port, sign-in and choosing a
  password. US3 (P1) is the store's account binding and the isolation tests, so it is done **before**
  US1's routes can create a second account. US4 (P2) is the reset flow and its limits. US5 (P2) is
  suspension, deletion and the Accounts screen. US6 (P2) is the account section, sign-out and own
  deletion. The migration and `create-admin` (SC-005) are foundational.
- **Migration note for 003** (constitution Governance): pairing is replaced. The tasks delete
  `claimPairingCode`, `createPairingCode`, `pairing-code`, `connectToServer`, `PairingCodeDialog`,
  `ConnectServerScreen` and their stories and tests, and update the Detox journey; 003's plan and its
  quickstart get a one-line note pointing to 004.
- **The setup account must never be reachable**: it has no email and no password hash, and the
  tests pin that no route can sign in to it and that `listAccounts` omits it until completed.
- **Order of destructive steps on the Pi** is in [quickstart.md](quickstart.md#3-upgrade-the-pi);
  the deployment task checks the three new variables before restarting the service.

## Complexity Tracking

No constitution violation to justify.
