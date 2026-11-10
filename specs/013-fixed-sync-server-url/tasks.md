---

description: "Task list for the fixed sync server URL"
---

# Tasks: Fixed Sync Server URL

**Input**: Design documents from `/specs/013-fixed-sync-server-url/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/build-and-ui.md

**Tests**: Each test is written first inside the task that implements it (constitution, Principle I); no test-only task, and every task leaves the fast suite green (typecheck, lint, `pnpm test`, `pnpm test:architecture`). An existing test is changed only because the behavior it states changed (address removed), never weakened.

**Organization**: the engine first (the fixed URL reaches the use cases and replaces the stored one), then the user-facing removals, then the start-up and CI checks, then dead-code removal and docs.

## Format: `[ID] [P?] [Story] Description`

Paths are under `apps/mobile/` unless stated. Stories: US1 sign in with e-mail and password, US2 Settings without the address, US3 existing devices keep working, US4 a build without the URL fails clearly.

## Phase 1: Specification

- [X] T001 Write `specs/013-fixed-sync-server-url/spec.md` (issue #197) and correct it against the code (the dialog, the button and their stories no longer exist; FR-003, FR-004, FR-007 rewritten)
- [X] T002 Write `plan.md`, `research.md`, `data-model.md`, `quickstart.md` and `contracts/build-and-ui.md`
- [X] T003 Write this `tasks.md`

---

## Phase 2: Foundational (blocking)

**Purpose**: the validated fixed URL exists and is injectable.

- [x] T004 Test first in `src/composition/server-url.test.ts` (undefined, empty, blank and malformed values throw `ServerUrlNotConfigured` whose message names `EXPO_PUBLIC_DEFAULT_SERVER_URL`; `courses.example.fr` gives `https://courses.example.fr`; `http://127.0.0.1:3000` throws unless `allowInsecure`, then passes), then implement `src/composition/server-url.ts` exporting `fixedServerUrl(raw: string | undefined, allowInsecure: boolean): string` (uses `normalizeUrl` from `src/application/use-cases/normalize-url.ts`) and the `ServerUrlNotConfigured` error class

**Checkpoint**: new module green, nothing wired yet.

---

## Phase 3: User Story 3 - Existing devices keep working (Priority: P1) and User Story 2 - Settings without the address (Priority: P1)

**Goal**: sync and requests go to the fixed URL, "connected" no longer depends on `sync_state.serverUrl`, no screen shows the address.

**Independent Test**: a device whose stored `serverUrl` is junk still syncs against the test server; another `serverId` gives the existing server-mismatch outcome; Settings shows no address.

- [X] T005 [US3] Test first (`src/application/use-cases/synchronize.test.ts`: with a stored `serverUrl` of `https://old.example.fr` the request goes to the injected `serverUrl`; no `deviceId` still answers `notConnected` with no request; the existing `serverId` mismatch case stays green; a new `tests/sync/src/fixed-server-url.test.ts` pairs a device on a test server, overwrites `sync_state.serverUrl` with a junk value, and syncs `saved`; a second stack on the same database pointed at another test server reports the mismatch outcome; connection tests for `src/application/use-cases/connection.ts`), then: `createSynchronize` and `currentConnection` take a `serverUrl` dependency and treat `deviceId === null` as not connected; `src/adapters/ui/use-cases.ts` `createUseCases` takes `serverUrl: string` and passes it on; `src/composition/composition-root.ts` computes `allowInsecure` once, calls `fixedServerUrl(process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL, allowInsecure)` before `openDatabase` (variable written literally for Expo) and passes it; `test/app-stack.ts` passes its `serverUrl` option; fix every other `createUseCases`/use-case construction in tests; `src/composition/composition-root.test.ts` covers: variable missing makes `composeApp` reject with the variable name and opens no database
- [X] T006 [US2] [US3] Test first (`src/application/use-cases/get-sync-info.test.ts`: `notConnected` without `deviceId`, `signedOut` with a device id and no credential, `connected` with both, no `serverUrl` in the result; `src/domain/local-copy-rule` test keyed on the paired device id with the same truth table; `src/adapters/ui/screens/settings-screen.test.tsx`: the "Serveur" section shows "Dernière synchronisation : …" and "Synchroniser maintenant" and no `courses.example.fr` text), then: `get-sync-info.ts` drops `serverUrl` from `SyncInfo`; `src/domain/local-copy-rule.ts` and its caller in `store-signed-in-device.ts` use the device id, and the latter stops writing `serverUrl`; `src/adapters/ui/state/{store-kit,app-store,sync-actions,accounts-actions}.ts` and `src/adapters/ui/testing/story-store.ts` drop `serverUrl`; `SettingsScreen.tsx` computes `isConnected` from `connection`, drops `server.url`, `withoutScheme` and the row title address (the row shows the last sync); remove `serverUrl` from every fixture and story that passes `connected: { serverUrl, … }` (`rg "serverUrl" src` lists them, including `SettingsScreen.stories.tsx`); keep `src/adapters/sqlite/sync-state-repository.ts` and the column untouched

**Checkpoint**: US3 and US2 work; sign-in still takes an address.

---

## Phase 4: User Story 1 - Sign in with e-mail and password only (Priority: P1) MVP

**Goal**: no screen asks for the address; sign-in, first-password choice and password reset use the fixed URL.

**Independent Test**: `sign-in-screen.test.tsx` shows no "Adresse du serveur" field and submitting calls `signIn(email, password, deviceName)`; `tests/sync` scenarios sign in without a URL.

- [X] T007 [US1] One commit (a signature change cannot be split from its callers without breaking typecheck). Test first: update `src/application/use-cases/{sign-in,choose-initial-password,request-password-reset}.test.ts` to the new signatures (no `typedUrl`; the `InvalidUrl` cases removed with the address; the unreachable-server, untrusted, mismatch and storage cases kept), `src/adapters/ui/screens/sign-in-screen.test.tsx` (no "Adresse du serveur" field, the `EXPO_PUBLIC_DEFAULT_SERVER_URL` pre-fill describe block at line ~479 removed, submit calls `signIn` with e-mail, password and device name only, unreachable message still shown), the ChoosePassword and ForgotPassword dialog tests, `src/adapters/ui/state/*test*` call sites, and `tests/sync/src/testing/onboard.ts` plus every `tests/sync/src/*.test.ts` calling `signIn`/`chooseInitialPassword`/`requestPasswordReset`; then implement: the three use cases take `serverUrl` from their dependencies and store it nowhere; remove `InvalidUrl` from `SignInError`, `ChooseInitialPasswordError`, `RequestPasswordResetError` and the `store-signed-in-device.ts` export once unused; `src/adapters/ui/state/{sync-actions,accounts-actions}.ts` and `src/adapters/ui/use-cases.ts` types; `SignInScreen.tsx` (remove address state, field, `withoutScheme`, `lastServerUrl`, the `InvalidUrl` message, the `url` navigation param), `ChoosePasswordScreen.tsx` and the route params in `src/adapters/ui/navigation.tsx` (no `url`), `ForgotPasswordDialog.tsx` (no `address` prop); update the stories of these screens; `tests/e2e/journeys/sync-unreachable.e2e.ts` stops typing "Adresse du serveur", and `tests/e2e/.detoxrc.js` `build()` sets `EXPO_PUBLIC_DEFAULT_SERVER_URL=https://127.0.0.1:9` (research R6)

**Checkpoint**: the user flow has no address anywhere.

---

## Phase 5: User Story 4 - A build without the URL fails clearly (Priority: P2)

**Goal**: a missing URL stops the delivery and the app, naming the variable.

**Independent Test**: `App.test.tsx` start-up failure shows the start-up error; the workflow's first step fails on an empty `server-url`.

- [X] T008 [US4] Test first in `App.test.tsx` (a `composeApp` rejection with `ServerUrlNotConfigured` shows "L'application n'a pas pu démarrer." and is reported once with `operation: 'startup'`, reusing the existing FR-039 mocks), then adjust `composition-root.test.ts` for the http rule (`http://` accepted only when `__DEV__` and `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1`, refused otherwise; the test sets and restores the environment); no production change expected beyond T005 unless a test fails
- [ ] T009 [P] [US4] In `.github/workflows/android-apk.yml` add, as the first step of the `apk` job, a check that fails with `::error::server-url (EXPO_PUBLIC_DEFAULT_SERVER_URL) is empty: the app cannot be built without its sync server address` when `inputs.server-url` is blank (pass it through `env`, never interpolate it in the script), and reword the input description (it is the fixed sync address of the app, no longer a sign-in pre-fill); run the step's script locally with an empty and a set value, and run `shellcheck` on it (extract to a temporary file)

**Checkpoint**: all four stories done.

---

## Phase 6: Polish and cross-cutting

- [X] T010 Delete the dead code: `src/application/use-cases/change-server-url.ts` and `.test.ts`, the `createChangeServerUrl` wiring and `changeServerUrl` type in `src/adapters/ui/use-cases.ts`, `changeServerUrl` in `src/adapters/ui/state/device-actions.ts` (and its now unused imports), the two `changeServerUrl` cases in `src/adapters/ui/state/error-context.test.ts`, and `tests/sync/src/change-server-url.test.ts`; check `required-stories.ts` has no entry to remove; `pnpm test:architecture` (no orphan) and the story-coverage test pass
- [X] T011 [P] Docs: `docs/sync-server.md` (Signing in: the person enters the address and the temporary password only; the diagram node "Sign-in screen: server address, email, password" becomes "email, password"; the environment table gains `EXPO_PUBLIC_DEFAULT_SERVER_URL`, app, required, build time), `docs/build-time-flags.md` (a line saying the fixed server URL is required, not a test flag), `README.md` Run section (dev: set `EXPO_PUBLIC_DEFAULT_SERVER_URL`, with `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1` for `http://`, required)
- [ ] T012 Final gates from the repository root: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:architecture && pnpm build`; then the Android device suite once on the final commit (`sync-unreachable` journey included, one suite at a time); `rg "Adresse du serveur|DEFAULT_SERVER_URL" apps tests docs` matches only the intended places; fill the PR test plan with the test-first progression per task

---

## Dependencies and order

- T004 before T005 (T005 imports `fixedServerUrl`). T005 before T006 and T007 (they use the injected `serverUrl`). T006 before T007 (the store and `SyncInfo` shape changes first). T008, T009 after T005 (T009 is independent of code and can run any time). T010 after T007. T011 after T010. T012 last.
- Parallel: T009 and T011 touch only the workflow and docs, so they can run beside any code task.

## Traceability

| Scenario | Task |
| --- | --- |
| US1-1, US1-2, US1-3 | T007 (`sign-in-screen.test.tsx`, `sign-in.test.ts`) |
| US2-1 | T006 (`settings-screen.test.tsx`) |
| US3-1, US3-2 | T005 (`synchronize.test.ts`, `fixed-server-url.test.ts`) |
| US4-1 | T004, T005, T008 |
| US4-2 | T009 |
| US4-3 | T004, T008 |

## Strategy

MVP is Phase 2 to Phase 4 (T004 to T007): the app signs in with e-mail and password against the fixed URL. T008 and T009 add the guard rails, T010 to T012 finish. Each task is one commit (`feat:` or `refactor:` / `docs:` / `ci:`), suite green after each.
