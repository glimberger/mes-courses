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

npm workspaces ([plan.md](plan.md#source-code-repository-root)):

- the app stays at the root, in `src/` (001 layout);
- the server is in `server/src/{domain,application,adapters,composition,testing}/`;
- the shared package is `packages/sync-core/src/`;
- the Pi files are in `deploy/`;
- cross-stack scenario tests are in `test/sync/`.

Unit tests sit next to the code they cover as `*.test.ts(x)`.

## Rules that apply to every task

- **No test reaches the Pi or any address other than `127.0.0.1`** (Principles III and VII).
  Time and ids come from fake `Clock` and `IdGenerator`.
- **French text only in the app's UI adapter**. The server returns error codes. The single
  exception is the Pi command's output (R11).
- **Error reports**:
  - the app sends `{ operation, screen? }`;
  - the server sends `{ operation, route }`;
  - neither ever includes a URL, a device name, a pairing code, a credential, a list content or
    an article name (FR-022, FR-022a).
- **The device credential never goes to SQLite, logs or reports**. It lives only in
  `CredentialStore`.
- **Every app write stays one `UnitOfWork.run` transaction**, now including its
  `changes.record` calls (FR-005). Every server request that writes is one transaction.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: workspaces, the new packages, architecture rules and CI across the workspaces.

- [ ] T001 Branch from `origin/main` with 001 and 002 merged. Run `npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:architecture` and confirm it is all green before any change.
- [ ] T002 Turn the root `package.json` into an npm workspaces root with `"workspaces": ["server", "packages/*"]`, keeping the Expo app at the root. Make the root scripts `typecheck`, `lint`, `format:check` and `test` also run in every workspace (`--workspaces --include-workspace-root`). Check that `npx expo export --platform android --platform ios` still bundles.
- [ ] T003 [P] Scaffold `packages/sync-core/` (name `@mes-courses/sync-core`, private): `package.json` with **no dependencies**, `tsconfig.json` (strict, extending the root one), `jest.config.js` (ts preset, node environment) and `src/index.ts`. Add `@mes-courses/sync-core` as a dependency of the app and the server.
- [ ] T004 [P] Scaffold `server/`:
  - `package.json` with dependencies `fastify@5` and `@sentry/node`, and scripts `dev` (watch on `127.0.0.1:3000`, database in `server/.data/`), `build` (`tsc` to `server/dist/`), `start` (`node dist/composition/main.js`), `pairing-code` and `test`;
  - `tsconfig.json` (strict) and `jest.config.js` (node environment);
  - `.nvmrc` stays at the root (Node 24).
- [ ] T005 Extend `.dependency-cruiser.cjs` ([research.md](research.md) R16):
  - `packages/sync-core/**` imports nothing outside itself;
  - `server/src/domain/**` imports only itself and `@mes-courses/sync-core`;
  - `server/src/application/**` imports only server domain, application and `@mes-courses/sync-core`;
  - only `server/src/adapters/**` and `server/src/composition/**` import `server/src/adapters/**`;
  - the app's `src/domain/**` and `src/application/**` may import `@mes-courses/sync-core` and nothing else from npm;
  - no import between `server/` and the app's `src/`, except `server/src/testing/` from the app's adapter tests.

  Prove each new rule fails on a throwaway violation, then delete the violation.
- [ ] T006 Update `.github/workflows/ci.yml` so the `typecheck`, `lint` and `test` jobs run across workspaces (root scripts from T002), `test` includes `npm run test:architecture`, and `build` still runs `expo export`. The server is built with `npm run build -w server` in the `build` job. There is no deployment step.
- [ ] T007 [P] Add `server/.data/`, `server/dist/` and `packages/*/dist/` to `.gitignore`.

**Checkpoint**: the workspaces install with one `npm ci`, every existing test is still green, and CI is green on the setup pull request.

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

- [ ] T008 [P] Write failing tests in `packages/sync-core/src/hlc.test.ts`:
  - `compare` orders by `wallMs`, then `counter`, then `deviceId`;
  - `next(state, nowMs)` moves forward with the wall clock and bumps `counter` when the wall clock stalls or goes back;
  - `receive(state, remote, nowMs)` never goes backwards and jumps past a remote stamp;
  - `MIN(deviceId) = { wallMs: 0, counter: 0, deviceId }`;
  - `clamp(hlc, serverNowMs)` caps `wallMs` at `serverNowMs + 60_000` ([research.md](research.md) R6);
  - `encode` / `decode` give strings that sort like `compare`, for SQLite columns.
- [ ] T009 [P] Implement `packages/sync-core/src/hlc.ts` to turn T008 green.
- [ ] T010 [P] Write failing tests in `packages/sync-core/src/merge.test.ts`:
  - `mergeField(current, incoming)` keeps the greater `(hlc, deviceId)`;
  - applying the same fixed set of field changes in **every** permutation gives the same result (SC-003, deterministic, not random);
  - `pickSurvivor(a, b)` returns the smaller `(createdHlc, id)` (R8);
  - `compareCategories` orders by `(position, createdHlc, id)` (FR-014).
- [ ] T011 [P] Implement `packages/sync-core/src/merge.ts` to turn T010 green.
- [ ] T012 [P] Move `normalizedName` into `packages/sync-core/src/name.ts`, with its tests moved from 001's `src/domain/name.test.ts` into `packages/sync-core/src/name.test.ts`. Make `src/domain/name.ts` re-export it. 001's name tests stay green unchanged. This is a refactoring step.
- [ ] T013 [P] Write the protocol types `Change`, `ServerRow`, `SyncRequest`, `SyncResponse`, the error codes, `HealthInfo` and `Pairing` in `packages/sync-core/src/protocol.ts`, exactly as in [contracts/sync-api.md](contracts/sync-api.md) and [data-model.md](data-model.md). Export everything from `packages/sync-core/src/index.ts`.

### Server: ports, storage, crypto, error reporting

- [ ] T014 Declare the server ports in `server/src/application/ports/`:
  - `store.ts`: `ServerStore` with `run(work)` as one transaction, and repositories for meta (serverId, seq), categories, articles, lists, list items, applied changes, devices, pairing codes and pairing failures;
  - `clock.ts`;
  - `id-generator.ts`;
  - `random.ts` (secure random bytes);
  - `error-reporter.ts`, with `report(error, { operation, route })`.
- [ ] T015 Write the shared repository contract suites in `server/src/application/testing/contracts/`, one file per repository. They cover:
  - every read and write used by the use cases;
  - `meta.nextSeq()`, which increments and returns;
  - `appliedChanges.has` / `add`;
  - devices looked up by `credentialHash`;
  - pairing codes by `codeHash`;
  - `pairingFailures.countSince(t)`.

  Add `server/src/application/testing/in-memory-store.test.ts`, which runs them on in-memory fakes, and confirm it fails.
- [ ] T016 Implement the in-memory fakes, with rollback on throw, in `server/src/application/testing/in-memory-store.ts` to turn T015 green.
- [ ] T017 Write failing migration tests in `server/src/adapters/sqlite/migrations.test.ts`:
  - migration 1 creates exactly the tables and indexes of [data-model.md](data-model.md#server-database-pi-sqlite), including the partial unique indexes `... ON ...(normalized_name) WHERE deleted_hlc IS NULL`;
  - `meta` gets a random `server_id` once;
  - `user_version` becomes 1, and running again is a no-op;
  - WAL mode and `synchronous = FULL` are set;
  - `device.name` rejects 0 and 61 characters.
- [ ] T018 Implement `server/src/adapters/sqlite/migrations.ts` and `open-database.ts` on `node:sqlite`, with the `better-sqlite3` fallback behind the same interface if needed (R3), to turn T017 green.
- [ ] T019 Write `server/src/adapters/sqlite/sqlite-store.test.ts`, which runs every T015 suite on an in-memory migrated database. Then implement `server/src/adapters/sqlite/sqlite-store.ts` to turn it green.
- [ ] T020 [P] Write failing tests in `server/src/adapters/crypto/crypto.test.ts`, then implement `server/src/adapters/crypto/crypto.ts`:
  - pairing codes are 8 characters from the alphabet without `0 O 1 I L`, formatted `XXXX-XXXX`;
  - `normalizeCode` accepts lower case and a missing dash;
  - credentials are 32 random bytes in base64url;
  - `sha256Hex` matches known vectors.
- [ ] T021 [P] Write failing tests in `server/src/adapters/error-reporting/sentry-error-reporter.test.ts`, with `@sentry/node` mocked, then implement it and `console-error-reporter.ts` ([research.md](research.md) R15):
  - `init` with `sendDefaultPii: false`, the release and the environment;
  - `beforeSend` drops request bodies, headers and cookies;
  - `report` sends only `{ operation, route }` tags;
  - `report` never throws.

### Server: pairing ([contracts/sync-api.md](contracts/sync-api.md))

- [ ] T022 Write failing use case tests on fakes in `server/src/application/use-cases/pairing.test.ts`.
  - **`claimPairingCode(code, deviceName)`**:
    - a valid code creates a device with only the credential's SHA-256 stored, marks the code used, and returns `{ deviceId, credential }` (US4-4);
    - an unknown, expired (older than 10 minutes) or used code → `InvalidCode`, recorded as a failure (US4-5);
    - the 6th failure within any rolling 10 minutes → `TooManyAttempts` with the seconds to wait, persisting across a new store instance (FR-019b, US4-12);
    - `deviceName` is trimmed, 1–60 characters.
  - **`createPairingCode(createdBy | null)`**: it returns a code that expires in 10 minutes and stores only its hash (US4-2, US4-3).
- [ ] T023 Implement `server/src/domain/pairing.ts` and `server/src/application/use-cases/claim-pairing-code.ts` / `create-pairing-code.ts` to turn T022 green.
- [ ] T024 Write failing HTTP tests with Fastify `inject` in `server/src/adapters/http/app.test.ts`, for the common rules and the pairing routes:
  - every response carries `serverId`, `apiVersion: 1` and `minAppVersion`;
  - `X-App-Version` below `minAppVersion` → `426 UpdateRequired`, nothing read;
  - a missing, unknown or revoked credential → `401 DeviceNotAuthorized` before any read;
  - a body over 1 MB → `400`;
  - `GET /v1/health` with no auth;
  - `POST /v1/pairing/claim` → `200` / `400 InvalidCode` / `429 TooManyAttempts` with `Retry-After`;
  - `POST /v1/pairing-codes` (auth) → `{ code, expiresAt }`;
  - an unexpected throw → `500 ServerError`, reported with `{ operation, route }`.
- [ ] T025 Implement `server/src/adapters/http/app.ts` (`buildApp(deps)`), `auth.ts` (the Bearer hook), `schemas.ts` (JSON schemas from [contracts/sync-api.md](contracts/sync-api.md)), `errors.ts` and `routes/{health,pairing}.ts` to turn T024 green.
- [ ] T026 Write a failing test, then implement the Pi command in `server/src/composition/pairing-code.ts` (`npm run pairing-code -w server`). It opens the database, creates a code with `created_by = NULL`, and prints exactly `Code d'appairage : ABCD-EF23 (valable 10 minutes)`.
- [ ] T027 Implement `server/src/composition/main.ts`:
  - open and migrate the database at `MES_COURSES_DB` (default `/var/lib/mes-courses/mes-courses.db`, or `server/.data/` in dev);
  - pick the Sentry reporter when `SENTRY_DSN` is set, the console one otherwise;
  - listen on `127.0.0.1:3000` only.

  Then implement `server/src/testing/start-test-server.ts`: `startTestServer({ clock? })` starts `buildApp` on `127.0.0.1` with a random port and an in-memory database, and returns `{ url, createPairingCode(), close() }`. Cover `main` with a test that starts and stops it on a temporary file.

### App: migration, ports, adapters, connection ([contracts/app-ports.md](contracts/app-ports.md))

- [ ] T028 Write failing tests for migration 2 in `src/adapters/sqlite/migrations.test.ts`:
  - `pending_change` and `sync_state` are created exactly as in [data-model.md](data-model.md#changes-to-001s-schema-migration-2), with `kind IN ('category','article','list','listItem')` and `snapshot_done IN (0, 1)`;
  - `category.position` is no longer `UNIQUE`, and two equal positions insert;
  - `created_hlc` is added to `category`, `article` and `shopping_list`, existing rows getting the encoded `MIN(deviceId)` stamp;
  - existing rows and `list_item` data survive the table rebuild;
  - `user_version` = 2;
  - it runs in one transaction.
- [ ] T029 Implement migration 2 in `src/adapters/sqlite/migrations.ts` to turn T028 green. Update the category SQLite repository and the read models to order by `(position, created_hlc, id)` through `compareCategories`, keeping 001's ordering tests green.
- [ ] T030 Declare the app ports in `src/application/ports/`, with exactly the signatures of [contracts/app-ports.md](contracts/app-ports.md#new-driven-ports-srcapplicationports):
  - `change-recorder.ts`, `sync-state.ts` and `pulled-rows.ts`, added to `Repositories`;
  - `clock.ts`, `sync-server.ts` and `credential-store.ts`.
- [ ] T031 Write the contract suites in `src/application/testing/contracts/`:
  - `change-recorder.contract.ts`:
    - `record` stamps a strictly increasing HLC from the `Clock`;
    - `pending` excludes held entries and keeps order;
    - `release`, `releaseAll`, `discard`, `acknowledge`;
    - `count` excludes held entries;
    - a `run` that throws leaves no entry.
  - `sync-state.contract.ts`: the defaults (`lastSeq = 0`, `snapshotDone = false`), and `save` then `get`.

  Run them on fakes in `src/application/testing/in-memory-repositories.test.ts` and on SQLite in `src/adapters/sqlite/sqlite-repositories.test.ts`, and confirm they fail.
- [ ] T032 Implement the fakes in `src/application/testing/in-memory-repositories.ts` and `FakeClock` in `src/application/testing/fake-clock.ts`. Implement the SQLite versions in `src/adapters/sqlite/change-recorder.ts` and `src/adapters/sqlite/sync-state-repository.ts`. Together they turn T031 green.
- [ ] T033 [P] Implement `SystemClock` (`Date.now()`) in `src/adapters/clock/system-clock.ts`. Implement `CredentialStore` over `expo-secure-store` in `src/adapters/secure-store/credential-store.ts`, test-first with the module mocked, plus `InMemoryCredentialStore` in `src/application/testing/`. Install `expo-secure-store` with `npx expo install`.
- [ ] T034 Write failing tests for the `SyncServer` HTTP adapter in `src/adapters/sync-http/sync-server.test.ts`, against `startTestServer()` from `server/src/testing/`:
  - `health` returns `HealthInfo`;
  - `claim` maps `200` / `400` / `429` to `Pairing` / `InvalidCode` / `TooManyAttempts` (with minutes to wait);
  - each request sends `X-App-Version` and, when authenticated, `Authorization: Bearer`;
  - connection refused or a timeout of 10 s → `Offline` / `ServerUnreachable`;
  - a TLS verification error, simulated by an injected `fetch` that throws the platform's TLS error, → `UntrustedServer` and never a retry over `http://`;
  - `401` → `DeviceNotAuthorized`, `426` → `UpdateRequired`, `5xx` → `ServerError`.
- [ ] T035 Implement `src/adapters/sync-http/sync-server.ts` (over `fetch`, with an injectable `fetch` and timeout) to turn the T034 tests for `health` and `claim` green. The other methods follow in the stories.
- [ ] T036 Write failing use case tests in `src/application/use-cases/connect-to-server.test.ts`, on fakes and a fake `SyncServer`:
  - "courses.example.fr" becomes `https://courses.example.fr`;
  - `http://` → `InvalidUrl`, unless the composition passes `allowInsecure` (development only);
  - `health` is called before `claim`, and `ServerUnreachable` / `UntrustedServer` change nothing;
  - `InvalidCode` and `TooManyAttempts` change nothing;
  - on success the credential goes to `CredentialStore` only, and `sync_state` stores `serverUrl`, `serverId` and `deviceId`, with `lastSeq = 0` and `snapshotDone = false`.
- [ ] T037 Implement `src/application/use-cases/connect-to-server.ts` to turn T036 green. Add it to `UseCases` and to `src/composition/composition-root.ts`, with `SystemClock`, `CredentialStore` and `SyncServer` wired, and `allowInsecure` only when `__DEV__ && EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL === '1'`.

**Checkpoint**: a development build can pair with a local server. Every existing test and the architecture test are green.

---

## Phase 3: User Story 1 - My data is kept on my home server (Priority: P1) 🎯 MVP

**Goal**: every change of one device reaches the server automatically, offline changes wait in a
durable outbox, undone changes never leave the device, and a new install gets everything back.

**Independent Test**: on one device, make changes online and offline, and check they all reach
the server. Reinstall, connect, and check every list, item, tick and quantity is back.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [ ] T038 [P] [US1] Write failing server domain tests in `server/src/domain/apply-change.test.ts` ([data-model.md](data-model.md#server-database-pi-sqlite)):
  - a create sets every field with its HLC and `createdHlc`;
  - an update writes a field only when `mergeField` keeps the incoming value;
  - changes to different fields are both kept (FR-009);
  - `listItem.present = false` is not reset by `inCart` or `quantity` changes (FR-011);
  - `article.deleted` sets `deletedHlc`, and any later change to it is ignored (FR-011);
  - a change for an unknown entity is ignored;
  - every touched row gets the new `seq`.
- [ ] T039 [P] [US1] Write failing use case tests in `server/src/application/use-cases/sync.test.ts`, on fakes:
  - changes are applied in request order;
  - a replayed `changeId` is acknowledged and not applied again (FR-006);
  - a change with no effect is still acknowledged;
  - the response carries every row with `seq > lastSeq`, tombstones included (R7), plus the new `seq` and the server's HLC;
  - more than 5,000 rows → `more: true` and paging;
  - more than 500 changes → `400`;
  - the device's `lastSyncAt` is set;
  - a failure midway applies nothing (one transaction).
- [ ] T040 [P] [US1] Write failing HTTP tests for `POST /v1/sync` in `server/src/adapters/http/sync-route.test.ts`, with `inject` and a real SQLite store: the schema rejects a bad body with nothing applied, `401` for a revoked device, and a round trip with a fake clock.
- [ ] T041 [P] [US1] Write failing tests in `src/adapters/sqlite/pulled-rows-applier.test.ts`, on a migrated `node:sqlite` database:
  - pulled rows are upserted into `category`, `article`, `shopping_list` and `list_item`;
  - a `listItem` with `present = false` deletes the local row;
  - a deleted or merged article deletes the local article and its items;
  - fields with a pending local change are skipped;
  - a row that would break `UNIQUE (normalized_name)` against a pending local create is deferred and counted, not failed (R8);
  - `app_state.current_list_id` is never touched (FR-015).
- [ ] T042 [P] [US1] Write failing use case tests in `src/application/use-cases/synchronize.test.ts`, with fakes and a fake `SyncServer`:
  - `notConnected` when there is no `serverUrl`;
  - the first cycle pushes a snapshot of every local row and field stamped with `MIN(deviceId)` before the outbox, then sets `snapshotDone` (R13, US1-6);
  - outbox entries are pushed in order, in batches of at most 500, until empty (US1-3);
  - acknowledged entries are removed, rows applied, `lastSeq` saved, the HLC received;
  - `Offline` → `waiting`, with nothing lost;
  - `DeviceNotAuthorized` or a different `serverId` → `disconnectedByServer`, keeping every row and pending change (FR-018a);
  - `UpdateRequired` → `updateRequired`;
  - `more: true` → pull again.
- [ ] T043 [P] [US1] Write failing tests for `releaseHeldChanges(undoId)` in `src/application/use-cases/release-held-changes.test.ts`, and extend `src/application/use-cases/initialize-store.test.ts`: at every start it calls `changes.releaseAll()`, so a deletion left held by a killed app becomes final (R10).
- [ ] T044 [P] [US1] Write failing store and scheduler tests in `src/adapters/ui/state/sync-scheduler.test.ts`, with Jest fake timers and a mocked React Native `AppState`:
  - a cycle runs at start;
  - a cycle runs on coming back to the foreground;
  - a cycle runs 1 s after a write (debounced);
  - a cycle runs every 5 s in the foreground, and none in the background;
  - never two cycles at once;
  - after failures the delay backs off 5 s → 10 s → … → 5 min, and resets on success;
  - after a cycle that pulled rows, the store runs `refresh()`.
- [ ] T045 [US1] Write failing tests in `src/adapters/ui/state/app-store.undo-sync.test.ts`: when an undo offer ends (5 s, the next write, dismissal, or a new undo replacing it), the store calls `releaseHeldChanges(undoId)`; "Annuler" calls the restore, which discards the held entries.
- [ ] T046 [US1] Write failing screen tests in `src/adapters/ui/screens/settings-screen.test.tsx` and `src/adapters/ui/screens/connect-server-screen.test.tsx`, through `renderWithStore` and the texts of [contracts/ui-screens.md](contracts/ui-screens.md):
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
- [ ] T047 [US1] Write a failing cross-stack scenario test in `test/sync/single-device.test.ts`: one app stack on SQLite (`node:sqlite`) with the real `SyncServer` adapter, the real use cases and a fake clock, against `startTestServer()`.
  - 003 US1-1: a tick reaches the server after one cycle.
  - 003 US1-2 / US1-3: with the server closed, add, tick, rename and delete; nothing fails; restart the server and the changes arrive in order, none twice.
  - 003 US1-4: rebuild the app stack on the same database, as a killed app would; the outbox is still sent.
  - 003 US1-5: a fresh app stack paired with the same server gets every list, item, tick, quantity, article and category, with no second default category or "Ma liste".
  - 003 US1-6: data made before pairing reaches an empty server.
  - 003 US1-7: delete with undo, then restore; the server never sees the deletion.

### Implementation for User Story 1

- [ ] T048 [US1] Implement `server/src/domain/apply-change.ts` to turn T038 green.
- [ ] T049 [US1] Implement `server/src/application/use-cases/sync.ts` to turn T039 green.
- [ ] T050 [US1] Implement `server/src/adapters/http/routes/sync.ts` and its schema to turn T040 green.
- [ ] T051 [US1] Implement `src/adapters/sqlite/pulled-rows-applier.ts` to turn T041 green.
- [ ] T052 [US1] Add `sync` to `src/adapters/sync-http/sync-server.ts`, extending `sync-server.test.ts` first with a round trip against `startTestServer()`.
- [ ] T053 [US1] Implement `src/application/use-cases/synchronize.ts` to turn T042 green.
- [ ] T054 [US1] Implement `src/application/use-cases/release-held-changes.ts` and call `changes.releaseAll()` in `initialize-store.ts`, to turn T043 green.
- [ ] T055 [P] [US1] Test-first, record the seeded categories (`name`, `position`) and the first list (`name`) with `changes.record` in `src/application/use-cases/initialize-store.ts` ([contracts/app-ports.md](contracts/app-ports.md#changes-to-existing-use-cases-001-and-002)). Keep every existing test green.
- [ ] T056 [P] [US1] Test-first, record `listItem.inCart` in `src/application/use-cases/toggle-item-in-cart.ts`.
- [ ] T057 [P] [US1] Test-first, record `listItem.inCart = false` for each item ticked at that moment, with one HLC, in `src/application/use-cases/finish-shopping.ts` (FR-013).
- [ ] T058 [P] [US1] Test-first, record `listItem { listId, articleId, present: true, inCart: false, quantity }` in `src/application/use-cases/add-article-to-list.ts`.
- [ ] T059 [P] [US1] Test-first, record `article { name, categoryId }` and then the `listItem` in `src/application/use-cases/create-article-and-add-to-list.ts`. The article's change must come first.
- [ ] T060 [P] [US1] Test-first, record `listItem.quantity` in `src/application/use-cases/change-item-quantity.ts`.
- [ ] T061 [P] [US1] Test-first, record `listItem.present = false` **held** by a new `undoId`, returned in `RemovedItem`, in `src/application/use-cases/remove-item-from-list.ts`.
- [ ] T062 [P] [US1] Test-first, call `changes.discard(removed.undoId)` and record nothing in `src/application/use-cases/restore-removed-item.ts`.
- [ ] T063 [P] [US1] Test-first, record `list.name` in `src/application/use-cases/create-list.ts`, and assert `set-current-list.ts` records nothing (FR-015).
- [ ] T064 [P] [US1] Test-first, record `category { name, position }` in `src/application/use-cases/create-category.ts`.
- [ ] T065 [P] [US1] Test-first, record only the changed fields (`article.name` and/or `article.categoryId`) in `src/application/use-cases/edit-article.ts` (002).
- [ ] T066 [P] [US1] Test-first, record `article.deleted = true` **held** by a new `undoId`, returned in `DeletedArticle`, in `src/application/use-cases/delete-article.ts` (002).
- [ ] T067 [P] [US1] Test-first, call `changes.discard(deleted.undoId)` in `src/application/use-cases/restore-deleted-article.ts` (002).
- [ ] T068 [US1] Add the `sync` slice (`connection`, `status`, `pendingCount`, `lastSyncAt`, per [research.md](research.md) R14) and the `connectToServer` action to `src/adapters/ui/state/app-store.ts`. Implement `src/adapters/ui/state/sync-scheduler.ts`. Release held changes when an undo offer ends. Together these turn T044–T045 green. Start the scheduler from `src/composition/composition-root.ts`.
- [ ] T069 [US1] Implement `src/adapters/ui/screens/SettingsScreen.tsx` (not-connected and server sections) and `src/adapters/ui/screens/ConnectServerScreen.tsx`. Add the "Réglages" Appbar action (cog icon) to `CurrentListScreen.tsx`, and the routes to `src/adapters/ui/navigation.tsx`. This turns T046 green.
- [ ] T070 [US1] Make `test/sync/single-device.test.ts` (T047) green, fixing only what it reveals, each fix with its own failing unit test first.

**Checkpoint**: one device syncs with the server and survives reinstalling. This is the first half of the MVP.

---

## Phase 4: User Story 2 - The same data on several devices (Priority: P1)

**Goal**: changes flow between one user's devices, and concurrent changes settle by the spec's
rules, identically everywhere.

**Independent Test**: connect two devices to one server. Make changes on both, online and then
offline at the same time, and check they end identical after syncing, per US2's rules.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [ ] T071 [P] [US2] Write failing server domain tests in `server/src/domain/merge-by-name.test.ts` ([research.md](research.md) R8):
  - two categories, two articles or two lists with the same `normalizedName` → the survivor is the smaller `(createdHlc, id)`, and the other is tombstoned with `mergedInto`;
  - a merged article's list items move to the survivor, and are merged field by field when the survivor is already on that list;
  - a merged category's articles move;
  - a merged list's items move;
  - a later change to a merged id is redirected, following chains;
  - a rename that collides triggers the same merge (spec edge case);
  - all of it happens in the transaction of the change that caused it.
- [ ] T072 [P] [US2] Extend `server/src/application/use-cases/sync.test.ts` with failing tests:
  - an incoming HLC more than 60 s ahead of the server clock is clamped, so a device with its clock in the future does not win a later honest change made 2 minutes after (spec edge case "wrong clock");
  - the server's HLC returned to a slow device makes that device's next change win over older ones.
- [ ] T073 [US2] Write failing two-device scenario tests in `test/sync/two-devices.test.ts`: two app stacks (A and B) on separate databases, one `startTestServer()`, and a fake clock shared or skewed per test. Each US2 scenario of the spec is one test, with both devices offline (server closed) between their changes:
  - 003 US2-1: "Pain" added on A appears on B after B's next cycle;
  - 003 US2-2: A ticks, then B unticks later → unticked on both;
  - 003 US2-3: a rename on A and a quantity change on B → "Lait entier, 2 L" on both;
  - 003 US2-4: both create "Houmous" / " houmous " and add it to lists → one article, items kept; the same for categories and lists;
  - 003 US2-5: A deletes "Lait" and B ticks or renames it → deleted on both;
  - 003 US2-6: A removes "Pain" and B changes its quantity → removed on both;
  - 003 US2-7: A finishes shopping, then B ticks "Œufs" later → only "Œufs" ticked;
  - 003 US2-8: two new categories → both after the existing ones, same order on both;
  - 003 US2-9: each device keeps its own current list;
  - 003 FR-017 / SC-007: B with its own seeded defaults and data joins a server holding A's data → no duplicated default category or "Ma liste", and B's own articles are added;
  - SC-003: after every scenario, A's and B's full read models are deep-equal.
- [ ] T074 [US2] Write a failing scenario test in `test/sync/reset-server.test.ts` (FR-018a):
  - both devices hold data, then the server is replaced by an empty one with a new `serverId`;
  - each device reports `disconnectedByServer` and keeps its data and outbox;
  - A pairs again and repopulates; B pairs again and merges with no duplicates;
  - A's and B's read models are deep-equal at the end.

### Implementation for User Story 2

- [ ] T075 [US2] Implement `server/src/domain/merge-by-name.ts` and call it from `apply-change.ts` on creates and renames, to turn T071 green.
- [ ] T076 [US2] Add the HLC clamp and the server HLC state to `server/src/application/use-cases/sync.ts` to turn T072 green.
- [ ] T077 [US2] Make `test/sync/two-devices.test.ts` (T073) and `test/sync/reset-server.test.ts` (T074) green. Every production fix they force starts with its own failing unit test in the layer where it belongs: `sync-core`, server domain, `PulledRowsApplier` or `synchronize`.

**Checkpoint**: US1 and US2 together form the MVP. The server is the source of truth, and every
device converges.

---

## Phase 5: User Story 3 - I can see whether my changes are saved on the server (Priority: P2)

**Goal**: one discreet status on every data screen (saved, waiting with a count, sending,
failed with "Réessayer"), offline never shown as an error, and "Synchroniser maintenant".

**Independent Test**: watch the status online (sending, then saved), offline (waiting) and with
the server failing (failed, then "Réessayer").

### Tests for User Story 3 ⚠️ (write first, confirm they fail)

- [ ] T078 [P] [US3] Write failing store tests in `src/adapters/ui/state/app-store.sync-status.test.ts`, following the transitions of [data-model.md](data-model.md#sync-status-ui-store-syncstatus-us3):
  - a local write → `waiting` with `pendingCount`;
  - a cycle → `sending`, then `saved` when the outbox is empty;
  - `Offline` → `waiting`, never reported (FR-022);
  - `ServerError`, a bad response or `UntrustedServer` three times in a row → `failed`, reported once per streak with `{ operation: 'sync' }`;
  - a success resets the streak;
  - `syncNow()` starts a cycle at once (US3-5);
  - `retry()` from `failed` starts a cycle.
- [ ] T079 [P] [US3] Write failing component tests in `src/adapters/ui/components/sync-status-bar.test.tsx`, with the texts of [contracts/ui-screens.md](contracts/ui-screens.md#syncstatusbar-new-shared-component-fr-020):
  - "Synchronisé" (US3-1);
  - "En attente de synchronisation (3)", with the accessibility label "3 modifications", and no error color (US3-2);
  - "Synchronisation…" (US3-3);
  - "Échec de la synchronisation" with "Réessayer" (US3-4);
  - hidden when `notConnected`;
  - "Mettez à jour l'application pour synchroniser." when `updateRequired`;
  - `accessibilityLiveRegion="polite"` (US3-6);
  - ≥ 48 dp with a button;
  - tapping it opens Settings.
- [ ] T080 [US3] Write failing screen tests: CurrentList, AddArticles, Lists, EditArticle and Settings each render `SyncStatusBar` under their Appbar. Settings' server section shows "Synchroniser maintenant" (US3-5). Put them in the existing `*-screen.test.tsx` files.

### Implementation for User Story 3

- [ ] T081 [US3] Implement the status transitions, the failure streak, `syncNow()` and `retry()` in `src/adapters/ui/state/app-store.ts` and `src/adapters/ui/state/sync-scheduler.ts` to turn T078 green.
- [ ] T082 [P] [US3] Implement `src/adapters/ui/components/SyncStatusBar.tsx` (Paper only, theme tokens) to turn T079 green.
- [ ] T083 [US3] Render `SyncStatusBar` in `CurrentListScreen.tsx`, `AddArticlesScreen.tsx`, `ListsScreen.tsx`, `EditArticleScreen.tsx` and `SettingsScreen.tsx`, and add "Synchroniser maintenant" to Settings, to turn T080 green.

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

- [ ] T084 [P] [US4] Write failing server use case tests in `server/src/application/use-cases/devices.test.ts`:
  - `listDevices` excludes revoked ones and returns `{ id, name, createdAt, lastSyncAt }` (US4-8);
  - `renameDevice` trims to 1–60 characters, or `NotFound`;
  - `revokeDevice` sets `revokedAt`, and the next request from that device is refused (US4-9, SC-009);
  - a device may revoke itself (US4-11).
- [ ] T085 [P] [US4] Write failing HTTP tests in `server/src/adapters/http/devices-route.test.ts` for `GET /v1/devices`, `PATCH /v1/devices/:id` and `DELETE /v1/devices/:id` (`200`/`204`/`404`, auth required).
- [ ] T086 [P] [US4] Write failing app use case tests in `src/application/use-cases/`, one file each, on fakes and a fake `SyncServer`:
  - `create-pairing-code.test.ts`: US4-3, and `Offline`;
  - `list-devices.test.ts`: marks `isThisDevice`;
  - `rename-device.test.ts`: 001's `validateName` errors;
  - `revoke-device.test.ts`: US4-9;
  - `disconnect.test.ts` (US4-11): it revokes itself when the server is reachable, otherwise best effort; it clears the credential and the connection fields; it keeps the local data and the outbox; `connection` becomes `notConnected`.
- [ ] T087 [US4] Extend `src/adapters/sync-http/sync-server.test.ts` with failing tests for `createPairingCode`, `listDevices`, `renameDevice` and `revokeDevice` against `startTestServer()`.
- [ ] T088 [US4] Write failing screen tests in `src/adapters/ui/screens/settings-screen.test.tsx`, with the texts of [contracts/ui-screens.md](contracts/ui-screens.md#settings-new-screen):
  - the Appareils section: rows with the name, "Dernière synchronisation : …" and "Cet appareil"; loading; error "Impossible de charger les appareils." with "Réessayer"; offline "Liste des appareils indisponible hors connexion." (not reported);
  - "Renommer" dialog;
  - "Révoquer « … » ?" dialog with "Cet appareil ne pourra plus synchroniser. Ses données restent sur l'appareil.", not offered on this device;
  - "Déconnecter cet appareil ?" dialog;
  - `PairingCodeDialog` "Ajouter un appareil" showing "ABCD-EF23" and "Valable jusqu'à {heure}.", with the offline message "Connexion au serveur nécessaire pour ajouter un appareil.";
  - with `connection = disconnectedByServer`, the bar shows "Cet appareil n'est plus connecté au serveur." and "Se reconnecter" opens ConnectServer (US4-10).
- [ ] T089 [US4] Write a failing scenario test in `test/sync/revocation.test.ts`:
  - A creates a code and B claims it (US4-3, US4-4);
  - A revokes B; B's next cycle → `disconnectedByServer`, with B's data and outbox kept (US4-10, SC-009);
  - B pairs again with a new code and its waiting changes are sent;
  - B disconnects itself and the server data is untouched (US4-11);
  - six wrong codes → `TooManyAttempts` (US4-12).

### Implementation for User Story 4

- [ ] T090 [US4] Implement `server/src/application/use-cases/{list-devices,rename-device,revoke-device}.ts` and `server/src/adapters/http/routes/devices.ts` to turn T084–T085 green.
- [ ] T091 [US4] Add `createPairingCode`, `listDevices`, `renameDevice` and `revokeDevice` to `src/adapters/sync-http/sync-server.ts` to turn T087 green.
- [ ] T092 [US4] Implement `src/application/use-cases/{create-pairing-code,list-devices,rename-device,revoke-device,disconnect}.ts` to turn T086 green. Add them to `UseCases`, to the composition root and to store actions in `src/adapters/ui/state/app-store.ts`.
- [ ] T093 [US4] Implement the Appareils and Actions sections of `SettingsScreen.tsx`, `src/adapters/ui/screens/PairingCodeDialog.tsx`, `RenameDeviceDialog.tsx`, `RevokeDeviceDialog.tsx`, `DisconnectDialog.tsx`, and the "Se reconnecter" action of `SyncStatusBar`, to turn T088 green.
- [ ] T094 [US4] Make `test/sync/revocation.test.ts` (T089) green. Each fix it forces starts with its own failing unit test first.

**Checkpoint**: all four stories work. Devices are paired, managed and revoked from the app.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T095 [P] Add `deploy/Caddyfile` (`{$MES_COURSES_DOMAIN}` → `reverse_proxy 127.0.0.1:3000`, with automatic HTTPS), `deploy/mes-courses.service` (user `mes-courses`, `EnvironmentFile=/etc/mes-courses.env`, `Restart=always`, `NODE_ENV=production`) and `deploy/mes-courses.env.example` (variable names only, no values) ([research.md](research.md) R17).
- [ ] T096 [P] Extend `src/adapters/ui/state/error-context.test.ts` (001) and add `server/src/adapters/error-reporting/report-context.test.ts`. Every report raised in the 003 tests carries only the allowed fields. Scan the serialized reports for the test URL, device names, codes, credentials and article names, and fail if any is found (FR-022, FR-022a).
- [ ] T097 [P] Extend `src/adapters/ui/screens/accessibility.test.tsx` (001) to Settings, ConnectServer, the device dialogs, `PairingCodeDialog` and `SyncStatusBar`: French labels on every interactive element and ≥ 48 dp targets (FR-023).
- [ ] T098 Extend 001's offline scenario `src/adapters/ui/offline.test.tsx` with a connected device whose `SyncServer` always returns `Offline`. Every 001 and 002 action still succeeds, the status is `waiting`, and nothing is reported (FR-003, SC-004).
- [ ] T099 Add a test in `test/sync/performance.test.ts`:
  - a new device restores 500 articles, 5 lists and 300 items from `startTestServer()`, with the cycle loop finishing (asserted as at most 2 sync requests at the 5,000-row page size, SC-005);
  - a local tick's handler never awaits the scheduler (SC-004).
- [ ] T100 Update `README.md`:
  - the workspaces (`server/`, `packages/sync-core/`);
  - running the server in development (`npm run dev -w server`, `npm run pairing-code -w server`);
  - the Pi and Freebox setup, referring to [quickstart.md](quickstart.md) §3;
  - the environment variables `SENTRY_DSN`, `MES_COURSES_DB`, `MES_COURSES_DOMAIN` and `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL` (development only).
- [ ] T101 Run [quickstart.md](quickstart.md) §1–§2 locally. With the maintainer, who does the Freebox, DNS and Pi actions of §3, deploy to the Pi and check `curl https://<domain>/v1/health` from mobile data and from the home Wi-Fi. Then run the 15 scenarios of §4 and §5 on a phone and a tablet. Record results, and anything not checked, in the pull request's test plan.
- [ ] T102 Update `specs/001-shopping-lists/plan.md` and `specs/002-manage-articles/plan.md`: mark their Principle VII deviation in Complexity Tracking as closed by 003, now implemented.

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
- **US4 (Phase 6)**: after US1. It is independent of US2 and US3, except for the shared files `SettingsScreen.tsx` and `SyncStatusBar.tsx` (T093 after T082).
- **Polish (Phase 7)**: after the stories it covers. T101 needs the maintainer's network setup.

### Within Each User Story

Tests come first and are seen failing. Then sync-core → server domain → server use cases → HTTP
→ app adapters → app use cases → store → screens → cross-stack scenarios. Each green step is
followed by a refactor and a commit.

### Parallel Opportunities

- Setup: T003, T004 and T007.
- Foundational:
  - T008–T013, sync-core files in pairs;
  - T020 and T021 beside the server store;
  - the whole app track (T028–T033) beside the server track (T014–T027).
- US1: T038–T044 are seven independent test files; T055–T067 are thirteen use cases in thirteen files.
- US2: T071 and T072.
- US3: T078 and T079; T082 beside T081.
- US4: T084, T085 and T086.
- Polish: T095, T096 and T097.

---

## Parallel Example: User Story 1

```bash
# Red: independent test files
Task: "T038 server/src/domain/apply-change.test.ts"
Task: "T039 server/src/application/use-cases/sync.test.ts"
Task: "T041 src/adapters/sqlite/pulled-rows-applier.test.ts"
Task: "T042 src/application/use-cases/synchronize.test.ts"
Task: "T044 src/adapters/ui/state/sync-scheduler.test.ts"

# Recording changes: one use case per task, all in parallel
Task: "T056 toggle-item-in-cart.ts"
Task: "T057 finish-shopping.ts"
Task: "T061 remove-item-from-list.ts (held)"
Task: "T066 delete-article.ts (held)"
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

Each pull request is merged only when `gh pr checks` is all green (constitution, Quality Gates).

---

## Notes

- [P] tasks touch different files and depend on no unfinished task.
- Never delete, skip or weaken a test to make a change go green (Principle I).
- The Freebox, DNS and Pi steps in [quickstart.md](quickstart.md) §3 are the maintainer's.
  Tasks only check them (T101).
- A deletion or removal that is undone never reaches the server (FR-008): held outbox entries
  are the only mechanism, so any new undoable change must record its changes held.
