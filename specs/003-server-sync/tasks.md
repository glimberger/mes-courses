---

description: "Task list for feature 003-server-sync"
---

# Tasks: Server Synchronization

**Input**: Design documents from `specs/003-server-sync/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/) ([sync-api.md](contracts/sync-api.md),
[app-ports.md](contracts/app-ports.md), [ui-screens.md](contracts/ui-screens.md)),
[quickstart.md](quickstart.md). Features 001 and 002 must be implemented and green.

**Tests**: REQUIRED (constitution Principle I, non-negotiable). Every test task comes before the
code it drives. Run it, confirm it fails for the expected reason, write the minimum code to turn
it green, then refactor with the suite green. A task that says "test-first" holds both steps in
one task, for small changes to one file. Test names carry the scenario id with the feature
prefix, for example `"003 US2-5 a deletion wins over a concurrent tick"`.

**Organization**: tasks are grouped by user story:

- **US1** (P1): data kept on the server, single device;
- **US2** (P1): several devices and reconciliation;
- **US3** (P2): sync status;
- **US4** (P2): pairing and device management.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to
- Every task names the exact file(s) it touches

## Path Conventions

The Yarn workspaces monorepo of 001 ([plan.md](plan.md#source-code-repository-root), constitution
Principle XI):

- the app is in `apps/mobile/src/` (001 layout), and its `./testing` entry in `apps/mobile/test/`;
- the server is in `apps/server/src/{domain,application,adapters,composition,testing}/`;
- the shared package is `packages/sync-core/src/`;
- the tests that need the app and the server together (the `SyncServer` adapter and the
  cross-stack scenarios) are in the test-only workspace `tests/sync/`;
- the Pi files are in `deploy/`;
- the Detox journey is in 001's test-only workspace `tests/e2e/journeys/`.

Unit tests sit next to the code they cover as `*.test.ts(x)`, and stories as `*.stories.tsx`
([001 research](../001-shopping-lists/research.md) R22, R23). The stories and the journey to add are
listed in [contracts/ui-screens.md](contracts/ui-screens.md#stories-and-end-to-end-journeys).

## Rules that apply to every task

- **No test reaches the Pi or any address other than `127.0.0.1`** (Principles III and VII).
  Time and ids come from fake `Clock` and `IdGenerator`.
- **French text only in the app's UI adapter**. The server returns error codes, and the Pi
  command prints English technical output (R11).
- **Error reports**:
  - the app sends `{ operation, screen? }`;
  - the server sends `{ operation, route }`;
  - neither ever includes a URL, a device name, a pairing code, a credential, a list content or
    an article name (FR-022, FR-022a).
- **The device credential never goes to SQLite, logs or reports**. It lives only in
  `CredentialStore`.
- **Every app write stays one `UnitOfWork.run` transaction**, now including its
  `changes.record` calls (FR-005). Every server request that writes is one transaction.
- **Stories and journeys** follow 001's rules: story data from `createStoryStore` (the `sync`
  slice through the in-memory `SyncServer` and `CredentialStore` fakes, never set by hand); the
  journey never pairs with a real server and reaches only `127.0.0.1` on the device.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: workspaces, the new packages, architecture rules and CI across the workspaces.

- [X] T001 Branch from `origin/main` with 001 and 002 merged. Run `yarn typecheck && yarn lint && yarn format:check && yarn test && yarn test:architecture` and confirm it is all green before any change.
- [X] T002 Check that the root `package.json` `"workspaces"` holds `"tests/*"` (001 added it for `tests/e2e/`). Scaffold `tests/sync/` (name `@mes-courses/sync-tests`, private): `package.json` with devDependencies `"@mes-courses/mobile": "workspace:*"` and `"@mes-courses/server": "workspace:*"`, `tsconfig.json` extending the root base, and `jest.config.js` (ts preset, node environment). Check that `yarn build` still bundles the app.
- [X] T003 [P] Scaffold `packages/sync-core/` (name `@mes-courses/sync-core`, private): `package.json` with **no dependencies**, `tsconfig.json` (strict, extending the root one), `jest.config.js` (ts preset, node environment) and `packages/sync-core/src/index.ts` as its only public entry point. Add `"@mes-courses/sync-core": "workspace:*"` as a dependency of the app (`apps/mobile/package.json`) and the server, then run `yarn install` to update `yarn.lock`.
- [X] T004 [P] Scaffold `apps/server/`:
  - `package.json` (name `@mes-courses/server`, private) with dependencies `fastify@5` and `@sentry/node`, `"exports": { "./testing": "./src/testing/index.ts" }`, and scripts `dev` (watch on `127.0.0.1:3000`, database in `apps/server/.data/`), `build` (`tsc` to `apps/server/dist/`), `start` (`node dist/composition/main.js`), `pairing-code` and `test`;
  - `tsconfig.json` (extending the root `tsconfig.base.json`) and `jest.config.js` (node environment);
  - Node 24 comes from 001's Nix dev shell (`flake.nix`), shared by every workspace.
- [X] T005 Extend `.dependency-cruiser.cjs` ([research.md](research.md) R16):
  - `packages/sync-core/**` imports nothing outside itself;
  - `apps/server/src/domain/**` imports only itself and `@mes-courses/sync-core`;
  - `apps/server/src/application/**` imports only server domain, application and `@mes-courses/sync-core`;
  - only `apps/server/src/adapters/**` and `apps/server/src/composition/**` import `apps/server/src/adapters/**`;
  - the app's `apps/mobile/src/domain/**` and `apps/mobile/src/application/**` may import `@mes-courses/sync-core` and nothing else from npm;
  - `apps/mobile/` and `apps/server/` never import each other (001's cross-workspace rule, kept);
  - only `tests/**` imports `@mes-courses/mobile/testing` and `@mes-courses/server/testing`, and nothing imports `tests/**`.

  Prove each new rule fails on a throwaway violation, then delete the violation.
- [X] T006 Check that `.github/workflows/ci.yml` (001) covers the new workspaces with no new job: the root scripts already run in every workspace, and the `build` job's root `yarn build` now also compiles the server. Fix the workflow only if a workspace is missed. `.github/workflows/e2e.yml` (001, constitution v2.3.0: on every push to `main` and on demand on a branch) needs no change: it builds the app and runs every journey of `tests/e2e/journeys/`, this feature's included. There is no deployment step.
- [X] T007 [P] Add `apps/server/.data/`, `apps/server/dist/` and `packages/*/dist/` to `.gitignore`.

**Checkpoint**: the workspaces install with one `yarn install --immutable`, every existing test is still green, and CI is green on the setup pull request.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**:

- the shared rules (`sync-core`);
- the server's skeleton, storage and pairing;
- the app's migration, new ports and HTTP adapter;
- `connectToServer`.

Every story needs a device that can pair with a running server.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### sync-core ([data-model.md](data-model.md#shared-types-packagessync-core))

- [X] T008 [P] Write failing tests in `packages/sync-core/src/hlc.test.ts`:
  - `compare` orders by `wallMs`, then `counter`, then `deviceId`;
  - `next(state, nowMs)` moves forward with the wall clock and bumps `counter` when the wall clock stalls or goes back;
  - `receive(state, remote, nowMs)` never goes backwards and jumps past a remote stamp;
  - `MIN(deviceId) = { wallMs: 0, counter: 0, deviceId }`;
  - `clamp(hlc, serverNowMs)` caps `wallMs` at `serverNowMs + 60_000` ([research.md](research.md) R6);
  - `encode` / `decode` give strings that sort like `compare`, for SQLite columns.
- [X] T009 [P] Implement `packages/sync-core/src/hlc.ts` to turn T008 green.
- [X] T010 [P] Write failing tests in `packages/sync-core/src/merge.test.ts`:
  - `mergeField(current, incoming)` keeps the greater `(hlc, deviceId)`;
  - applying the same fixed set of field changes in **every** permutation gives the same result (SC-003, deterministic, not random);
  - `pickSurvivor(a, b)` returns the smaller `(createdHlc, id)` (R8);
  - `compareCategories` orders by `(position, createdHlc, id)` (FR-014).
- [X] T011 [P] Implement `packages/sync-core/src/merge.ts` to turn T010 green.
- [X] T012 [P] Move `cleanName` and `normalizedName` into `packages/sync-core/src/name.ts`, with its tests moved from 001's `apps/mobile/src/domain/name.test.ts` into `packages/sync-core/src/name.test.ts`. Make `apps/mobile/src/domain/name.ts` re-export both. 001's name tests stay green unchanged. This is a refactoring step.
- [X] T013 [P] Write the protocol types `Change`, `ServerRow`, `SyncRequest`, `SyncResponse`, the error codes, `HealthInfo` and `Pairing` in `packages/sync-core/src/protocol.ts`, exactly as in [contracts/sync-api.md](contracts/sync-api.md) and [data-model.md](data-model.md). Export everything from `packages/sync-core/src/index.ts`.

### Server: ports, storage, crypto, error reporting

- [X] T014 Declare the server ports in `apps/server/src/application/ports/`:
  - `store.ts`: `ServerStore` with `run(work)` as one transaction, and repositories for meta (serverId, seq), categories, articles, lists, list items, applied changes, devices, pairing codes and pairing failures;
  - `clock.ts`;
  - `id-generator.ts`;
  - `random.ts` (secure random bytes);
  - `error-reporter.ts`, with `report(error, { operation, route })`.
- [X] T015 Write the shared repository contract suites in `apps/server/src/application/testing/contracts/`, one file per repository. They cover:
  - every read and write used by the use cases;
  - `meta.nextSeq()`, which increments and returns;
  - `appliedChanges.has` / `add`;
  - devices looked up by `credentialHash`;
  - pairing codes by `codeHash`;
  - `pairingFailures.countSince(t)`.

  Add `apps/server/src/application/testing/in-memory-store.test.ts`, which runs them on in-memory fakes, and confirm it fails.
- [X] T016 Implement the in-memory fakes, with rollback on throw, in `apps/server/src/application/testing/in-memory-store.ts` to turn T015 green.
- [X] T017 Write failing migration tests in `apps/server/src/adapters/sqlite/migrations.test.ts`:
  - migration 1 creates exactly the tables and indexes of [data-model.md](data-model.md#server-database-pi-sqlite), including the partial unique indexes `... ON ...(normalized_name) WHERE deleted_hlc IS NULL`;
  - `meta` gets a random `server_id` once;
  - `user_version` becomes 1, and running again is a no-op;
  - WAL mode and `synchronous = FULL` are set;
  - `device.name` rejects 0 and 61 characters.
- [X] T018 Implement `apps/server/src/adapters/sqlite/migrations.ts` and `open-database.ts` on `node:sqlite`, with the `better-sqlite3` fallback behind the same interface if needed (R3), to turn T017 green.
- [X] T019 Write `apps/server/src/adapters/sqlite/sqlite-store.test.ts`, which runs every T015 suite on an in-memory migrated database. Then implement `apps/server/src/adapters/sqlite/sqlite-store.ts` to turn it green.
- [X] T020 [P] Write failing tests in `apps/server/src/adapters/crypto/crypto.test.ts`, then implement `apps/server/src/adapters/crypto/crypto.ts`:
  - pairing codes are 8 characters from the alphabet without `0 O 1 I L`, formatted `XXXX-XXXX`;
  - `normalizeCode` accepts lower case and a missing dash;
  - credentials are 32 random bytes in base64url;
  - `sha256Hex` matches known vectors.
- [X] T021 [P] Write failing tests in `apps/server/src/adapters/error-reporting/sentry-error-reporter.test.ts`, with `@sentry/node` mocked, then implement it and `console-error-reporter.ts` ([research.md](research.md) R15):
  - `init` with every `dataCollection` category off (`@sentry/node` 11 replaced `sendDefaultPii: false` by it), the release and the environment;
  - `beforeSend` drops request bodies, headers and cookies;
  - `report` sends only `{ operation, route }` tags;
  - `report` never throws.

### Server: pairing ([contracts/sync-api.md](contracts/sync-api.md))

- [X] T022 Write failing use case tests on fakes in `apps/server/src/application/use-cases/pairing.test.ts`.
  - **`claimPairingCode(code, deviceName)`**:
    - a valid code creates a device with only the credential's SHA-256 stored, marks the code used, and returns `{ deviceId, credential }` (US4-4);
    - an unknown, expired (older than 10 minutes) or used code → `InvalidCode`, recorded as a failure (US4-5);
    - the 6th failure within any rolling 10 minutes → `TooManyAttempts` with the seconds to wait, persisting across a new store instance (FR-019b, US4-12);
    - `deviceName` is trimmed, 1–60 characters.
  - **`createPairingCode(createdBy | null)`**: it returns a code that expires in 10 minutes and stores only its hash (US4-2, US4-3).
- [X] T023 Implement `apps/server/src/domain/pairing.ts` and `apps/server/src/application/use-cases/claim-pairing-code.ts` / `create-pairing-code.ts` to turn T022 green.
- [X] T024 Write failing HTTP tests with Fastify `inject` in `apps/server/src/adapters/http/app.test.ts`, for the common rules and the pairing routes:
  - every response carries `serverId`, `apiVersion: 1` and `minAppVersion`;
  - `X-App-Version` below `minAppVersion` → `426 UpdateRequired`, nothing read;
  - a missing, unknown or revoked credential → `401 DeviceNotAuthorized` before any read;
  - a body over 1 MB → `400`;
  - `GET /v1/health` with no auth;
  - `POST /v1/pairing/claim` → `200` / `400 InvalidCode` / `429 TooManyAttempts` with `Retry-After`;
  - `POST /v1/pairing-codes` (auth) → `{ code, expiresAt }`;
  - an unexpected throw → `500 ServerError`, reported with `{ operation, route }`.
- [X] T025 Implement `apps/server/src/adapters/http/app.ts` (`buildApp(deps)`), `auth.ts` (the Bearer hook), `schemas.ts` (JSON schemas from [contracts/sync-api.md](contracts/sync-api.md)), `errors.ts` and `routes/{health,pairing}.ts` to turn T024 green.
- [X] T026 Write a failing test, then implement the Pi command in `apps/server/src/composition/pairing-code.ts` (`yarn workspace @mes-courses/server pairing-code`). It opens the database, creates a code with `created_by = NULL`, and prints exactly `pairing code: ABCD-EF23 (valid for 10 minutes)` (English technical output for the maintainer, not user-facing text, Principle X).
- [X] T027 Implement `apps/server/src/composition/main.ts`:
  - open and migrate the database at `MES_COURSES_DB` (default `/var/lib/mes-courses/mes-courses.db`, or `apps/server/.data/` in dev);
  - pick the Sentry reporter when `SENTRY_DSN` is set, the console one otherwise;
  - listen on `127.0.0.1:3000` only;
  - install `uncaughtException` and `unhandledRejection` handlers that call `ErrorReporter.report` with `{ operation: 'process', route: 'none' }` and exit non-zero so systemd restarts the service, tested on an injected process-like event emitter (FR-022a).

  Then implement `apps/server/src/testing/start-test-server.ts`, exported from `apps/server/src/testing/index.ts` (the server's `./testing` entry): `startTestServer({ clock? })` starts `buildApp` on `127.0.0.1` with a random port and an in-memory database, and returns `{ url, createPairingCode(), close() }`. Cover `main` with a test that starts and stops it on a temporary file.

### App: migration, ports, adapters, connection ([contracts/app-ports.md](contracts/app-ports.md))

- [X] T028 Write failing tests for migration 2 in `apps/mobile/src/adapters/sqlite/migrations.test.ts`:
  - `pending_change` and `sync_state` are created exactly as in [data-model.md](data-model.md#changes-to-001s-schema-migration-2), with `kind IN ('category','article','list','listItem')` and `snapshot_done IN (0, 1)`;
  - `category.position` is no longer `UNIQUE`, and two equal positions insert;
  - `created_hlc` is added to `category`, `article` and `shopping_list`, existing rows getting the encoded `MIN(deviceId)` stamp;
  - existing rows and `list_item` data survive the table rebuild;
  - `user_version` = 2;
  - it runs in one transaction.
- [X] T029 Implement migration 2 in `apps/mobile/src/adapters/sqlite/migrations.ts` to turn T028 green. Update the category SQLite repository and the read models to order by `(position, created_hlc, id)` through `compareCategories`, keeping 001's ordering tests green. Wrap every database call with `toStorageError` (001 R13), so no stored value reaches a report (001 FR-030).
- [X] T030 Declare the app ports in `apps/mobile/src/application/ports/`, with exactly the signatures of [contracts/app-ports.md](contracts/app-ports.md#new-driven-ports-srcapplicationports):
  - `change-recorder.ts`, `sync-state.ts` and `pulled-rows.ts`, added to `Repositories`;
  - `clock.ts`, `sync-server.ts` and `credential-store.ts`.
- [X] T031 Write the contract suites in `apps/mobile/src/application/testing/contracts/`:
  - `change-recorder.contract.ts`:
    - `record` stamps a strictly increasing HLC from the `Clock`;
    - `pending` excludes held entries and keeps order;
    - `release`, `releaseAll`, `discard`, `acknowledge`;
    - `count` excludes held entries;
    - a `run` that throws leaves no entry.
  - `sync-state.contract.ts`: the defaults (`lastSeq = 0`, `snapshotDone = false`), and `save` then `get`.

  Run them on fakes in `apps/mobile/src/application/testing/in-memory-repositories.test.ts` and on SQLite in `apps/mobile/src/adapters/sqlite/sqlite-repositories.test.ts`, and confirm they fail.
- [X] T032 Implement the fakes in `apps/mobile/src/application/testing/in-memory-repositories.ts` and `FakeClock` in `apps/mobile/src/application/testing/fake-clock.ts`. Implement the SQLite versions in `apps/mobile/src/adapters/sqlite/change-recorder.ts` and `apps/mobile/src/adapters/sqlite/sync-state-repository.ts`. Together they turn T031 green. Wrap every database call with `toStorageError` (001 R13), so no stored value reaches a report (001 FR-030).
- [X] T033 [P] Implement `SystemClock` (`Date.now()`) in `apps/mobile/src/adapters/clock/system-clock.ts`. Implement `CredentialStore` over `expo-secure-store` in `apps/mobile/src/adapters/secure-store/credential-store.ts`, test-first with the module mocked: it writes with the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility option, and `read()` returns `null` when the module throws while decrypting (a value restored without the means to decrypt it, [research.md](research.md) R12a). Register the `expo-secure-store` config plugin with `configureAndroidBackup: true` in `apps/mobile/app.config.ts`, keeping 001's `android.allowBackup: true` and the database in the backup. Add `InMemoryCredentialStore` in `apps/mobile/src/application/testing/`. Install `expo-secure-store` with `yarn expo install`.
- [X] T034 Add the app's `./testing` entry: `apps/mobile/test/index.ts`, declared in `apps/mobile/package.json` `"exports"`, re-exporting 001's `node:sqlite` wrapper and the `SyncServer` adapter factory. Then write failing tests for the `SyncServer` HTTP adapter in `tests/sync/src/sync-server-adapter.test.ts`, importing the adapter from `@mes-courses/mobile/testing` and `startTestServer()` from `@mes-courses/server/testing` (the app never imports the server, Principle XI):
  - `health` returns `HealthInfo`;
  - `claim` maps `200` / `400` / `429` to `Pairing` / `InvalidCode` / `TooManyAttempts` (with minutes to wait);
  - each request sends `X-App-Version` and, when authenticated, `Authorization: Bearer`;
  - connection refused or a timeout of 10 s → `Offline` / `ServerUnreachable`;
  - a TLS verification error, simulated by an injected `fetch` that throws the platform's TLS error, → `UntrustedServer` and never a retry over `http://`;
  - `401` → `DeviceNotAuthorized`, `426` → `UpdateRequired`, `5xx` → `ServerError`.
- [X] T035 Implement `apps/mobile/src/adapters/sync-http/sync-server.ts` (over `fetch`, with an injectable `fetch` and timeout) to turn the T034 tests for `health` and `claim` green. The other methods follow in the stories.
- [X] T036 Write failing use case tests in `apps/mobile/src/application/use-cases/connect-to-server.test.ts`, on fakes and a fake `SyncServer`:
  - "courses.example.fr" becomes `https://courses.example.fr`;
  - `http://` → `InvalidUrl`, unless the composition passes `allowInsecure` (development only);
  - `health` is called before `claim`, and `ServerUnreachable` / `UntrustedServer` change nothing;
  - `InvalidCode` and `TooManyAttempts` change nothing;
  - on success the credential goes to `CredentialStore` only, and `sync_state` stores `serverUrl`, `serverId` and `deviceId`, with `lastSeq = 0` and `snapshotDone = false`.
- [X] T037 Implement `apps/mobile/src/application/use-cases/connect-to-server.ts` to turn T036 green. Add it to `UseCases` and to `apps/mobile/src/composition/composition-root.ts`, with `SystemClock`, `CredentialStore` and `SyncServer` wired, and `allowInsecure` only when `__DEV__ && EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL === '1'`.

**Checkpoint**: a development build can pair with a local server. Every existing test and the architecture test are green.

---

## Phase 3: User Story 1 - My data is kept on my home server (Priority: P1) 🎯 MVP

**Goal**: every change of one device reaches the server automatically, offline changes wait in a
durable outbox, undone changes never leave the device, and a new install gets everything back.

**Independent Test**: on one device, make changes online and offline, and check they all reach
the server. Reinstall, connect, and check every list, item, tick and quantity is back.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [X] T038 [US1] Write the failing journey `tests/e2e/journeys/sync-unreachable.e2e.ts` ([contracts/ui-screens.md](contracts/ui-screens.md#stories-and-end-to-end-journeys)): on a fresh install no sync status bar is shown; "Réglages" shows "Synchronisez vos listes avec votre serveur pour les retrouver sur vos autres appareils."; in ConnectServer, enter `127.0.0.1:9` and the code "ABCD-EF23", tap "Connecter": "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion." appears; back on the current list, add and tick an item: it works at once (003 US4-1, US4-6, FR-002). Run `yarn test:e2e:android` and confirm it fails on the missing "Réglages" action.
- [X] T039 [P] [US1] Write failing server domain tests in `apps/server/src/domain/apply-change.test.ts` ([data-model.md](data-model.md#server-database-pi-sqlite)):
  - a create sets every field with its HLC and `createdHlc`;
  - an update writes a field only when `mergeField` keeps the incoming value;
  - changes to different fields are both kept (FR-009);
  - `listItem.present = false` is not reset by `inCart` or `quantity` changes (FR-011);
  - `article.deleted` sets `deletedHlc`, and any later change to it is ignored (FR-011);
  - a change for an unknown entity is ignored;
  - every touched row gets the new `seq`.
- [X] T040 [P] [US1] Write failing use case tests in `apps/server/src/application/use-cases/sync.test.ts`, on fakes:
  - changes are applied in request order;
  - a replayed `changeId` is acknowledged and not applied again (FR-006);
  - a change with no effect is still acknowledged;
  - the response carries every row with `seq > lastSeq`, tombstones included (R7), plus the new `seq` and the server's HLC;
  - more than 5,000 rows → `more: true` and paging;
  - more than 500 changes → `400`;
  - the device's `lastSyncAt` is set;
  - a failure midway applies nothing (one transaction).
- [X] T041 [P] [US1] Write failing HTTP tests for `POST /v1/sync` in `apps/server/src/adapters/http/sync-route.test.ts`, with `inject` and a real SQLite store: the schema rejects a bad body with nothing applied, `401` for a revoked device, and a round trip with a fake clock.
- [X] T042 [P] [US1] Write failing tests in `apps/mobile/src/adapters/sqlite/pulled-rows-applier.test.ts`, on a migrated `node:sqlite` database:
  - pulled rows are upserted into `category`, `article`, `shopping_list` and `list_item`;
  - a `listItem` with `present = false` deletes the local row;
  - a deleted or merged article deletes the local article and its items;
  - fields with a pending local change are skipped;
  - a row that would break `UNIQUE (normalized_name)` against a pending local create is deferred and counted, not failed (R8);
  - `app_state.current_list_id` is never sent and is left alone by every row except one: a list tombstone whose `mergedInto` is set and whose id is the current list moves `current_list_id` to the survivor, following the `mergedInto` chain, in the same transaction (FR-015, US2-10, [research.md](research.md) R8a);
  - `apply` returns `effects`: the articles it deleted, the items it removed (`present = false`) and the merges (`kind`, `loserId`, `survivorId`), and empty lists when the rows changed nothing of the kind ([data-model.md](data-model.md#remote-effects-returned-by-pulledrowsapplierapply-research-r10a));
- [X] T043 [P] [US1] Write failing use case tests in `apps/mobile/src/application/use-cases/synchronize.test.ts`, with fakes and a fake `SyncServer`:
  - `notConnected` when there is no `serverUrl`;
  - `disconnectedByServer` when `serverUrl` is set but `CredentialStore.read()` gives `null` (a phone restored from a backup), with no request sent and every row and pending change kept; `getSyncInfo` reports the same connection, see T054a (FR-018b, [research.md](research.md) R12a);
  - the result carries the applier's `effects` next to the outcome, and empty effects when nothing was pulled;
  - the first cycle pushes a snapshot of every local row and field stamped with `MIN(deviceId)` before the outbox, then sets `snapshotDone` (R13, US1-6);
  - outbox entries are pushed in order, in batches of at most 500, until empty (US1-3);
  - acknowledged entries are removed, rows applied, `lastSeq` saved, the HLC received;
  - `Offline` → `waiting`, with nothing lost;
  - `DeviceNotAuthorized` or a different `serverId` → `disconnectedByServer`, keeping every row and pending change (FR-018a);
  - `UpdateRequired` → `updateRequired`;
  - `more: true` → pull again.
- [X] T044 [P] [US1] Write failing tests for `releaseHeldChanges(undoId)` in `apps/mobile/src/application/use-cases/release-held-changes.test.ts`, and extend `apps/mobile/src/application/use-cases/initialize-store.test.ts`: at every start it calls `changes.releaseAll()`, so a deletion left held by a killed app becomes final (R10).
- [X] T045 [P] [US1] Write failing store and scheduler tests in `apps/mobile/src/adapters/ui/state/sync-scheduler.test.ts`, with Jest fake timers and a mocked React Native `AppState`:
  - a cycle runs at start;
  - a cycle runs on coming back to the foreground;
  - a cycle runs 1 s after a write (debounced);
  - a cycle runs every 5 s in the foreground, and none in the background;
  - never two cycles at once;
  - after failures the delay backs off 5 s → 10 s → … → 5 min, and resets on success;
  - after a cycle that pulled rows, the store runs `refresh()`.
- [X] T046 [US1] Write failing tests in `apps/mobile/src/adapters/ui/state/app-store.undo-sync.test.ts`: when an undo offer ends (5 s, the next successful write, dismissal, or a new undo replacing it), the store calls `releaseHeldChanges(undoId)`; "Annuler" calls the restore, which discards the held entries. When a cycle's `effects.deletedArticles` holds the article of the pending offer (a removed item of that article, or 002's deleted article), the store clears `pendingUndo`, calls `releaseHeldChanges(undoId)` and remembers that `undoId`; a later `undo(undoId)` restores nothing and sets the notice "Cet article a été supprimé sur un autre appareil.", and so does a restore that returns `ArticleNotFound` (FR-008, US1-8, [research.md](research.md) R10a).
- [X] T047 [US1] Write failing screen tests in `apps/mobile/src/adapters/ui/screens/settings-screen.test.tsx` and `apps/mobile/src/adapters/ui/screens/connect-server-screen.test.tsx`, through `renderWithStore` and the texts of [contracts/ui-screens.md](contracts/ui-screens.md):
  - Appbar action "Réglages" on CurrentList;
  - not connected: "Synchronisez vos listes avec votre serveur pour les retrouver sur vos autres appareils." and "Connecter à un serveur";
  - ConnectServer fields "Adresse du serveur", "Code d'appairage" and "Nom de cet appareil", the latter prefilled with the device model and capped at 60 characters;
  - outcomes:
    - success → back to Settings and "Appareil connecté. Synchronisation en cours…" (US4-4);
    - `InvalidUrl` → "Saisissez une adresse comme courses.example.fr.";
    - `ServerUnreachable` → "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion." (US4-6);
    - `UntrustedServer` → "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.", reported once;
    - `InvalidCode` → "Ce code n'est pas valide ou a expiré. Demandez un nouveau code." (US4-5);
    - `TooManyAttempts` → "Trop d'essais. Réessayez dans {n} minutes." (US4-12);
  - connected: the server address and "Dernière synchronisation : …" or "Jamais".
- [X] T048 [US1] Write a failing cross-stack scenario test in `tests/sync/single-device.test.ts`: one app stack on SQLite (`node:sqlite`) with the real `SyncServer` adapter, the real use cases and a fake clock, against `startTestServer()`. The stack comes from a `buildTestAppStack({ serverUrl, clock })` helper added to `apps/mobile/test/index.ts`, which wires the app's composition the same way as production, minus the UI.
  - 003 US1-1: a tick reaches the server after one cycle.
  - 003 US1-2 / US1-3: with the server closed, add, tick, rename and delete; nothing fails; restart the server and the changes arrive in order, none twice.
  - 003 US1-4: rebuild the app stack on the same database, as a killed app would; the outbox is still sent.
  - 003 US1-5: a fresh app stack paired with the same server gets every list, item, tick, quantity, article and category, with no second default category or "Ma liste".
  - 003 US1-6: data made before pairing reaches an empty server.
  - 003 US1-7: delete with undo, then restore; the server never sees the deletion.

### Implementation for User Story 1

- [X] T049 [US1] Implement `apps/server/src/domain/apply-change.ts` to turn T039 green.
- [X] T050 [US1] Implement `apps/server/src/application/use-cases/sync.ts` to turn T040 green.
- [X] T051 [US1] Implement `apps/server/src/adapters/http/routes/sync.ts` and its schema to turn T041 green.
- [X] T052 [US1] Implement `apps/mobile/src/adapters/sqlite/pulled-rows-applier.ts` to turn T042 green. Wrap every database call with `toStorageError` (001 R13), so no stored value reaches a report (001 FR-030).
- [X] T053 [US1] Add `sync` to `apps/mobile/src/adapters/sync-http/sync-server.ts`, extending `tests/sync/sync-server-adapter.test.ts` first with a round trip against `startTestServer()`.
- [X] T054 [US1] Implement `apps/mobile/src/application/use-cases/synchronize.ts` to turn T043 green.
- [X] T054a [US1] Test-first, implement `apps/mobile/src/application/use-cases/get-sync-info.ts` with its test, per [contracts/app-ports.md](contracts/app-ports.md): it returns `SyncInfo` (`serverUrl`, `lastSyncAt`, `connection`); `disconnectedByServer` when `serverUrl` is set and `CredentialStore.read()` gives `null` (FR-018b); `notConnected` when there is no `serverUrl`. Add it to `UseCases` and to the composition root.
- [X] T055 [US1] Implement `apps/mobile/src/application/use-cases/release-held-changes.ts` and call `changes.releaseAll()` in `initialize-store.ts`, to turn T044 green.
- [X] T056 [US1] Test-first, record the seeded categories (`name`, `position`) and the first list (`name`) with `changes.record(…, { seed: true })` (minimum HLC, so another device's edits win; the human's decision on PR 81) in `apps/mobile/src/application/use-cases/initialize-store.ts` ([contracts/app-ports.md](contracts/app-ports.md#changes-to-existing-use-cases-001-and-002)). Keep every existing test green.
- [X] T057 [P] [US1] Test-first, record `listItem.inCart` in `apps/mobile/src/application/use-cases/toggle-item-in-cart.ts`.
- [X] T058 [P] [US1] Test-first, record `listItem.inCart = false` for each item ticked at that moment, with one HLC, in `apps/mobile/src/application/use-cases/finish-shopping.ts` (FR-013).
- [X] T059 [P] [US1] Test-first, record `listItem { listId, articleId, present: true, inCart: false, quantity }` in `apps/mobile/src/application/use-cases/add-article-to-list.ts`.
- [X] T060 [P] [US1] Test-first, record `article { name, categoryId }` and then the `listItem` in `apps/mobile/src/application/use-cases/create-article-and-add-to-list.ts`. The article's change must come first.
- [X] T061 [P] [US1] Test-first, record `listItem.quantity` in `apps/mobile/src/application/use-cases/change-item-quantity.ts`.
- [X] T062 [P] [US1] Test-first, record `listItem.present = false` **held** by a new `undoId`, returned in `RemovedItem`, in `apps/mobile/src/application/use-cases/remove-item-from-list.ts`.
- [X] T063 [P] [US1] Test-first, call `changes.discard(removed.undoId)` and record nothing in `apps/mobile/src/application/use-cases/restore-removed-item.ts`.
- [X] T064 [P] [US1] Test-first, record `list.name` in `apps/mobile/src/application/use-cases/create-list.ts`, and assert `set-current-list.ts` records nothing (FR-015).
- [X] T065 [P] [US1] Test-first, record `category { name, position }` in `apps/mobile/src/application/use-cases/create-category.ts`.
- [X] T066 [P] [US1] Test-first, record only the changed fields (`article.name` and/or `article.categoryId`) in `apps/mobile/src/application/use-cases/edit-article.ts` (002).
- [X] T067 [P] [US1] Test-first, record `article.deleted = true` **held** by a new `undoId`, returned in `DeletedArticle`, in `apps/mobile/src/application/use-cases/delete-article.ts` (002).
- [X] T068 [P] [US1] Test-first, call `changes.discard(deleted.undoId)` in `apps/mobile/src/application/use-cases/restore-deleted-article.ts` (002).
- [X] T069 [US1] Add the `sync` slice (`connection`, `status`, `pendingCount`, `lastSyncAt`, per [research.md](research.md) R14) and the `connectToServer` action to `apps/mobile/src/adapters/ui/state/app-store.ts`. Implement `apps/mobile/src/adapters/ui/state/sync-scheduler.ts`. Release held changes when an undo offer ends, and end the offer on an article deleted elsewhere. Together these turn T045–T046 green. Start the scheduler from `apps/mobile/src/composition/composition-root.ts`.
- [X] T070 [US1] Extend `apps/mobile/src/adapters/ui/testing/story-store.ts` (001) test-first in `story-store.test.ts`: a scenario can start connected (the fake `CredentialStore` holds a credential) or not, and drives the in-memory `SyncServer` fake (reachable, unreachable, revoked, update required); `pending` and `failing` also apply to `synchronize` and `connectToServer`. Every existing story and test stays green.
- [X] T071 [US1] Implement `apps/mobile/src/adapters/ui/screens/SettingsScreen.tsx` (not-connected and server sections) and `apps/mobile/src/adapters/ui/screens/ConnectServerScreen.tsx`. Add the "Réglages" Appbar action (cog icon) to `CurrentListScreen.tsx`, and the routes to `apps/mobile/src/adapters/ui/navigation.tsx`. This turns T047 green.
- [X] T072 [US1] Add `Screens/Settings/NotConnected`, `Screens/Settings/Connected`, `Screens/ConnectServer/Default`, `.../ServerUnreachable`, `.../InvalidCode`, `.../UntrustedServer` and `.../TooManyAttempts` to `apps/mobile/src/adapters/ui/required-stories.ts` and see the story test fail. Then write `apps/mobile/src/adapters/ui/screens/SettingsScreen.stories.tsx` (not connected; connected, with "Dernière synchronisation : …") and `ConnectServerScreen.stories.tsx` (the outcome stories render the screen's presentational form with each French message, 001's convention) to turn it green. Review them in Storybook on both platforms, light and dark.
- [X] T073 [US1] Make `tests/sync/single-device.test.ts` (T048) green, fixing only what it reveals, each fix with its own failing unit test first.
- [X] T074 [US1] Make `sync-unreachable.e2e.ts` (T038) green with `yarn test:e2e:android` and `yarn test:e2e:ios`, every journey of 001 and 002 still green. Any production fix starts with its own failing unit or screen test.

**Checkpoint**: one device syncs with the server and survives reinstalling. This is the first half of the MVP.

---

## Phase 4: User Story 2 - The same data on several devices (Priority: P1)

**Goal**: changes flow between one user's devices, and concurrent changes settle by the spec's
rules, identically everywhere.

**Independent Test**: connect two devices to one server. Make changes on both, online and then
offline at the same time, and check they end identical after syncing, per US2's rules.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [X] T075 [P] [US2] Write failing server domain tests in `apps/server/src/domain/merge-by-name.test.ts` ([research.md](research.md) R8):
  - two categories, two articles or two lists with the same `normalizedName` → the survivor is the smaller `(createdHlc, id)`, and the other is tombstoned with `mergedInto`;
  - a merged article's list items move to the survivor, and are merged field by field when the survivor is already on that list;
  - a merged category's articles move;
  - a merged list's items move;
  - a later change to a merged id is redirected, following chains;
  - a rename that collides triggers the same merge (spec edge case);
  - all of it happens in the transaction of the change that caused it.
- [X] T076 [P] [US2] Extend `apps/server/src/application/use-cases/sync.test.ts` with failing tests:
  - an incoming HLC more than 60 s ahead of the server clock is clamped, so a device with its clock in the future does not win a later honest change made 2 minutes after (spec edge case "wrong clock");
  - the server's HLC returned to a slow device makes that device's next change win over older ones.
- [X] T077 [US2] Write failing two-device scenario tests in `tests/sync/two-devices.test.ts`: two app stacks (A and B) on separate databases, one `startTestServer()`, and a fake clock shared or skewed per test. Each US2 scenario of the spec is one test, with both devices offline (server closed) between their changes:
  - 003 US2-1: "Pain" added on A appears on B after B's next cycle;
  - 003 US2-2: A ticks, then B unticks later → unticked on both;
  - 003 US2-3: a rename on A and a quantity change on B → "Lait entier, 2 L" on both;
  - 003 US2-4: both create "Houmous" / " houmous " and add it to lists → one article, items kept; the same for categories and lists;
  - 003 US2-5: A deletes "Lait" and B ticks or renames it → deleted on both;
  - 003 US2-6: A removes "Pain" and B changes its quantity → removed on both;
  - 003 US2-7: A finishes shopping, then B ticks "Œufs" later → only "Œufs" ticked;
  - 003 US2-8: two new categories → both after the existing ones, same order on both;
  - 003 US2-9: each device keeps its own current list;
  - 003 US2-10: both create "Barbecue" offline and B has its own as current → after both sync, B's current list is the surviving "Barbecue" holding the items of both, with no message;
  - 003 FR-017 / SC-007: B with its own seeded defaults and data joins a server holding A's data → no duplicated default category or "Ma liste", and B's own articles are added;
  - SC-003: after every scenario, A's and B's full read models are deep-equal.
- [X] T078 [US2] Write a failing scenario test in `tests/sync/reset-server.test.ts` (FR-018a):
  - both devices hold data, then the server is replaced by an empty one with a new `serverId`;
  - each device reports `disconnectedByServer` and keeps its data and outbox;
  - A pairs again and repopulates; B pairs again and merges with no duplicates;
  - A's and B's read models are deep-equal at the end.
- [X] T081 [US2] Write failing tests for open forms during a sync (FR-020a, [research.md](research.md) R10a, [contracts/ui-screens.md](contracts/ui-screens.md#changes-a-pull-makes-to-open-screens-fr-020a-fr-008-fr-015-fr-023)):

### Implementation for User Story 2

- [X] T079 [US2] Implement `apps/server/src/domain/merge-by-name.ts` and call it from `apply-change.ts` on creates and renames, to turn T075 green.
- [X] T080 [US2] Add the HLC clamp and the server HLC state to `apps/server/src/application/use-cases/sync.ts` to turn T076 green.
  - in `apps/mobile/src/adapters/ui/state/app-store.remote-effects.test.ts`: a cycle's `effects.merges` fill the slice's `redirects` (kept in memory only); a store write action called with a merged id calls the use case with the survivor's id, following chains;
  - in `apps/mobile/src/adapters/ui/state/use-remote-removal.test.tsx`: `useRemoteRemoval({ articleId })` calls its callback when a later cycle deletes that article, and `useRemoteRemoval({ listId, articleId })` when it removes that item; it ignores effects from cycles before it mounted;
  - in `apps/mobile/src/adapters/ui/screens/quantity-dialog.test.tsx` (001) and `edit-article-screen.test.tsx` (002): with "3" typed, a cycle that changes the item's quantity on the server keeps "3" in the field, and saving records "3"; a cycle that removes the item closes QuantityDialog with the snackbar "Cet article a été retiré de la liste sur un autre appareil."; a cycle that deletes the article closes QuantityDialog or EditArticle with "Cet article a été supprimé sur un autre appareil.", and focus goes back as when the form closes (001 FR-037).
- [X] T082 [US2] Implement `redirects` and the redirect of write actions in `apps/mobile/src/adapters/ui/state/app-store.ts`, the `useRemoteRemoval` hook in `apps/mobile/src/adapters/ui/state/use-remote-removal.ts`, and its use in `QuantityDialog.tsx` and `EditArticleScreen.tsx`, the two forms that edit a synced item or article (creation dialogs have nothing a pull can remove, and device names are not synced data), to turn T081 green. Then add `Components/NoticeSnackbar/ArticleDeletedElsewhere` and `.../ItemRemovedElsewhere` to `required-stories.ts`, see the story test fail, and add both to `apps/mobile/src/adapters/ui/components/NoticeSnackbar.stories.tsx`, each reached through a scenario whose fake `SyncServer` pulls the deletion or removal while the form is open.
- [X] T083 [US2] Make `tests/sync/two-devices.test.ts` (T077) and `tests/sync/reset-server.test.ts` (T078) green. Every production fix they force starts with its own failing unit test in the layer where it belongs: `sync-core`, server domain, `PulledRowsApplier` or `synchronize`.

**Checkpoint**: US1 and US2 together form the MVP. The server is the source of truth, and every
device converges.

---

## Phase 5: User Story 3 - I can see whether my changes are saved on the server (Priority: P2)

**Goal**: one discreet status on every data screen (saved, waiting with a count, sending,
failed with "Réessayer"), offline never shown as an error, and "Synchroniser maintenant".

**Independent Test**: watch the status online (sending, then saved), offline (waiting) and with
the server failing (failed, then "Réessayer").

### Tests for User Story 3 ⚠️ (write first, confirm they fail)

- [ ] T084 [P] [US3] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.sync-status.test.ts`, following the transitions of [data-model.md](data-model.md#sync-status-ui-store-syncstatus-us3):
  - a local write → `waiting` with `pendingCount`;
  - a cycle → `sending`, then `saved` when the outbox is empty;
  - `Offline` → `waiting`, never reported (FR-022);
  - `StorageFull` while applying a pull → `waiting`, not reported, `notice = storageFull` once per streak (001 FR-030);
  - `ServerError`, a bad response or `UntrustedServer` three times in a row → `failed`, reported once per streak with `{ operation: 'sync' }`;
  - a success resets the streak;
  - `syncNow()` starts a cycle at once (US3-5);
  - `retry()` from `failed` starts a cycle.
- [ ] T085 [P] [US3] Write failing component tests in `apps/mobile/src/adapters/ui/components/sync-status-bar.test.tsx`, with the texts of [contracts/ui-screens.md](contracts/ui-screens.md#syncstatusbar-new-shared-component-fr-020):
  - "Synchronisé" (US3-1);
  - "En attente de synchronisation (3)", with the accessibility label "3 modifications", and no error color (US3-2);
  - "Synchronisation…" (US3-3);
  - "Échec de la synchronisation" with "Réessayer" (US3-4);
  - hidden when `notConnected`;
  - "Mettez à jour l'application pour synchroniser." when `updateRequired`;
  - no `accessibilityLiveRegion`; with `AccessibilityInfo.announceForAccessibility` mocked, it announces "Échec de la synchronisation" on entering `failed` and "Synchronisé" on the first `saved` after a failure, and nothing for `waiting` ↔ `sending` ↔ `saved` cycles or a change of the waiting count (US3-6, FR-023, [research.md](research.md) R14);
  - `DisconnectedByServer` also for a connection with a server address and no credential (FR-018b);
  - ≥ 48 dp with a button;
  - tapping it opens Settings.
- [ ] T086 [US3] Write failing screen tests: CurrentList, AddArticles, Lists, EditArticle and Settings each render `SyncStatusBar` under their Appbar. Settings' server section shows "Synchroniser maintenant" (US3-5). Put them in the existing `*-screen.test.tsx` files.
- [ ] T087 [US3] Write a failing test in `apps/mobile/src/adapters/ui/screens/current-list-screen.test.tsx` for focus after a pull (US3-7, [research.md](research.md) R14): with a screen reader on (mocked `AccessibilityInfo`), activate the row "Pain", then run a cycle that removes "Pain": `setAccessibilityFocus` targets the next row, or the previous one when "Pain" was last, or the `EmptyState` when the list becomes empty, and `announceForAccessibility` is not called; a cycle that removes a row the user did not activate moves no focus.

### Implementation for User Story 3

- [ ] T088 [US3] Implement the status transitions, the failure streak, `syncNow()` and `retry()` in `apps/mobile/src/adapters/ui/state/app-store.ts` and `apps/mobile/src/adapters/ui/state/sync-scheduler.ts` to turn T084 green.
- [ ] T089 [P] [US3] Implement `apps/mobile/src/adapters/ui/components/SyncStatusBar.tsx` (Paper only, theme tokens, announcing only failure and recovery) to turn T085 green.
- [ ] T090 [US3] Render `SyncStatusBar` in `CurrentListScreen.tsx`, `AddArticlesScreen.tsx`, `ListsScreen.tsx`, `EditArticleScreen.tsx` and `SettingsScreen.tsx`, and add "Synchroniser maintenant" to Settings, to turn T086 green.
- [ ] T091 [US3] Track the last activated row in `apps/mobile/src/adapters/ui/screens/CurrentListScreen.tsx` (activation and 001's own focus moves), and move focus as after a local removal when a cycle's effects remove it, to turn T087 green.
- [ ] T092 [US3] Add `Components/SyncStatusBar/Saved`, `.../Waiting`, `.../Sending`, `.../Failed`, `.../DisconnectedByServer`, `.../UpdateRequired` and `Screens/CurrentList/WithSyncStatus` to `required-stories.ts` and see the story test fail. Then write `apps/mobile/src/adapters/ui/components/SyncStatusBar.stories.tsx`, each status reached through a scenario: a `prepare` that syncs once against a reachable fake (Saved), a change made with the fake unreachable (Waiting), `pending: ['synchronize']` (Sending), three failing syncs (Failed), a revoked device (DisconnectedByServer), plus a second `DisconnectedByServer` check in the story test from a scenario with a server address and no stored device credential (FR-018b), a server asking for an update (UpdateRequired); and add `WithSyncStatus` to `CurrentListScreen.stories.tsx`. Turn the test green, then check in Storybook that `Waiting` uses no error color, in light and dark mode (003 US3-2).

**Checkpoint**: the user always sees whether changes are on the server.

---

## Phase 6: User Story 4 - Connect a device to my server, securely (Priority: P2)

**Goal**:

- add devices with codes from a connected device;
- list, rename and revoke devices;
- disconnect;
- recover when the server no longer knows the device.

Claiming a code and the first code from the Pi are foundational (Phase 2).

**Independent Test**: from a connected device, add a second one with "Ajouter un appareil". Then
revoke it from the first: it stops syncing on its next attempt and keeps its local copy.

### Tests for User Story 4 ⚠️ (write first, confirm they fail)

- [ ] T093 [P] [US4] Write failing server use case tests in `apps/server/src/application/use-cases/devices.test.ts`:
  - `listDevices` excludes revoked ones and returns `{ id, name, createdAt, lastSyncAt }` (US4-8);
  - `renameDevice` trims to 1–60 characters, or `NotFound`;
  - `revokeDevice` sets `revokedAt`, and the next request from that device is refused (US4-9, SC-009);
  - a device may revoke itself (US4-11).
- [ ] T094 [P] [US4] Write failing HTTP tests in `apps/server/src/adapters/http/devices-route.test.ts` for `GET /v1/devices`, `PATCH /v1/devices/:id` and `DELETE /v1/devices/:id` (`200`/`204`/`404`, auth required).
- [ ] T095 [P] [US4] Write failing app use case tests in `apps/mobile/src/application/use-cases/`, one file each, on fakes and a fake `SyncServer`:
  - `create-pairing-code.test.ts`: US4-3, and `Offline`;
  - `list-devices.test.ts`: marks `isThisDevice`;
  - `rename-device.test.ts`: 001's `validateName` errors;
  - `revoke-device.test.ts`: US4-9;
  - `disconnect.test.ts` (US4-11): it revokes itself when the server is reachable, otherwise best effort; it clears the credential and the connection fields; it keeps the local data and the outbox; `connection` becomes `notConnected`.
- [ ] T096 [US4] Extend `tests/sync/sync-server-adapter.test.ts` with failing tests for `createPairingCode`, `listDevices`, `renameDevice` and `revokeDevice` against `startTestServer()`.
- [ ] T097 [US4] Write failing screen tests in `apps/mobile/src/adapters/ui/screens/settings-screen.test.tsx`, with the texts of [contracts/ui-screens.md](contracts/ui-screens.md#settings-new-screen):
  - the Appareils section: rows with the name, "Dernière synchronisation : …" and "Cet appareil"; loading; error "Impossible de charger les appareils." with "Réessayer"; offline "Liste des appareils indisponible hors connexion." (not reported);
  - "Renommer" dialog;
  - "Modifier l'adresse" dialog with each outcome message of T101a, including "Cette adresse ne correspond pas à votre serveur.";
  - "Révoquer « … » ?" dialog with "Cet appareil ne pourra plus synchroniser. Ses données restent sur l'appareil.", not offered on this device;
  - "Déconnecter cet appareil ?" dialog;
  - `PairingCodeDialog` "Ajouter un appareil" showing "ABCD-EF23" and "Valable jusqu'à {heure}.", with the offline message "Connexion au serveur nécessaire pour ajouter un appareil.";
  - with `connection = disconnectedByServer`, the bar shows "Cet appareil n'est plus connecté au serveur." and "Se reconnecter" opens ConnectServer (US4-10).
- [ ] T098 [US4] Write a failing scenario test in `tests/sync/revocation.test.ts` (and one in `tests/sync/change-server-url.test.ts`: a second `startTestServer()` on the same database answers at a new address, the device switches to it, keeps its credential and syncs; a server with another identity is refused):
  - A creates a code and B claims it (US4-3, US4-4);
  - A revokes B; B's next cycle → `disconnectedByServer`, with B's data and outbox kept (US4-10, SC-009);
  - B pairs again with a new code and its waiting changes are sent;
  - B disconnects itself and the server data is untouched (US4-11);
  - six wrong codes → `TooManyAttempts` (US4-12).

### Implementation for User Story 4

- [ ] T099 [US4] Implement `apps/server/src/application/use-cases/{list-devices,rename-device,revoke-device}.ts` and `apps/server/src/adapters/http/routes/devices.ts` to turn T093–T094 green.
- [ ] T100 [US4] Add `createPairingCode`, `listDevices`, `renameDevice` and `revokeDevice` to `apps/mobile/src/adapters/sync-http/sync-server.ts` to turn T096 green.
- [ ] T101 [US4] Implement `apps/mobile/src/application/use-cases/{create-pairing-code,list-devices,rename-device,revoke-device,disconnect}.ts` to turn T095 green. Add them to `UseCases`, to the composition root and to store actions in `apps/mobile/src/adapters/ui/state/app-store.ts`.
- [ ] T101a [US4] Test-first, implement `apps/mobile/src/application/use-cases/change-server-url.ts` with its test: it normalizes the address like `connectToServer`; calls `health` on the new address; when its `serverId` equals the stored one, it updates `serverUrl` only and keeps the credential, the pending changes and `lastSeq`; a different `serverId` returns `ServerMismatch`, `ServerUnreachable` and `UntrustedServer` are returned as such, and in every failure nothing changes (spec edge case "domain name changes", FR-016). Add it to `UseCases`, to the composition root and to a store action in `apps/mobile/src/adapters/ui/state/app-store.ts`.
- [ ] T102 [US4] Implement the Appareils and Actions sections of `SettingsScreen.tsx`, the "Modifier l'adresse" button and `ChangeServerUrlDialog.tsx`, `apps/mobile/src/adapters/ui/screens/PairingCodeDialog.tsx`, `RenameDeviceDialog.tsx`, `RevokeDeviceDialog.tsx`, `DisconnectDialog.tsx`, and the "Se reconnecter" action of `SyncStatusBar`, to turn T097 green.
- [ ] T103 [US4] Add `Screens/Settings/DevicesLoading`, `.../DevicesError`, `.../DevicesOffline`, `Dialogs/PairingCodeDialog/Code`, `.../Offline`, `Dialogs/RevokeDeviceDialog/Default`, `Dialogs/DisconnectDialog/Default` and `Dialogs/RenameDeviceDialog/Default`, `Dialogs/ChangeServerUrlDialog/Default` and `.../ServerMismatch` to `required-stories.ts` and see the story test fail. Then extend `SettingsScreen.stories.tsx` (`pending` and `failing` `listDevices`, and the fake unreachable) and write `PairingCodeDialog.stories.tsx`, `RevokeDeviceDialog.stories.tsx`, `DisconnectDialog.stories.tsx`, `RenameDeviceDialog.stories.tsx` and `ChangeServerUrlDialog.stories.tsx` in `apps/mobile/src/adapters/ui/screens/` to turn it green. Review them in Storybook on both platforms.
- [ ] T104 [US4] Make `tests/sync/revocation.test.ts` (T098) green. Each fix it forces starts with its own failing unit test first.

**Checkpoint**: all four stories work. Devices are paired, managed and revoked from the app.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T105 [P] Add `deploy/Caddyfile` (`{$MES_COURSES_DOMAIN}` → `reverse_proxy 127.0.0.1:3000`, with automatic HTTPS), `deploy/mes-courses.service` (user `mes-courses`, `ExecStart=/opt/mes-courses/runtime/bin/node /opt/mes-courses/apps/server/dist/composition/main.js`, `EnvironmentFile=/etc/mes-courses.env`, `Restart=always`, `NODE_ENV=production`). Add `packages.<system>.node` (the dev shell's `nodejs_24`) to `flake.nix`, so the Pi can build its runtime with `nix build .#node` and `deploy/mes-courses.env.example` (variable names only, no values) ([research.md](research.md) R17).
- [ ] T106 [P] Extend `apps/mobile/src/adapters/ui/state/error-context.test.ts` (001) and add `apps/server/src/adapters/error-reporting/report-context.test.ts`. Every report raised in the 003 tests carries only the allowed fields. Scan the serialized reports for the test URL, device names, codes, credentials and article names, and fail if any is found (FR-022, FR-022a).
- [ ] T107 [P] Extend `apps/mobile/src/adapters/ui/screens/accessibility.test.tsx` (001) to Settings, ConnectServer, the device dialogs, `PairingCodeDialog` and `SyncStatusBar`: French labels on every interactive element and ≥ 48 dp targets (FR-023).
- [ ] T108 Extend 001's offline scenario `apps/mobile/src/adapters/ui/offline.test.tsx` with a connected device whose `SyncServer` always returns `Offline`. Every 001 and 002 action still succeeds, the status is `waiting`, and nothing is reported (FR-003, SC-004).
- [ ] T109 Add a test in `tests/sync/performance.test.ts`:
  - a new device restores 500 articles, 5 lists and 300 items from `startTestServer()`, with the cycle loop finishing (asserted as at most 2 sync requests at the 5,000-row page size, SC-005);
  - a local tick's handler never awaits the scheduler (SC-004).
- [ ] T110 Update `README.md`:
  - the workspaces (`apps/server/`, `packages/sync-core/`, `tests/sync/`);
  - running the server in development (`yarn workspace @mes-courses/server dev`, `yarn workspace @mes-courses/server pairing-code`);
  - the Pi and Freebox setup, referring to [quickstart.md](quickstart.md) §3;
  - the environment variables `SENTRY_DSN`, `MES_COURSES_DB`, `MES_COURSES_DOMAIN` and `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL` (development only).
- [ ] T111 Run [quickstart.md](quickstart.md) §1–§2 locally, review every 003 story in Storybook on Android and iOS (light, dark, 200% text), and run `yarn test:e2e:android` and `yarn test:e2e:ios` green. With the maintainer, who does the Freebox, DNS and Pi actions of §3, deploy to the Pi and check `curl https://<domain>/v1/health` from mobile data and from the home Wi-Fi. Then run the 17 scenarios of §4 and §5 (§4 step 17, the restored phone, once on a test phone) on a phone and a tablet. Record results, and anything not checked, in the pull request's test plan.
- [ ] T112 Update `specs/001-shopping-lists/plan.md` and `specs/002-manage-articles/plan.md`: mark their Principle VII deviation in Complexity Tracking as closed by 003, now implemented.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: needs 001 and 002 merged and green.
- **Foundational (Phase 2)**: it blocks every story. Inside it:
  - `sync-core` (T008–T013) comes first;
  - the server track (T014–T027) and the app track (T028–T033) can run in parallel after `sync-core`;
  - the app's HTTP adapter (T034–T035) needs `startTestServer` (T027);
  - `connectToServer` (T036–T037) needs T030–T035.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after US1, because its scenarios need a working single-device sync.
- **US3 (Phase 5)**: after US1. It is independent of US2.
- **US4 (Phase 6)**: after US1. It is independent of US2 and US3, except for the shared files `SettingsScreen.tsx` and `SyncStatusBar.tsx` (T102 after T089).
- **Polish (Phase 7)**: after the stories it covers. T111 needs the maintainer's network setup.

### Within Each User Story

Tests come first and are seen failing. Then sync-core → server domain → server use cases → HTTP
→ app adapters → app use cases → store → screens → cross-stack scenarios. Each green step is
followed by a refactor and a commit. A story's journey, when it has one, is written first and turns
green at the end; its required stories come after the screens they show.

### Parallel Opportunities

- Setup: T003, T004 and T007.
- Foundational:
  - T008–T013, sync-core files in pairs;
  - T020 and T021 beside the server store;
  - the whole app track (T028–T033) beside the server track (T014–T027).
- US1: T039–T045 are seven independent test files; T056–T068 are thirteen use cases in thirteen files.
- US2: T075 and T076.
- US3: T084 and T085; T089 beside T088.
- US4: T093, T094 and T095.
- Polish: T105, T106 and T107.

---

## Parallel Example: User Story 1

```bash
# Red: independent test files
Task: "T039 apps/server/src/domain/apply-change.test.ts"
Task: "T040 apps/server/src/application/use-cases/sync.test.ts"
Task: "T042 apps/mobile/src/adapters/sqlite/pulled-rows-applier.test.ts"
Task: "T043 apps/mobile/src/application/use-cases/synchronize.test.ts"
Task: "T045 apps/mobile/src/adapters/ui/state/sync-scheduler.test.ts"

# Recording changes: one use case per task, all in parallel
Task: "T057 toggle-item-in-cart.ts"
Task: "T058 finish-shopping.ts"
Task: "T062 remove-item-from-list.ts (held)"
Task: "T067 delete-article.ts (held)"
```

## Parallel Example: Foundational

```bash
# After sync-core (T008–T013), two tracks side by side
Task: "Server track: T014 → T019, T020, T021, T022 → T027"
Task: "App track: T028 → T033"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2, both P1)

1. Setup, then Foundational: pair a development build with a local server.
2. US1: one device syncs and survives a reinstall.
3. US2: several devices converge by the spec's rules.
4. **Stop and validate**: quickstart §2 locally, then §3 on the Pi with the maintainer.

### Incremental Delivery

1. Setup + Foundational → one pull request (sync-core, server skeleton, pairing, app ports). Nothing changes for the user yet.
2. US1 → one pull request (sync on one device).
3. US2 → one pull request (merge rules, two devices).
4. US3 → one pull request (status bar).
5. US4 → one pull request (device management).
6. Polish → deployment files, privacy and accessibility checks, the Pi validation.

Each pull request is merged only when `gh pr checks` is all green and, unless it is
documentation-only (`.github/scripts/app-changed.sh`), an `e2e-android` run started with
`gh workflow run e2e.yml --ref <branch>` is green on its latest commit (constitution v2.4.0,
Quality Gates).

---

## Notes

- [P] tasks touch different files and depend on no unfinished task.
- Never delete, skip or weaken a test to make a change go green (Principle I).
- The Freebox, DNS and Pi steps in [quickstart.md](quickstart.md) §3 are the maintainer's.
  Tasks only check them (T111).
- A deletion or removal that is undone never reaches the server (FR-008): held outbox entries
  are the only mechanism, so any new undoable change must record its changes held.
- Test gates (constitution v2.4.0, Quality Gates): before each commit, `yarn test` (the fast
  suite) is green; before each push, `yarn test:e2e:android` (the device suite) is green, unless
  the branch changes only documentation (`specs/`, `.specify/`, Markdown files, as
  `.github/scripts/app-changed.sh` decides); before merging a pull request that is not
  documentation-only, the `E2E Android` workflow, started by hand on its branch, is green on its
  latest commit; the iOS journeys (`yarn test:e2e:ios`) run before each release and before merging a pull request
  that changes native configuration (`apps/mobile/app.config.ts`, a config plugin or a native
  dependency), and that pull request's test plan records the run.
