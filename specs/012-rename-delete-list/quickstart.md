# Quickstart: Rename and Delete a Shopping List

## Run the checks

```sh
pnpm install
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test                 # fast suite, all workspaces
pnpm test:architecture
pnpm test:e2e:android     # build + all journeys, including rename-delete-list
```

Run one journey: `pnpm --filter @mes-courses/e2e-tests exec detox test -c android.emu.release journeys/rename-delete-list.e2e.ts` (after `pnpm --filter @mes-courses/e2e-tests run e2e:build:android`) (see `docs/procedures/e2e-tests.md`). Run the E2E suites one at a time.

## Manual check (development)

1. `pnpm --filter @mes-courses/server dev`, sign two development builds (A and B) in to it.
2. On A: Listes tab, ⋮ on "Barbecue", Modifier, rename; Supprimer another list, confirm. Sync B: same result, B's "en cours" list is valid.
3. Offline: airplane mode on A, rename and delete, check the immediate result, reconnect, sync B.

## Deployment order

The app and the server change in one PR but are delivered separately: update the server first. A new app on an old server would see a deleted list return at the next pull (research R6).
