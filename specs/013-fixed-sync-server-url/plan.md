# Implementation Plan: Fixed Sync Server URL

**Branch**: `feat/issue-197-make-the-sync-server-url-fixed-and-remove-it-from-the-app-ui` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-fixed-sync-server-url/spec.md` (issue #197)

## Summary

The sync server address stops being user input. The composition root reads `EXPO_PUBLIC_DEFAULT_SERVER_URL` once, validates it (`normalizeUrl`, https unless the dev-only insecure flag), and hands the result to the use cases as a plain `serverUrl` dependency. `signIn`, `chooseInitialPassword`, `requestPasswordReset`, `currentConnection` and `synchronize` use it instead of a typed or stored address. A missing or invalid value makes `composeApp` throw a `ServerUrlNotConfigured` error naming the variable before the database opens (shown as the existing start-up error and reported); the `android-apk.yml` workflow fails earlier with the same message. The UI loses the address field (SignIn), the address row title (Settings) and the `url` carried to ChoosePassword and ForgotPassword. The dead `change-server-url` use case, its store action and tests go. "Connected" is keyed on `deviceId` (and the credential), not on `sync_state.serverUrl`, which stays in the column, unread and no longer written. No migration, no protocol change, no server change. See [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6; React Native (Expo) app; GitHub Actions workflow

**Primary Dependencies**: none new

**Storage**: unchanged; `sync_state.server_url` kept as a legacy column (no migration)

**Testing**: Jest (use cases on in-memory doubles, React Native Testing Library, composition-root test), `tests/sync` against a real test server, Detox journey `sync-unreachable`, shell-free workflow check (`actionlint`-style review)

**Target Platform**: Android (iOS paths kept, not delivered)

**Project Type**: monorepo (mobile app, sync server, shared package); only `apps/mobile`, `tests/sync`, `tests/e2e`, the workflow and docs change

**Performance Goals**: none

**Constraints**: offline-first (VII); French text only in the UI adapter (X); hexagonal layers enforced by dependency-cruiser (VI)

**Scale/Scope**: 1 new composition module, 5 use cases/helpers changed, 3 screens changed, 1 use case + 1 store action + 3 test files deleted, ~15 test fixtures lose `serverUrl`, 1 workflow step, 1 e2e build env, 2 docs

## Constitution Check

| Principle | Verdict |
| --- | --- |
| I Test-First | Pass. Every task states its failing test first, in the same commit as the change (tasks.md). |
| II Executable specification | Pass. Each acceptance scenario maps to a test (traceability in tasks.md). |
| III Fast, deterministic | Pass. The URL is injected; tests pass a literal, never read the real environment except the composition test, which sets and restores it. |
| IV Simplicity | Pass. Removes code (use case, field, params). One small config module; no new setting, no migration. |
| V Single design system | Pass. Only removes a field and a title; nothing visual added. |
| VI Hexagonal | Pass. The environment is read only in `composition/`; application code receives a string. |
| VII Offline first | Pass. Sign-in already needs the server (004); sync and offline behavior unchanged. Tests keep the unreachable-server cases. |
| VIII Error tracking | Pass. The configuration error is thrown inside `composeApp`, so App.tsx reports it as the existing `startup` operation; its message holds the variable name, never a user list. |
| IX Explicit screen states | Pass. SignIn keeps its error and saving states; start-up keeps its failed state. |
| X French interface | Pass. The start-up screen text is unchanged; the developer-facing error message is English (not user text). |
| XI Monorepo | Pass. The test helper `buildTestAppStack` and `tests/sync` change in the same PR. |

No violation; Complexity Tracking is empty. Post-design re-check: unchanged.

## Architecture Decisions

None new: the choices matter inside this feature (research.md R1 to R5). Relies on [ADR 0004](../../docs/adr/0004-detox-end-to-end-tests.md) (Detox).

## Project Structure

### Documentation (this feature)

```text
specs/013-fixed-sync-server-url/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── build-and-ui.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
apps/mobile/
├── App.test.tsx                                   # start-up failure case for a missing URL
├── test/app-stack.ts                              # buildTestAppStack passes serverUrl as a dependency
└── src/
    ├── composition/
    │   ├── server-url.ts (+ .test.ts)             # NEW: fixedServerUrl(), ServerUrlNotConfigured
    │   ├── composition-root.ts (+ .test.ts)       # reads the variable, passes serverUrl
    ├── application/use-cases/
    │   ├── connection.ts, synchronize.ts          # use the fixed serverUrl, "paired" = deviceId
    │   ├── sign-in.ts, choose-initial-password.ts, request-password-reset.ts  # no typed URL
    │   ├── store-signed-in-device.ts              # stops writing serverUrl; InvalidUrl moves out
    │   ├── get-sync-info.ts                       # connection from deviceId; no serverUrl in SyncInfo
    │   └── change-server-url.ts (+ .test.ts)      # DELETED
    ├── domain/local-copy-rule.ts                  # keyed on the paired device id
    └── adapters/ui/
        ├── use-cases.ts                           # dep `serverUrl`; changeServerUrl removed
        ├── state/{device-actions,sync-actions,store-kit,app-store,accounts-actions}.ts
        ├── state/error-context.test.ts            # two changeServerUrl cases removed
        ├── testing/story-store.ts                 # `connected` loses serverUrl
        └── screens/{SignInScreen,SettingsScreen,ChoosePasswordScreen,ForgotPasswordDialog}.tsx
tests/sync/src/
├── change-server-url.test.ts                      # DELETED
├── fixed-server-url.test.ts                       # NEW: stored URL ignored, serverId mismatch kept
└── testing/onboard.ts + files calling signIn/chooseInitialPassword
tests/e2e/.detoxrc.js, tests/e2e/journeys/sync-unreachable.e2e.ts
.github/workflows/android-apk.yml                  # fail on empty server-url
docs/sync-server.md, docs/build-time-flags.md, README.md
```

**Structure Decision**: existing hexagonal layout; the one new file lives in `composition/`, the only place allowed to read the environment and know every adapter.

## Complexity Tracking

None.
