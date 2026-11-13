# Quickstart: validating the sync status line

Prerequisites: `direnv allow` (or `nix develop`), `pnpm install`.

## Fast suite

```sh
pnpm --filter @mes-courses/mobile test -- sync-status-line sync-status-bar sync-announcer navigation undo-snackbar notice-snackbar accessibility stories
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:architecture
```

## Spec scenario to test map

| Spec | Test |
|---|---|
| US1 1-7, FR-004/005/007 | `sync-status-line.test.tsx` (one test per state, none for the four normal states, tone colors, disappears on recovery) |
| US2 1-3, FR-001/002/003 | screen tests (no banner), `settings-screen.test.tsx` (strip unchanged), `navigation.test.tsx` (line on Accounts/SignIn/ChoosePassword/Changelog, hidden on Settings) |
| US3 1-3, FR-010 | `sync-status-line.test.tsx` (retry, SignIn `initial: false`, tap opens Réglages) |
| US4 1-4, FR-011/012 | `navigation.test.tsx` (keyboard, snackbar offsets with and without the line), `undo-snackbar.test.tsx`, `notice-snackbar.test.tsx` |
| US5, FR-009/013 | `sync-status-line.test.tsx` (role, labels, no live region, separator tokens), `sync-announcer.test.tsx`, `accessibility.test.tsx` |

## Visual and device checks

- Storybook: open `Components/SyncStatusLine/*` in light and dark; the separator is visible.
- E2E (one suite at a time): `pnpm test:e2e:android`; the `sync-unreachable` journey shows no line while waiting.
- By hand on a device or the staging build: force a failed sync, check the line above the tab bar, the floating button and snackbars above it, Réglages without the line.
