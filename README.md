# Mes Courses

A shopping list application, developed with strict Test-Driven Development.

The app is an offline-first Expo (React Native) project for Android and iOS, in French. With the
first feature, [001 shopping lists](specs/001-shopping-lists/spec.md), you keep several named
shopping lists on your phone and choose the current one; you add articles from a catalog sorted
in categories, by browsing or searching, or create them on the way, with an optional quantity
("2 L", "1,5 kg"); in the store you tick items into the cart, then finish shopping, which unticks
them all for next time. A removed item can be put back with "Annuler". The second feature,
[002 manage articles](specs/002-manage-articles/spec.md), lets you rename an article, change its
category or delete it from the catalog (it then leaves every list, and "Annuler" brings it back
with its quantities). The third, [003 server synchronization](specs/003-server-sync/spec.md),
keeps the data on a home server (a Raspberry Pi behind the Internet box) and on every phone and
tablet signed in to the same account, which converge on their own. The fourth,
[004 multi-user accounts](specs/004-multi-user/spec.md), gives each person an account on that
server, with their own data and devices. Everything still works with no network: each
change is saved on the device first and reaches the server when it can.
Its governing principles are in [`.specify/memory/constitution.md`](.specify/memory/constitution.md),
its lasting technical decisions are in [`docs/adr/`](docs/adr/README.md),
and its Material 3 color theme is in [`design/material-theme.json`](design/material-theme.json).

## Documentation

Everything else is under [`docs/`](docs/README.md), which indexes it:

- **Explanations**: the [architecture](docs/architecture.md), the [development workflow](docs/development-workflow.md),
  the [repository layout](docs/repository-layout.md), the [sync server](docs/sync-server.md),
  the [icons](docs/icons.md), the [agent guardrails](docs/agent-guardrails.md),
  the [build-time flags](docs/build-time-flags.md), the [story screenshots](docs/story-screenshots.md),
  the [store privacy details](docs/store-privacy-details.md), [privacy and security](docs/privacy-and-security.md)
  and the [delivery agent](docs/delivery-agent.md).
- **Procedures** (runbooks): [`docs/procedures/`](docs/README.md#procedures), such as the Pi set-up,
  releases, EAS builds, rollback and merging a pull request.

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

React Native Paper carries one Yarn patch (`.yarn/patches/`): its `Dialog` passes
`overlayAccessibilityLabel` on to its `Modal`, so screen readers read the dialog backdrop in
French. Check it still applies when Paper is upgraded, and drop it once Paper does this itself.
A second patch adds a `labelFloated` prop to its `TextInput`, which keeps the label in the outline of an
empty field as the mockups draw it (FR-009); drop it if Paper gains such a prop.

`yarn install` also installs the Git hooks ([Lefthook](https://lefthook.dev), `lefthook.yml`).
Before each commit, Prettier formats the staged files and stages the result, ESLint checks
them. Before each push, `yarn typecheck`, `yarn test` and `yarn test:architecture` run in
parallel on the whole repository (about 20 seconds), so uncommitted work in the tree can block
a push. The E2E suites never run from a hook.

## Check

Run these from the repository root; they are the same checks as CI.

```sh
yarn typecheck          # tsc --noEmit in every workspace
yarn lint               # ESLint
yarn format:check       # Prettier (yarn format fixes)
yarn test               # Jest: the fast suite, no device and no network
yarn test:architecture  # dependency-cruiser layer and workspace rules
yarn test:hooks         # the Claude Code guardrail hooks (.claude/hooks)
yarn build              # expo export for Android and iOS
```

## Run

From `apps/mobile/`, with a development build on an emulator, a simulator or a phone:

```sh
yarn android             # or: yarn ios
yarn storybook           # starts Metro with Storybook instead of the app
```

`yarn android` and `yarn ios` build with `SENTRY_DISABLE_AUTO_UPLOAD=true`: a local build sends no
source maps to Sentry, which only EAS builds do. A bare `yarn expo run:ios` fails at the "Bundle
React Native code and images" step with "An organization ID or slug is required" unless
`SENTRY_ORG` and `SENTRY_PROJECT` are set (see [EAS builds and error tracking](docs/procedures/eas-builds.md)).

`yarn storybook` is the on-device catalog of the screens. A bundle built without
`STORYBOOK_ENABLED` holds no Storybook code. To review a pull request that changes the UI, open
each story it lists ([quickstart §2](specs/001-shopping-lists/quickstart.md#2-review-the-screens-in-storybook)):
the text is French, colors come from the theme in light and dark mode, and at 200% system text
the long names wrap without being cut. `yarn start` brings the app back.

`EXPO_PUBLIC_SENTRY_DSN` is optional: it sends error reports to Sentry. Without it, errors go to
the console only.

## License

[MIT](LICENSE.md)
