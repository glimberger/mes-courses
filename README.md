# Mes Courses

A shopping list application, developed with strict Test-Driven Development.

The app is an offline-first Expo (React Native) project for Android and iOS. The first feature,
[001 shopping lists](specs/001-shopping-lists/spec.md), is being built: the repository tooling is
in place and the application code is added task by task from
[`tasks.md`](specs/001-shopping-lists/tasks.md).
Its governing principles are in [`.specify/memory/constitution.md`](.specify/memory/constitution.md),
and its Material 3 color theme is in [`design/material-theme.json`](design/material-theme.json).

## Development workflow

Features are specified and built with [Spec Kit](https://github.com/github/spec-kit) from Claude Code:

1. `/speckit-specify` describes the feature.
2. `/speckit-plan` produces the technical plan.
3. `/speckit-tasks` breaks it into tasks, each test before the code it drives.
4. `/speckit-implement` implements the tasks.

## Repository layout

This is a Yarn workspaces monorepo ([research R20](specs/001-shopping-lists/research.md)).

| Path                        | What it holds                                                                  |
| --------------------------- | ------------------------------------------------------------------------------ |
| `apps/mobile/`              | The Expo app (`@mes-courses/mobile`), with its Jest, Storybook and Metro setup |
| `tests/e2e/`                | The Detox end-to-end journeys (`@mes-courses/e2e-tests`), test-only            |
| `apps/server/`, `packages/` | Added by later features (the server and the shared packages)                   |
| `specs/`, `.specify/`       | Feature specifications and the Spec Kit configuration                          |
| `design/`                   | The Material 3 theme export                                                    |
| `flake.nix`, `flake.lock`   | The Nix dev shell                                                              |
| `.github/`                  | The CI workflow and its helper script                                          |

## Prerequisites

- [Nix](https://nixos.org/download) with flakes enabled. The dev shell provides Node.js 24, Yarn 4
  (through Corepack, the version comes from `packageManager`) and watchman. Optionally
  [`direnv`](https://direnv.net) with `nix-direnv`, so the shell loads when you enter the folder.
- For device builds: Android Studio (Android) or Xcode (iOS, macOS only).
- For the end-to-end journeys: an Android emulator named `Pixel_API_35` (or the name in
  `DETOX_AVD_NAME`) and a JDK 17; on macOS, for iOS, Xcode and
  [`applesimutils`](https://github.com/wix/AppleSimulatorUtils)
  (`brew tap wix/brew && brew install applesimutils`).

These last tools stay outside Nix.

## Install

```sh
direnv allow     # or: nix develop
yarn install     # at the repository root, installs every workspace
```

Yarn only installs a version that was published at least a day ago (`npmMinimalAgeGate`), so a
brand-new release is ignored until then.

## Check

Run these from the repository root; they are the same checks as CI.

```sh
yarn typecheck          # tsc --noEmit in every workspace
yarn lint               # ESLint
yarn format:check       # Prettier (yarn format fixes)
yarn test               # Jest: the fast suite, no device and no network
yarn test:architecture  # dependency-cruiser layer and workspace rules
yarn build              # expo export for Android and iOS
```

## Run

From `apps/mobile/`, with a development build on an emulator, a simulator or a phone:

```sh
yarn expo run:android    # or: yarn expo run:ios
yarn storybook           # starts Metro with Storybook instead of the app
```

`yarn storybook` is the on-device catalog of the screens. A bundle built without
`STORYBOOK_ENABLED` holds no Storybook code.

`EXPO_PUBLIC_SENTRY_DSN` is optional: it sends error reports to Sentry. Without it, errors go to
the console only.

## End-to-end tests

The Detox journeys drive the release build on a device. They are not part of `yarn test`.

```sh
yarn test:e2e:android    # builds the release APK, then runs the journeys on the emulator
yarn test:e2e:ios        # the same on the iOS simulator (macOS)
```

Three variables choose the device: `DETOX_AVD_NAME` (default `Pixel_API_35`), `DETOX_IOS_DEVICE`
(default `iPhone 16`) and `DETOX_IOS_OS` (for example `iOS 26.5`, when several runtimes have the
same device). The Android journeys need an emulator of API 35 or lower: Detox 20 does not run on
API 37. The iOS journeys need a simulator runtime older than iOS 27 until the app adopts the
UIScene lifecycle that iOS 27 requires.

## Merging a pull request

The CI workflow (`typecheck`, `lint`, `test`, `build`) runs on every pull request; a new push
cancels the run of the previous commit. Every one of its jobs must be green before merging:
`gh pr checks` shows none failing, pending or skipped.

The Android device suite (`e2e-android`, about 30 minutes) does not run on every push to a pull
request. It runs on every push to `main`, and on demand on a branch:

```sh
gh workflow run e2e.yml --ref <branch>
```

A pull request that is not documentation-only is merged only with a green `e2e-android` run on
its latest commit (constitution v2.3.0). Start the run once the pull request is final, then check
it right before merging:

```sh
gh run list --workflow e2e.yml --branch <branch> --limit 1 --json headSha,conclusion
# headSha must be the pull request's latest commit, conclusion "success"
```

`.github/scripts/app-changed.sh` decides whether a branch is documentation-only (`specs/`,
`.specify/`, Markdown files); the same rule tells you when a branch needs
`yarn test:e2e:android` before it is pushed:

```sh
git diff --name-only "$(git merge-base origin/main HEAD)" HEAD | .github/scripts/app-changed.sh
# app=true  -> run yarn test:e2e:android first, and the e2e workflow before merging
# app=false -> documentation only, the device suite is not needed
```
