# Quickstart: Fixed Sync Server URL

1. Fast suite: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:architecture` from the root. Story coverage runs inside `pnpm test`.
2. Sync scenarios: `pnpm --filter @mes-courses/sync-tests test` (name per `tests/sync/package.json`), including `fixed-server-url.test.ts`.
3. Missing variable: from `apps/mobile`, `unset EXPO_PUBLIC_DEFAULT_SERVER_URL; pnpm android` shows "L'application n'a pas pu démarrer." and the report names the variable. With `EXPO_PUBLIC_DEFAULT_SERVER_URL=http://127.0.0.1:3000 EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1`, sign-in asks only for e-mail and password.
4. CI: run `android-apk` (via `deliver-staging`) with `STAGING_SERVER_URL` empty: the first step fails naming the variable.
5. Device suite (Android, one suite at a time): `sync-unreachable` journey shows the unreachable-server message without typing an address.
