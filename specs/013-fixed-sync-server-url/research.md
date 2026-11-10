# Research: Fixed Sync Server URL

## R1. Where the URL enters the app

**Decision**: `composeApp` reads `process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL` (written literally, so Expo inlines it), validates it with `fixedServerUrl()` in `composition/server-url.ts` (wraps `normalizeUrl`), and passes `serverUrl: string` to `createUseCases`, which gives it to the use cases that talk to the server.
**Rationale**: matches the existing pattern (`allowInsecure` is read there too); application code stays free of the environment (VI); tests pass a literal.
**Rejected**: a `ServerConfig` port (a constant needs no port, IV); reading the variable inside use cases (breaks VI and III).

## R2. Missing or invalid value at start-up

**Decision**: `fixedServerUrl` throws `ServerUrlNotConfigured` ("EXPO_PUBLIC_DEFAULT_SERVER_URL is missing or is not a valid address; set it when building the app") before `openDatabase`. `App.tsx` already turns any `composeApp` rejection into the `failed` state, reports it (`operation: 'startup'`) and shows "L'application n'a pas pu démarrer.". No new screen.
**Rationale**: the spec asks for a clear error naming the variable; the existing report carries it to Sentry. A dedicated screen would be speculative (IV); "Réessayer" retrying a build-time defect is harmless.
**Note**: the check is at start-up and in CI, not in `app.config.ts`, because Jest, Storybook and the config introspection test (`native-entry-points.test.ts`) read the config without the variable.

## R3. CI check

**Decision**: a first step of the `apk` job in `.github/workflows/android-apk.yml` fails with `::error::` naming `server-url` / `EXPO_PUBLIC_DEFAULT_SERVER_URL` when the input is blank; the input description is reworded (it is no longer a pre-fill). The input is already `required: true`, but an empty repository variable (`vars.STAGING_SERVER_URL`) still passes that check.
**Rejected**: validating only in `app.config.ts`, which would also break local tests (R2).

## R4. What "connected" means without the stored URL

**Decision**: `notConnected` is `deviceId === null` (in `synchronize`, `currentConnection`, `getSyncInfo`); sign-in no longer writes `serverUrl`; `decideLocalCopy` takes the paired device id instead of the URL (same truth table: a copy with no account but a pairing is erased). `SyncInfo`/store slice lose `serverUrl`; the column stays and is never read or written (spec assumption).
**Rationale**: reading the legacy column to decide "connected" would contradict "never read". Legacy devices have both fields, so they keep working (SC-003).
**Rejected**: keep writing `serverUrl` "for information" (dead data, IV); dropping the column (a migration for nothing).

## R5. serverId guard

**Decision**: unchanged. `synchronize.ts` already compares the `serverId` of each sync answer with the stored one and returns the mismatch outcome; sign-in stores `serverId` from the pairing. Only the removed `change-server-url` compared `health.serverId`. A `tests/sync` scenario proves both: stored URL ignored, other `serverId` reported.

## R6. End-to-end build

**Decision**: the Detox build environment (`tests/e2e/.detoxrc.js`, `build()` helper) sets `EXPO_PUBLIC_DEFAULT_SERVER_URL=https://127.0.0.1:9`; release builds refuse http, and https on a closed port gives "unreachable". The journey drops the address typing.
