---

description: "Task list for feature 001-shopping-lists"
---

# Tasks: Shopping Lists

**Input**: Design documents from `specs/001-shopping-lists/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/) (including
[contracts/ui-validation.md](contracts/ui-validation.md) for the stories and journeys),
[quickstart.md](quickstart.md), and the
application store contract shared with 002:
[002 contracts/ui-state.md](../002-manage-articles/contracts/ui-state.md)

**Tests**: REQUIRED. The constitution makes Test-Driven Development non-negotiable (Principle I):
every test task comes before the implementation task it drives. Run the new test, confirm it
fails for the expected reason (Red), then write the minimum code to pass it (Green), then
refactor with the suite green. Test names state the behavior in domain language and carry the
spec scenario id or FR id they prove (for example `"US1-6 unticked items come before ticked items
within a category"` or `"FR-016 refuses an amount with no digit after the comma"`), so
`quickstart.md` can find them. Every FR and every scenario is cited by at least one test name,
except the manual checks listed under the spec's Success Criteria.

**Organization**: tasks are grouped by user story so each story can be implemented and tested on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: the user story the task belongs to (US1 … US4)
- Every task names the exact file(s) it touches

## Path Conventions

Yarn workspaces monorepo ([plan.md](plan.md#source-code-repository-root), [research.md](research.md)
R20). The root holds the workspaces manifest, the lockfile, the shared tool configs and CI. The
Expo app is the `apps/mobile/` workspace: `apps/mobile/src/domain/`,
`apps/mobile/src/application/{ports,use-cases,testing}/`,
`apps/mobile/src/adapters/{sqlite,error-reporting,id,ui}/`, `apps/mobile/src/composition/`,
`apps/mobile/test/sqlite/`. Tests sit next to the code they cover as `*.test.ts(x)`, and stories
next to the component they show as `*.stories.tsx`; Storybook's config is in
`apps/mobile/.rnstorybook/`. The Detox journeys are in the test-only workspace `tests/e2e/`
(`tests/e2e/journeys/*.e2e.ts`). Commands run from the repository root.

## Rules that apply to every task

- **No network, no server**: no task touches the network or the Raspberry Pi server.
  Synchronization belongs to a later feature ([research.md](research.md) R19).
- **French text only in the UI adapter** (`apps/mobile/src/adapters/ui/`). Domain and use cases return typed
  results and tagged errors (Principle X). UI tests assert the exact French text from
  [contracts/ui-screens.md](contracts/ui-screens.md).
- **Design system**: screens use only React Native Paper and `apps/mobile/src/adapters/ui/components/`. They
  use no color literals and no inline styles, only theme tokens and `spacing` (Principle V).
- **Error reports** carry `{ operation, screen }` only, never names, quantities or list content,
  and never a user identifier, an installation identifier or the device name (Principle VIII,
  FR-030).
- **Every write** runs inside `UnitOfWork.run` and is committed before its promise resolves
  (FR-028).
- **Stories** get their data from `createStoryStore` (real use cases on fakes), never from a
  hand-built `ScreenState`. The exceptions are `Screens/Startup/Error`,
  `Screens/Startup/UpdateRequired` and `Screens/Crash/Error`, which render without a store (T062). Their text is French, their titles English
  ([research.md](research.md) R22).
- **Journeys** start from a fresh install, find elements by French text and accessibility label
  (no `testID`), use no `sleep` and no retries, and each production fix they force starts with its
  own failing unit or screen test ([research.md](research.md) R23).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: a workspaces root and an empty, buildable Expo app in `apps/mobile/`, with every
quality gate, Storybook, the Detox workspace and CI in place before any application code ([plan.md](plan.md#implementation-notes-for-speckit-tasks), Quality Gates).

- [X] T001 Create the Nix dev shell ([research.md](research.md) R21): `flake.nix` with `devShells.default` for `aarch64-darwin`, `x86_64-darwin`, `x86_64-linux` and `aarch64-linux`, providing `nodejs_24`, `corepack_24` and `watchman` from a stable `nixpkgs` branch (if `corepack_24` is missing from that branch, use the `nodejs_24` Corepack with shims installed into a project-local folder added to `PATH` in `shellHook`), and `.envrc` with `use flake`. Run `nix flake lock` to produce `flake.lock`, and check that `node --version` and `yarn --version` inside `nix develop` print Node 24 and Yarn 4. Then create the workspaces root ([research.md](research.md) R20) inside that shell: create a private root `package.json` (name `mes-courses`) with `"packageManager": "yarn@4.x"` (the current Yarn 4 release, exact version) and `"workspaces": ["apps/*", "packages/*", "tests/*"]` (`tests/*` holds the e2e workspace, [research.md](research.md) R23), a `.yarnrc.yml` with `nodeLinker: node-modules` (React Native does not support Plug'n'Play), and `tsconfig.base.json` with the strict compiler options. Then scaffold the Expo SDK 57 app in `apps/mobile/` with the blank TypeScript template, keeping the existing `README.md`, `design/`, `specs/` and `.specify/` at the root. Produce `apps/mobile/package.json` (name `@mes-courses/mobile`, private), `apps/mobile/App.tsx`, `apps/mobile/index.ts`, `apps/mobile/app.config.ts` (replace `app.json`: name "Mes courses", slug `mes-courses`, New Architecture on) and `apps/mobile/tsconfig.json` extending `../../tsconfig.base.json` and `expo/tsconfig.base`. Run `yarn install` at the root so there is a single `yarn.lock` and a root `node_modules/`, and check that `yarn expo start` from `apps/mobile/` resolves the hoisted dependencies with Expo's default Metro config.
- [X] T002 Add `"engines": { "node": ">=24" }` in the root `package.json` (the Node version itself comes from `flake.lock`; there is no `.nvmrc`).
- [X] T003 Extend `.gitignore` with `node_modules/`, `.expo/`, `dist/`, `ios/`, `android/`, `*.jks`, `.env*` and `coverage/`, as patterns that match in any workspace, plus Yarn's entries: `.yarn/*` with `!.yarn/patches`, `!.yarn/plugins`, `!.yarn/releases`, `!.yarn/sdks`, `!.yarn/versions`, `.pnp.*`, and `.direnv/` for direnv. Storybook's generated file and Detox's artifacts are added by the tasks that create them.
- [X] T004 Create `.talismanrc` with two `fileignoreconfig` entries, both with `ignore_detectors: [filecontent]`: `flake.lock` with the comment and exact entry required by the workspace `AGENTS.md`, and `yarn.lock` with a comment saying Yarn lockfiles hold package checksums, not secrets. Do this before the first commit that contains either lockfile.
- [X] T005 Install the runtime dependencies listed in [research.md](research.md#new-dependencies-principle-iv) into the app workspace, running `yarn expo install` from `apps/mobile/` for Expo-managed versions: `react-native-paper`, `react-native-safe-area-context`, `@expo/vector-icons`, `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `zustand`, `expo-sqlite`, `expo-crypto`, `@sentry/react-native`. Register the `expo-sqlite` and `@sentry/react-native/expo` config plugins in `apps/mobile/app.config.ts`, and set `android.allowBackup: true` there explicitly, with no backup rules excluding the database, so the system backup keeps the data ([research.md](research.md) R18b). The FR-041 settings come in T006, test-first, once Jest runs.
- [X] T006 [P] Configure Jest 30 with the `jest-expo` preset and React Native Testing Library in `apps/mobile/jest.config.js` and `apps/mobile/package.json` (scripts `test`, `test:watch`). Add the root script `test` (`yarn workspaces foreach --all --exclude mes-courses run test`). Add a trivial green test in `apps/mobile/src/smoke.test.ts` to prove the runner works, then delete it once the first real test exists. Then, test-first for FR-041, now that Jest runs ([research.md](research.md) R25): add `@expo/config` (the version Expo pins) as a dev dependency of the app, and write `apps/mobile/build-config/native-surface.test.ts` (`@jest-environment node`, named "FR-041 …"), which resolves the config with `getConfig` from `apps/mobile/` and fails when `android.permissions` is not empty, when `android.blockedPermissions` lacks any of `android.permission.SYSTEM_ALERT_WINDOW`, `android.permission.VIBRATE`, `android.permission.READ_EXTERNAL_STORAGE` and `android.permission.WRITE_EXTERNAL_STORAGE`, when a `scheme` is set, when `android.intentFilters` is set, or when `ios.infoPlist` holds any entry whose name ends in `UsageDescription`; confirm it fails, then set `android.permissions: []` and that `android.blockedPermissions` list in `apps/mobile/app.config.ts`, with no `scheme`, to turn it green.
- [X] T007 [P] Configure ESLint 9 flat config in the root `eslint.config.mjs`: `typescript-eslint` strict and `eslint-config-prettier` for every workspace, plus `eslint-config-expo` and `eslint-plugin-react-native` (with `react-native/no-color-literals` and `react-native/no-inline-styles` as errors) scoped to `apps/mobile/**`, and a `no-restricted-syntax` rule scoped to `apps/mobile/src/adapters/ui/screens/**` that allows in `StyleSheet.create` only the layout properties of [research.md](research.md) R2 (flex, alignment, position, and `margin*`, `padding*`, `gap` set from `spacing.*`) and no number literal other than `0` and flex factors; prove it fails on a throwaway screen with `borderRadius: 8` and with `padding: 12`, then delete it. Add Prettier 3 in the root `.prettierrc`, the root scripts `lint`, `format` and `format:check`, and `typecheck` (`tsc --noEmit`) in `apps/mobile/package.json` with a root `typecheck` running it in every workspace ([research.md](research.md) R16). Set `no-console` as an error for `apps/mobile/src/**`, except the console error reporter's file (`apps/mobile/src/adapters/error-reporting/console-error-reporter.ts`), so release builds write nothing about lists to the device log ([research.md](research.md) R25); prove it fails on a throwaway `console.log` in a screen, then delete it.
- [X] T008 [P] Configure dependency-cruiser in the root `.dependency-cruiser.cjs` with the rules of [research.md](research.md) R15:
  - no relative import crosses a workspace folder (`apps/*`, `packages/*`), and no app workspace imports another;
  - `apps/mobile/src/domain/**` imports nothing outside `apps/mobile/src/domain/`, npm packages included;
  - `apps/mobile/src/application/**` imports only `apps/mobile/src/domain/` and `apps/mobile/src/application/`;
  - in both rules, npm packages are refused for type-only imports too; the only exception is a workspace package in the pure-package list of `.dependency-cruiser.cjs`, empty in 001 (003 adds `@mes-courses/sync-core`);
  - only `apps/mobile/src/adapters/**`, `apps/mobile/src/composition/**`, `apps/mobile/App.tsx` and the test helpers in `apps/mobile/test/**` import `apps/mobile/src/adapters/**`;
  - no adapter (`apps/mobile/src/adapters/<name>/**`) imports another adapter, type imports included;
  - only `apps/mobile/App.tsx`, `apps/mobile/App.test.tsx` and `apps/mobile/src/composition/**` import `apps/mobile/src/composition/**`;
  - `zustand` is imported only under `apps/mobile/src/adapters/ui/**`;
  - `zustand/middleware` and `immer` are imported nowhere;
  - no circular dependency.

  Add the script `test:architecture` in the root `package.json`. Prove each rule fails on a deliberate violation in a throwaway file, then delete the file.
- [X] T009 Install Storybook for React Native 10 in the app workspace ([research.md](research.md) R22). From `apps/mobile/`, run `yarn expo install storybook @storybook/react-native @storybook/react` and the on-device UI's peer dependencies listed by the `@storybook/react-native` 10 install guide (at the time of writing `react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg`, `@gorhom/bottom-sheet`), each as a dependency or dev dependency as the guide says. Then:
  - create `apps/mobile/metro.config.js`: Expo's `getDefaultConfig(__dirname)` from `expo/metro-config`, wrapped with `withStorybook` from `@storybook/react-native/withStorybook`, enabled only when `STORYBOOK_ENABLED` is set, with nothing else added (Expo detects the workspaces on its own, R20);
  - create `apps/mobile/.rnstorybook/main.ts` (stories `../src/adapters/ui/**/*.stories.tsx`, no add-ons), `apps/mobile/.rnstorybook/preview.tsx` (no decorator yet) and the entry file the guide asks for;
  - add the script `"storybook": "STORYBOOK_ENABLED=true expo start"` to `apps/mobile/package.json`;
  - add the file Storybook generates (`apps/mobile/.rnstorybook/storybook.requires.ts`, if the guide's version generates it) to `.gitignore`.

  Check that `yarn build` is still green and that `grep -ril storybook apps/mobile/dist` finds nothing, so a bundle built without `STORYBOOK_ENABLED` holds no Storybook code.
- [ ] T010 Add the story test ([research.md](research.md) R22). Create `apps/mobile/src/adapters/ui/required-stories.ts` exporting `requiredStories: readonly string[]`, empty for now, filled with the ids of [contracts/ui-validation.md](contracts/ui-validation.md#required-stories) as each story phase adds them. Then write `apps/mobile/src/adapters/ui/stories.test.tsx`:
  - it finds every `src/adapters/ui/**/*.stories.tsx` of the app with `fs.globSync` (Node 24), `require`s each file and composes its stories with `composeStories` from `@storybook/react`, using the project annotations of `apps/mobile/.rnstorybook/preview.tsx`;
  - it renders each story with React Native Testing Library twice, with `useColorScheme` mocked to `'light'` then `'dark'`, and fails if rendering throws or if `console.error` or `console.warn` is called;
  - one test fails for every id in `requiredStories` that no story has, the id being `<title>/<export name>`;
  - with no story file yet, the suite still runs: its "required stories exist" test is green on an empty list.

  Prove it with a throwaway `apps/mobile/src/adapters/ui/smoke.stories.tsx` that renders a Paper `Text`: it is green; a story that throws fails; a required id with no story fails. Then delete the throwaway story and id.
- [ ] T011 Extend the root `.dependency-cruiser.cjs` with the rules of [research.md](research.md) R15 for Storybook and the e2e workspace, scanning `apps/mobile/.rnstorybook/` too:
  - `@storybook/*` is imported only by `**/*.stories.tsx`, `apps/mobile/.rnstorybook/**` and `apps/mobile/src/adapters/ui/stories.test.tsx`;
  - `**/*.stories.tsx`, `apps/mobile/src/adapters/ui/testing/**`, `apps/mobile/src/application/testing/**` and `apps/mobile/test/**` are imported only by `*.test.ts(x)` files, `*.stories.tsx` files, `apps/mobile/.rnstorybook/**` and other files in those testing folders, never by production code;
  - `tests/e2e/**` imports no other workspace, by package name or by path.

  Prove each rule fails on a deliberate violation in a throwaway file, then delete the file.
- [ ] T012 Scaffold the test-only workspace `tests/e2e/` ([research.md](research.md) R23):
  - `tests/e2e/package.json`: name `@mes-courses/e2e-tests`, private; devDependencies `detox` (20.44 or later), `jest@^29`, `ts-jest@^29`, `@types/jest@^29`, `typescript`; scripts `e2e:build:android` (`detox build -c android.emu.release`), `e2e:test:android` (`detox test -c android.emu.release`), `e2e:build:ios`, `e2e:test:ios` (same with `ios.sim.release`) and `typecheck`. It has **no `test` script**, so the root `yarn test` never starts a device;
  - `tests/e2e/tsconfig.json` extending `../../tsconfig.base.json` with the `jest` and `detox` types;
  - `tests/e2e/jest.config.js`: `testMatch: ['<rootDir>/journeys/**/*.e2e.ts']`, `ts-jest` transform, `testTimeout: 120000`, `maxWorkers: 1`, Detox's `globalSetup`, `globalTeardown`, `reporters` and `testEnvironment` from `detox/runners/jest`, and no `retryTimes`;
  - `tests/e2e/.detoxrc.js`: app `android.release` (build: `cd ../../apps/mobile && env -u EXPO_PUBLIC_SENTRY_DSN -u STORYBOOK_ENABLED DETOX_BUILD=1 SENTRY_DISABLE_AUTO_UPLOAD=true yarn expo prebuild --platform android && cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release`, with `binaryPath` and `testBinaryPath` pointing at the release and androidTest APKs under `../../apps/mobile/android/app/build/outputs/apk/`); app `ios.release` (`expo prebuild --platform ios` with the same environment, `DETOX_BUILD=1` included, then `xcodebuild` on the generated workspace and scheme, `-configuration Release -sdk iphonesimulator -derivedDataPath ios/build`, with `binaryPath` at the built `.app`; take the workspace and scheme names from the prebuild output); device `emulator` with `avdName: process.env.DETOX_AVD_NAME ?? 'Pixel_API_35'`; device `simulator` of type `iPhone 16`; configurations `android.emu.release` and `ios.sim.release`; artifacts in `artifacts/`, keeping screenshots and logs of failing tests only;
  - the root scripts `test:e2e:android` and `test:e2e:ios`, each running the workspace's build then test scripts through `yarn workspace @mes-courses/e2e-tests`;
  - `tests/e2e/artifacts/` in `.gitignore`.

  Run `yarn install` at the root and check that `yarn.lock` holds Jest 29 for this workspace and Jest 30 for the app, and that `yarn test` from the root does not enter `tests/e2e/`.
- [ ] T013 Add Detox's native configuration to the app ([research.md](research.md) R23). From `apps/mobile/`, run `yarn expo install --dev expo-detox-config-plugin` and register it in `apps/mobile/app.config.ts` only when `process.env.DETOX_BUILD === '1'` ([research.md](research.md) R23, R25). Run `DETOX_BUILD=1 yarn expo prebuild --clean` and check the generated `android/` holds the Detox test runner, the `androidTest` entry, the network security config allowing cleartext to `localhost` and `10.0.2.2` only, and the ProGuard keep rules; and that `ios/` holds the Detox pod. If the plugin does not support Expo SDK 57, write `apps/mobile/plugins/with-detox.ts` making the same changes instead, and register it. Then run `yarn expo prebuild --clean` without `DETOX_BUILD` and check that `android/` holds no network security config, no `androidTest` entry and no Detox runner, and `ios/` no Detox pod, so builds for users carry none of them (spec Success Criteria). Check that `apps/mobile/ios/` and `apps/mobile/android/` stay ignored by Git (T003).
- [ ] T014 Write the first journey `tests/e2e/journeys/launch.e2e.ts`: `beforeAll` calls `device.launchApp({ delete: true, newInstance: true })`, then it expects the text shown by the scaffold's `apps/mobile/App.tsx` to be visible. Run `yarn test:e2e:android` (and `yarn test:e2e:ios` on a Mac) and check it is green on the first try. It proves the build, install and launch chain; `first-launch.e2e.ts` replaces it in US1 (T065).
- [ ] T015 Add the GitHub Actions workflow `.github/workflows/ci.yml`, triggered on `pull_request` and on `push` to `main`, `ubuntu-latest`. Each job installs Nix with `DeterminateSystems/nix-installer-action`, caches the store with `DeterminateSystems/magic-nix-cache-action`, and runs every command as `nix develop --command …`, starting with `yarn install --immutable` at the root ([research.md](research.md) R21). Jobs: `typecheck`; `lint` (ESLint + `yarn format:check`); `test` (`yarn test` + `yarn test:architecture`); `build` (root `yarn build`, running `build` in every workspace; the app's `build` is `expo export --platform android --platform ios`), each with `timeout-minutes: 15` ([research.md](research.md) R17).
- [ ] T016 Add the job `e2e-android` to `.github/workflows/ci.yml`, with the same triggers as the other jobs ([research.md](research.md) R23), on `ubuntu-latest` with `timeout-minutes: 45`, skipped only on a documentation-only pull request (constitution v2.2.0, [research.md](research.md) R17):
  - first write `.github/scripts/app-changed.sh` (POSIX shell, executable): it reads file paths on standard input, one per line, and prints `app=false` when every path is under `specs/`, under `.specify/` or ends in `.md`, and `app=true` otherwise, including for no input. Check it by hand before using it: `specs/001-shopping-lists/spec.md` with `README.md` gives `app=false`; `apps/mobile/App.tsx`, `yarn.lock`, `flake.nix` or `.github/workflows/ci.yml`, each alone or mixed with a `.md`, gives `app=true`; record these runs in the pull request;
  - add a job `changes` (`timeout-minutes: 5`): on `pull_request` it checks out with `fetch-depth: 0`, runs `git diff --name-only` between the merge base with `origin/${{ github.base_ref }}` and `HEAD`, pipes it to the script and writes the result to `$GITHUB_OUTPUT`; on `push` it writes `app=true` without looking. `e2e-android` declares `needs: changes` and `if: needs.changes.outputs.app == 'true'`; `typecheck`, `lint`, `test` and `build` do not depend on it and always run;
  - enable KVM (the udev rule given in the `reactivecircus/android-emulator-runner` documentation);
  - set up Java 17 with `actions/setup-java` (Temurin); the runner's preinstalled Android SDK is used, outside Nix (R21). `nix develop` keeps `JAVA_HOME` and `ANDROID_HOME` from the environment;
  - install Nix and its cache as in the other jobs, and cache `~/.gradle/caches` and `~/.gradle/wrapper` with `actions/cache`, keyed on `yarn.lock` and `apps/mobile/app.config.ts`;
  - `nix develop --command yarn install --immutable`, then `nix develop --command yarn workspace @mes-courses/e2e-tests e2e:build:android`;
  - start an emulator with `reactivecircus/android-emulator-runner` (API level 35, `google_apis`, `x86_64`, `avd-name: Pixel_API_35`, animations disabled) whose `script` runs `nix develop --command yarn workspace @mes-courses/e2e-tests e2e:test:android`;
  - on failure, upload `tests/e2e/artifacts/` with `actions/upload-artifact`.

  Open the setup pull request and check `e2e-android` runs green with the other jobs. Then, on a throwaway pull request that changes only a Markdown file, check that `e2e-android` shows as skipped while every other job runs, and close it without merging.
- [ ] T017 Replace the "Install, run and test" section of `README.md` with the repository layout (`apps/mobile/`, `tests/e2e/`, later `apps/server/` and `packages/`), the prerequisites (Nix with flakes enabled, optionally `direnv` with `nix-direnv`; Android Studio or Xcode for device builds; for the journeys an emulator named `Pixel_API_35` or `DETOX_AVD_NAME`, a JDK 17, and `applesimutils` on macOS), `yarn storybook` from `apps/mobile/` on a development build, `yarn test:e2e:android` and `yarn test:e2e:ios`, entering the dev shell (`direnv allow` or `nix develop`), `yarn install` at the root, the check commands, `yarn expo run:android` / `run:ios` from `apps/mobile/` with a development build, the optional `EXPO_PUBLIC_SENTRY_DSN`, and the merge rule: `gh pr checks` must be all green before merging, none failing, pending or skipped, except `e2e-android` skipped on a pull request that changes only documentation (`specs/`, `.specify/`, Markdown files), and when a branch needs `yarn test:e2e:android` before it is pushed (the same rule, `.github/scripts/app-changed.sh`; constitution v2.2.0).

**Checkpoint**: `yarn typecheck && yarn lint && yarn format:check && yarn test && yarn test:architecture && yarn build` is green locally from the root, `yarn test:e2e:android` (and `yarn test:e2e:ios` on a Mac) runs the launch journey green, `yarn storybook` opens Storybook on a development build, and CI is green on the setup pull request, `e2e-android` included.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: domain rules, ports, fakes, SQLite storage, error reporting, theme, shared state
components, the application store core, the story store and decorator, and the app shell that
launches on a seeded store. Every
story depends on them.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Domain foundations

- [ ] T018 [P] Write failing tests for `Result` helpers (`ok`, `err`, type narrowing on `ok`) in `apps/mobile/src/domain/result.test.ts`.
- [ ] T019 [P] Implement `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }` with `ok()` / `err()` in `apps/mobile/src/domain/result.ts` to turn T018 green.
- [ ] T020 [P] Write failing tests for name rules in `apps/mobile/src/domain/name.test.ts`, per [data-model.md](data-model.md#name-articles-categories-lists):
  - `cleanName(text) = text.normalize('NFC').trim().replace(/\s+/gu, ' ')`: "  Pommes \t de   terre " → "Pommes de terre", and "e" followed by U+0301 (combining acute accent) becomes the single character "é" (FR-021, FR-022);
  - `validateName` returns the clean name;
  - `compareNames` orders with `Intl.Collator('fr', { sensitivity: 'base', numeric: true })`: "Lait 2 L" before "Lait 10 L", "Éclairs" between "Eau" and "Farine" (Assumptions);
  - `NameRequired` for empty or blank text (US2-11, US3-6, US4-4), including text made only of zero-width spaces, joiners or a byte order mark (FR-022);
  - a non-breaking space (U+00A0), a narrow non-breaking space (U+202F), a tab and a line break each count as a space: "Pommes\u00A0de\nterre" → "Pommes de terre", and "Pâte\u200Bs" → "Pâtes" (FR-022);
  - `NameTooLong` above "At most 60 characters after cleaning, counted in Unicode code points", and 60 characters accepted; the length is `[...name].length`, so 60 emoji are accepted (120 UTF-16 units) and 30 decomposed "é" count as 30 after cleaning;
  - `normalizedName(name)` is `cleanName(name).toLocaleLowerCase('fr')` with "œ" → "oe", "æ" → "ae" and "’" → "'", accents kept, so "Pâte" ≠ "Pâté", while " beurre ", "BEURRE", "Pommes  de terre" and a decomposed "Crème" each equal the normalized form of "Beurre", "Pommes de terre" and "Crème", "Oeufs" equals "Œufs", "Caesar" equals "Cæsar" and "Pâte d'amande" equals "Pâte d’amande" (FR-021);
  - `searchForm` removes diacritics (`NFD`, combining marks removed) from the normalized name, so "Épicerie" → "epicerie", "Œufs" → "oeufs", "Cæsar" → "caesar" and "d’amande" → "d'amande" (FR-009).
- [ ] T021 Implement `cleanName`, `validateName`, `normalizedName`, `searchForm`, `compareNames` and the `NameError` union (`NameRequired | NameTooLong`) in `apps/mobile/src/domain/name.ts` to turn T020 green.
- [ ] T022 [P] Write failing tests for `parseQuantity(amountText, unitText)` in `apps/mobile/src/domain/quantity.test.ts`, per [data-model.md](data-model.md#quantity-value-object):
  - both blank → `null` (no quantity);
  - "1,5" and "1.5" → amount 1.5; "6", "0,125" and "9999" accepted; "007" → amount 7;
  - unit cleaned like a name (`cleanName`): " paquets  de 6 " → "paquets de 6"; a unit empty after cleaning becomes `null`, with no error; the 15-character limit counts the cleaned unit (FR-022);
  - the amount text must match `^-?\d+([.,]\d+)?$`: "abc", "1 000", "+2", "1e3", "1,5,2", ",5" and "1," → `AmountNotANumber` (FR-016);
  - "0", "0,0", "0,000" and "-2" → `AmountNotPositive` (US2-12, FR-016);
  - more than 3 digits after the separator, as typed: "1,2345" and "1,5000" → `AmountTooPrecise`;
  - above 9 999: "10000" and "9999,5" → `AmountTooLarge`;
  - errors come in the order of [data-model.md](data-model.md#quantity-value-object): "-1,2345" → `AmountNotPositive`;
  - unit with no amount → `UnitWithoutAmount` (US2-13);
  - unit above "at most 15 characters" → `UnitTooLong`.
- [ ] T023 Implement the `Quantity` value object `{ amount: number; unit: string | null }`, `parseQuantity` and the `QuantityError` union (`AmountNotANumber | AmountNotPositive | AmountTooPrecise | AmountTooLarge | UnitWithoutAmount | UnitTooLong`) in `apps/mobile/src/domain/quantity.ts` to turn T022 green.
- [ ] T024 [P] Define the entity types and branded ids in `apps/mobile/src/domain/category.ts` (`Category { id, name, position }`), `apps/mobile/src/domain/article.ts` (`Article { id, name, categoryId }`), `apps/mobile/src/domain/shopping-list.ts` (`ShoppingList { id, name }`) and `apps/mobile/src/domain/list-item.ts` (`ListItem { listId, articleId, inCart, quantity: Quantity | null }`). They are types only, with no behavior and so no test yet; behavior arrives test-first in the story phases.

### Ports and test doubles

- [ ] T025 Declare the driven ports exactly as in [contracts/driven-ports.md](contracts/driven-ports.md): `UnitOfWork` and `Repositories` in `apps/mobile/src/application/ports/unit-of-work.ts`; `CategoryRepository`, `ArticleRepository`, `ShoppingListRepository`, `ListItemRepository`, `AppStateRepository` in `apps/mobile/src/application/ports/repositories.ts`; `IdGenerator` in `apps/mobile/src/application/ports/id-generator.ts`; `ErrorReporter` in `apps/mobile/src/application/ports/error-reporter.ts`; the `StorageFull` error class (fixed message "Storage operation failed", no other field) in `apps/mobile/src/application/ports/storage-full.ts`, so the UI adapter can recognize it without importing the SQLite adapter ([research.md](research.md) R12a); and the `DataFromNewerVersion` error class in `apps/mobile/src/application/ports/data-from-newer-version.ts`, for the same reason (R18c, R15).
- [ ] T026 [P] Write the shared repository contract suites, as functions taking a factory that returns fresh `Repositories`, in `apps/mobile/src/application/testing/contracts/`:
  - `category-repository.contract.ts`: `all` ordered by position, `findById`, `findByNormalizedName`, `nextPosition` = max + 1 (0 when empty), `add`;
  - `article-repository.contract.ts`: `all`, `findById`, `findByNormalizedName`, `add`;
  - `shopping-list-repository.contract.ts`: `all`, `findById`, `findByNormalizedName`, `count`, `add`, `itemCounts`;
  - `list-item-repository.contract.ts`: `forList`, `find`, `save` inserts then updates, `remove`, `takeAllOutOfCart` keeps quantities;
  - `app-state-repository.contract.ts`: `currentListId` is `null` before any set, then `setCurrentListId` replaces it;
  - `unit-of-work.contract.ts`: a `run` that throws leaves no partial write.
- [ ] T027 Write `apps/mobile/src/application/testing/in-memory-repositories.test.ts`, which runs every T026 suite against the in-memory fakes. Confirm it fails because the fakes do not exist yet.
- [ ] T028 Implement the in-memory fakes in `apps/mobile/src/application/testing/in-memory-repositories.ts` (`InMemoryRepositories`, `InMemoryUnitOfWork` with snapshot-and-rollback on throw) to turn T027 green.
- [ ] T029 [P] Implement `SequentialIdGenerator` (`"id-1"`, `"id-2"`, …) in `apps/mobile/src/application/testing/sequential-id-generator.ts` and `RecordingErrorReporter` (records in memory, in order, each `{ error, context }` given to `report`, each screen given to `setScreen` and each `crashNatively` call) in `apps/mobile/src/application/testing/recording-error-reporter.ts`, each with a small test next to it written first.

### SQLite adapter

- [ ] T030 Define the `SqlDatabase` interface (`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync`) in `apps/mobile/src/adapters/sqlite/sql-database.ts`. Then write the `node:sqlite` (`DatabaseSync`) wrapper implementing it in `apps/mobile/test/sqlite/node-sql-database.ts`, using in-memory databases by default, or a file path when given one (for T035's journal test), and running under `@jest-environment node`. If Jest cannot load `node:sqlite`, use `better-sqlite3` as a dev dependency behind the same wrapper ([research.md](research.md) R4).
- [ ] T031 Write failing migration tests in `apps/mobile/src/adapters/sqlite/migrations.test.ts`:
  - migration 1 creates the tables `category`, `article`, `shopping_list`, `list_item` and `app_state`, and the index `list_item_article`, exactly as in [data-model.md](data-model.md#sqlite-schema-migration-1);
  - `PRAGMA user_version` becomes 1, and running the migrations again is a no-op;
  - the migration runs in one transaction: a migration that throws (a test migration 2 that fails halfway) leaves `user_version` at 1 and the rows already stored unchanged, and nothing deletes or recreates the database (FR-039);
  - a database whose `user_version` is above the highest known migration (set it to 99) makes `migrate` throw `DataFromNewerVersion` before any other statement: no table is created or changed and `user_version` stays 99 (FR-040, [research.md](research.md) R18c);
  - foreign constraints are enforced on open;
  - the constraints reject a 61-character name, a duplicate `normalized_name`, `quantity_amount <= 0`, `quantity_amount > 9999`, a unit without an amount, and a second `app_state` row.
- [ ] T032 Implement `migrate(db)` (throwing the `DataFromNewerVersion` of T025) and migration 1 in `apps/mobile/src/adapters/sqlite/migrations.ts` to turn T031 green.
- [ ] T033 Write `apps/mobile/src/adapters/sqlite/sqlite-repositories.test.ts`, which runs every T026 suite against the SQLite repositories on a migrated `node:sqlite` database, plus adapter-only tests for `StorageFull`, from a fake `SqlDatabase` that throws an error with the SQLite result code 13 and, separately, one whose message contains "database or disk is full": both reject with `StorageFull`, with no other text kept (FR-030, R12a); and for `StorageError` (FR-030, [research.md](research.md) R13): a repository write rejected by a constraint while saving the article name "Houmous maison" (a duplicate `normalized_name` inserted directly) and a `UnitOfWork.run` on a closed database both reject with a `StorageError` whose `message` is "Storage operation failed", whose `stack` does not contain "Houmous" or the SQL text, which carries the SQLite result code when there is one, and which has no `cause`; and an article named `'); DROP TABLE article; --` is saved and read back unchanged, with the `article` table still there, since every value is bound as a parameter ([research.md](research.md) R25). Confirm it fails.
- [ ] T034 Implement the SQLite repositories in `apps/mobile/src/adapters/sqlite/`: `category-repository.ts`, `article-repository.ts`, `shopping-list-repository.ts`, `list-item-repository.ts` (`quantity_amount` / `quantity_unit` ↔ `Quantity | null`, `in_cart` 0/1 ↔ boolean) and `app-state-repository.ts`. Implement `SqliteUnitOfWork` (`withTransactionAsync`) in `apps/mobile/src/adapters/sqlite/unit-of-work.ts`. Add `StorageError` and a `toStorageError(error)` helper in `apps/mobile/src/adapters/sqlite/storage-error.ts`, which returns `StorageFull` for a full storage (result code 13 or the message "database or disk is full", checked before the text is dropped) and `StorageError` otherwise, and wrap every database call of the repositories, the unit of work and `migrate` with it (`DataFromNewerVersion` passes through unchanged). All of them turn T033 green.
- [ ] T035 Add `openDatabase()` in `apps/mobile/src/adapters/sqlite/open-database.ts`: it opens the expo-sqlite database `mes-courses.db`, enforces foreign constraints, calls `configureDatabase(db)`, and runs `migrate`. Test-first, write `configureDatabase` in `apps/mobile/src/adapters/sqlite/configure-database.ts`: it sets `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = FULL`, and throws when either does not read back with that value (FR-028, power cut, [research.md](research.md) R4). Its test, `configure-database.test.ts`, runs on a `node:sqlite` database file in a temporary folder (an in-memory database always reports `memory`): both values read back as `wal` and 2 (`FULL`), and it throws when the journal mode does not take (a fake `SqlDatabase` answering `memory`). It is thin wiring over expo-sqlite, which does not load in Jest: the composition test (T064) covers the same steps on `node:sqlite`, and quickstart step 5 covers the real binding on a device. Wrap its database calls with `toStorageError` (T034).

### Startup seed

- [ ] T036 Write failing tests for `initializeStore` in `apps/mobile/src/application/use-cases/initialize-store.test.ts`, on fakes:
  - on an empty store it creates the given categories with positions 0..n-1 in order, then the first list, and makes it current (US3-1, US4-1, FR-002, FR-020, FR-023);
  - on a store that already has a list it does nothing;
  - a failure midway leaves nothing behind (one transaction).
- [ ] T037 Implement `initializeStore(seed: { categoryNames; firstListName })` in `apps/mobile/src/application/use-cases/initialize-store.ts` to turn T036 green.

### Error reporting and ids

- [ ] T038 [P] Write failing tests for the Sentry reporter in `apps/mobile/src/adapters/error-reporting/sentry-error-reporter.test.ts`, with `@sentry/react-native` mocked:
  - `init` is called with `sendDefaultPii: false`, the DSN, `maxCacheItems: 30` (FR-030a), `enableNativeCrashHandling: true` (native crashes are reported, FR-030), `maxBreadcrumbs: 0`, `enableAppHangTracking: false` and `enableAutoSessionTracking: false`, and with no `release` or `dist`, which the SDK reads from the native app ([research.md](research.md) R13);
  - FR-030 environment: `createSentryErrorReporter({ dsn, environment })` hands `environment` to `init` when it is `production` or `preview`; with any other value, or none, it does not call `init` and returns a `ConsoleErrorReporter`;
  - `beforeBreadcrumb` returns `null` for every breadcrumb, and `beforeSend` removes request data;
  - after `init`, the global tag `operation` is `uncaught`, and `setScreen('Lists')` sets the global tag `screen` to `Lists`, so native crashes carry both (FR-030);
  - `beforeSend` on an event whose exception value is "Cannot read 'Houmous maison'" returns an event whose exception value is empty and whose stack frames are kept (FR-030, [research.md](research.md) R13);
  - `beforeSend` keeps only the FR-030 fields (error type, error code, stack trace, operation, screen, app version, device model and system version, environment): an event with `contexts.device.memory_size`, `extra`, `user` and a custom tag comes out without them;
  - FR-030 no identifier: an event with `user: { id: 'install-1' }`, `contexts.device.name` "iPhone de Marie" and `contexts.device.model` "iPhone15,2" comes out with no `user`, no device name and the model kept;
  - an event from the global handlers, carrying only the global tags, comes out with the operation `uncaught` and the screen last given to `setScreen` (FR-039a);
  - `report(error, { operation })` with no screen keeps the global `screen` tag;
  - `report(error, { operation, screen })` calls `captureException` with those tags for that one event only, without changing the global tags;
  - FR-030 once per opening: of two events with the same error type, error code, operation and screen, `beforeSend` keeps the first and returns `null` for the second; an event differing in any one of the four is kept; a new reporter (a new opening) sends the first one again;
  - FR-030 error type and code: an `Error` subclass named `StorageError` with `code: 13` keeps the type `StorageError` and the code 13; an `Error` with no `code` keeps its type and no code;
  - FR-030c fingerprint: the filtered event's `fingerprint` is `['StorageError', '13', 'toggleItemInCart', 'CurrentList']` for that failure, and `['Error', '', 'uncaught', 'Lists']` for an uncaught `Error` with no code shown on Lists, so one kind of failure is one Sentry issue;
  - FR-030b: the test names cite FR-030b on the case that runs a report from a use case of another feature through the same adapter (a `report(error, { operation: 'editArticle', screen: 'AddArticles' })` call is filtered and fingerprinted like the others);
  - `crashNatively()` calls `Sentry.nativeCrash()` (used only by the smoke test, T133);
  - `report` and `setScreen` never throw, even when the SDK throws.
- [ ] T039 [P] Implement `createSentryErrorReporter` in `apps/mobile/src/adapters/error-reporting/sentry-error-reporter.ts` and `ConsoleErrorReporter` in `apps/mobile/src/adapters/error-reporting/console-error-reporter.ts` (the console one is also written test-first: its `setScreen` only remembers the screen it prints with each report, and its `crashNatively` prints a line and does not crash) to turn T038 green.
- [ ] T040 [P] Implement `CryptoIdGenerator` (`expo-crypto` `randomUUID()`) in `apps/mobile/src/adapters/id/crypto-id-generator.ts`, with a test that mocks `expo-crypto` and checks `next()` returns its value.

### Design system foundations (Principle V)

- [ ] T041 Write failing tests in `apps/mobile/src/adapters/ui/theme/theme.test.ts`:
  - every MD3 color role of the light and dark Paper themes equals the matching role of `schemes.light` and `schemes.dark` in `design/material-theme.json`;
  - `elevation.level0..5` derive from `surfaceContainerLowest..Highest`;
  - FR-036: in light and dark, every foreground role the screens and shared components use (text, icons, checkbox, outline; at least `onSurface`, `onSurfaceVariant` for ticked rows, `primary`, `outline`) against every background role it is drawn on (at least `surface` and the `surfaceContainer*` roles) reaches 4.5:1 for text and 3:1 for the others (WCAG contrast ratio computed in the test). The pairs come from one exported list in `apps/mobile/src/adapters/ui/theme/used-color-pairs.ts`, which each task adding a new role to a screen or component extends;
  - the `spacing` tokens are `xs = 4` … `xl = 32` on the 4 dp grid.
- [ ] T042 Implement the light and dark themes from the JSON in `apps/mobile/src/adapters/ui/theme/theme.ts` and the `spacing` tokens in `apps/mobile/src/adapters/ui/theme/spacing.ts`, and add `ThemeProvider` (follows `useColorScheme`, wraps `PaperProvider`) in `apps/mobile/src/adapters/ui/theme/theme-provider.tsx`, to turn T041 green. If a contrast pair of T041 fails with the colors of `design/material-theme.json`, export the theme again from Material Theme Builder, or use a role of the same scheme that passes and record the choice in [research.md](research.md) R12; never lower the threshold.
- [ ] T043 [P] Write failing component tests in `apps/mobile/src/adapters/ui/components/screen-state.test.tsx`:
  - `LoadingState` has the accessibility label "Chargement";
  - `EmptyState` shows its message and optional action button;
  - `ErrorState` shows its message and a "Réessayer" button that calls `onRetry`;
  - `ScreenStateView` renders exactly one of the three, or the success renderer, for each `ScreenState` status.
- [ ] T044 [P] Implement `LoadingState.tsx`, `EmptyState.tsx`, `ErrorState.tsx` and `ScreenStateView.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T043 green.
- [ ] T045 [P] Write failing tests for `formatQuantity` in `apps/mobile/src/adapters/ui/components/format-quantity.test.ts`: `{1.5, "kg"}` → "1,5 kg", `{6, null}` → "6", `{2, "L"}` → "2 L", `{0.125, "kg"}` → "0,125 kg", `{9999, null}` → "9999" (no digit grouping), and the output of `{1.5}` parses back through `parseQuantity` to 1.5 (FR-017).
- [ ] T046 [P] Implement `formatQuantity` with `Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3, useGrouping: false })` in `apps/mobile/src/adapters/ui/components/format-quantity.ts` to turn T045 green.

### Application store core ([002 ui-state contract](../002-manage-articles/contracts/ui-state.md))

- [ ] T047 Write failing store-core tests in `apps/mobile/src/adapters/ui/state/app-store.test.ts`, on a store built by `createAppStore({ useCases, errorReporter })` with use cases on in-memory fakes and a `RecordingErrorReporter`:
  - every region starts `idle`;
  - `notice` starts `null`, and `dismissNotice()` clears it;
  - `pendingUndo` starts `null`.
- [ ] T048 Implement `createAppStore` with `createStore` from `zustand/vanilla` and the `AppState`, `ScreenState<T, E>` (`idle | loading | error | empty | success`) and `Notice` types in `apps/mobile/src/adapters/ui/state/app-store.ts`, to turn T047 green. Use no middleware.
- [ ] T049 Write failing tests in `apps/mobile/src/adapters/ui/state/app-store.write-rules.test.ts` for the shared write rules, through a test-only write action:
  - every write goes through one store-wide queue, in the order the actions were called: with the first use case held pending, a second write starts only after the first resolves (FR-004, [research.md](research.md) R9);
  - a write that succeeds clears `pendingUndo`; a write that fails (a throw or a `Result` error) or returns refused input leaves `pendingUndo` as it was (FR-010, R8);
  - after success, `refresh()` reloads every region that is not `idle`, keeping `success` / `empty` data on screen while it reloads;
  - an unexpected throw is reported with `{ operation, screen }` only, sets `notice = { type: 'writeFailed' }`, leaves state unchanged and resolves to `{ ok: false, error: { type: 'WriteFailed' } }`;
  - a throw of `StorageFull` is handled the same way except that it sets `notice = { type: 'storageFull' }` and is not reported (FR-030, R12a);
  - a `Result` error of refused input (`NameRequired`, `NameAlreadyUsed`, `AmountNotPositive`) or `AlreadyOnList` from `addArticleToList` is returned unchanged and not reported;
  - `AlreadyOnList` from `restoreRemovedItem` is a failed restore: `notice = { type: 'writeFailed' }`, reported as an `UnexpectedResult` with code `AlreadyOnList` (FR-010);
  - any other `Result` error (`ItemNotOnList`, `ListNotFound`) is handled like an unexpected throw (`notice = { type: 'writeFailed' }`, state unchanged, resolves to `WriteFailed`) and reported as an `UnexpectedResult` error whose `code` is the tag and whose message is fixed ([contracts/driving-ports.md](contracts/driving-ports.md#conventions)).
- [ ] T050 Implement the internal `runWrite` helper (with the store-wide write queue) and `refresh()` in `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T049 green.
- [ ] T051 Implement `AppStoreProvider` (React context) in `apps/mobile/src/adapters/ui/state/app-store-provider.tsx` and `useAppStore(selector)` (wraps `useStore`) in `apps/mobile/src/adapters/ui/state/use-app-store.ts`, with a test rendering a component that selects a slice. Add the `renderWithStore(ui, { seed? })` helper in `apps/mobile/src/adapters/ui/testing/render-with-store.tsx`: it builds fresh fakes, use cases, store, theme and navigation container for each test.
- [ ] T052 [P] Write failing tests for `NoticeSnackbar` in `apps/mobile/src/adapters/ui/components/notice-snackbar.test.tsx`: `writeFailed` shows "La modification n'a pas pu être enregistrée.", `storageFull` shows "Espace de stockage insuffisant. Libérez de la place sur votre téléphone.", `articleAdded` shows "« {name} » ajouté", and dismissing calls `dismissNotice`. Each notice is announced with its French text as it appears (`AccessibilityInfo.announceForAccessibility` mocked, FR-038).
- [ ] T053 [P] Implement `NoticeSnackbar.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T052 green.

### App shell and composition

- [ ] T054 Add the French seed in `apps/mobile/src/adapters/ui/seed.ts`: `categoryNames` = Fruits et légumes, Boucherie et poissonnerie, Crèmerie, Boulangerie, Épicerie salée, Épicerie sucrée, Surgelés, Boissons, Hygiène et beauté, Entretien, Divers (this order), and `firstListName` = "Ma liste". Test that the order matches the spec's Assumptions.
- [ ] T055 Write a failing test in `apps/mobile/src/adapters/ui/navigation.test.tsx`: through `renderWithStore`, the initial route is `CurrentList` and a `notice` set in the store shows in the root `NoticeSnackbar`; with a `RecordingErrorReporter` given as `errorReporter`, `CurrentList` is recorded through `setScreen` when the navigation is ready, and `Lists` when the test navigates there ([contracts/driven-ports.md](contracts/driven-ports.md#errorreporter)). Then add the navigation in `apps/mobile/src/adapters/ui/navigation.tsx` (React Navigation 7 native stack): `Navigation({ errorReporter })` with `CurrentList` (initial), `Lists`, `AddArticles` and `CreateArticle` as typed placeholder screens, replaced in the story phases, `NoticeSnackbar` rendered once at the root, and the container's `onReady` and `onStateChange` giving the current route name to `errorReporter.setScreen`.
- [ ] T056 Write failing tests for `createStoryStore(scenario)` in `apps/mobile/src/adapters/ui/testing/story-store.test.ts`. The scenario is `{ seed?: Fixture; pending?: UseCaseName[]; failing?: UseCaseName[]; failingWith?: Partial<Record<UseCaseName, 'storageFull'>>; prepare?: (store) => Promise<void> }`, where `UseCaseName` is the union of the entry names of `UseCases`:
  - it builds fresh in-memory fakes holding `seed`, the real use cases, a `RecordingErrorReporter` and `createAppStore`, and returns the store;
  - a use case named in `pending` returns a promise that never settles, and one named in `failing` rejects with an `Error` (or with `StorageFull` when listed in the scenario's `failingWith: { [name]: 'storageFull' }`); the others are the real ones (test with `initializeStore`, the only use case so far);
  - `prepare` runs after the store is built and may call store actions only (for example a failing write that sets `notice`); the scenario offers no way to set state directly, so a story cannot show a state the store cannot reach ([research.md](research.md) R22).
- [ ] T057 Implement `createStoryStore` in `apps/mobile/src/adapters/ui/testing/story-store.ts` to turn T056 green. Add the French fixtures in `apps/mobile/src/adapters/ui/testing/fixtures.ts`: the default categories from `apps/mobile/src/adapters/ui/seed.ts`; the lists "Ma liste" (current) and "Barbecue"; the articles "Lait" (Crèmerie, 2 L), "Pommes" (Fruits et légumes), "Farine" (Épicerie salée, 1,5 kg), "Beurre" (Crèmerie); and one article whose name is exactly 60 characters, the "At most 60 characters after cleaning, counted in Unicode code points" limit, to check wrapping. Then refactor `renderWithStore` (T051) to build its store with `createStoryStore`, every test kept green, so stories and screen tests share one set of fixtures.
- [ ] T058 Write failing tests in `apps/mobile/src/adapters/ui/testing/story-decorator.test.tsx` for `withAppProviders`, the decorator every story uses: it wraps the story in `ThemeProvider` (light or dark from `useColorScheme`), `AppStoreProvider` with the store from `createStoryStore(parameters.scenario ?? {})`, `SafeAreaProvider` and a `NavigationContainer` with a one-screen native stack that renders the story, so screens can call `useNavigation`. Implement it in `apps/mobile/src/adapters/ui/testing/story-decorator.tsx` and register it in `apps/mobile/.rnstorybook/preview.tsx` to turn the tests green. Form errors (a name already used, an invalid quantity) are local form state, not a `ScreenState`: each screen or dialog with a form keeps its fields in a presentational `…Form` component (values, errors and callbacks as props) that it wraps, and error stories render that form with the error.
- [ ] T059 Add the shared component stories that exist at this point. First add `Components/LoadingState/Default`, `Components/EmptyState/WithAction`, `Components/EmptyState/WithoutAction` and `Components/ErrorState/Default` to `requiredStories` and see the story test fail. Then write `LoadingState.stories.tsx`, `EmptyState.stories.tsx` and `ErrorState.stories.tsx` in `apps/mobile/src/adapters/ui/components/`, with French texts from [contracts/ui-screens.md](contracts/ui-screens.md), to turn it green. Open them with `yarn storybook` in light and dark mode.
- [ ] T060 Add `apps/mobile/src/adapters/ui/use-cases.ts`, the `UseCases` type the store depends on: one entry per use case in [contracts/driving-ports.md](contracts/driving-ports.md), filled in story by story.
- [ ] T061 Implement the composition root in `apps/mobile/src/composition/composition-root.ts` ([research.md](research.md) R18a):
  - `createErrorReporter()`: Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set, with the environment from `EXPO_PUBLIC_APP_ENVIRONMENT` (T038, T134), console otherwise. `App.tsx` builds it once, first, so a storage failure at startup can be reported;
  - `composeApp(reporter)`: `openDatabase()`, then the SQLite `UnitOfWork` and `CryptoIdGenerator`; build the use cases, run `initializeStore(seed)`, then `createAppStore`. If a step after `openDatabase()` throws, it closes the database and rethrows. It never deletes, recreates or overwrites the database file.

  It is the only module that knows every adapter.
- [ ] T062 Write a failing test in `App.test.tsx` with `composeApp` mocked ([contracts/ui-screens.md](contracts/ui-screens.md#app-startup-fr-039)): `LoadingState` while it initializes, then CurrentList; when it throws, the full-screen `StartupError` with "L'application n'a pas pu démarrer." and "Réessayer", and one report with `{ operation: 'startup' }`; "Réessayer" shows `LoadingState` and calls `composeApp` again, reaching CurrentList when it succeeds, or `StartupError` and a second report when it throws again (FR-039); when it throws `DataFromNewerVersion`, the full-screen `UpdateRequired` with "Cette version de l'application est trop ancienne pour vos données. Mettez-la à jour.", no button, and no report (FR-040). Then write `StartupError` in `apps/mobile/src/adapters/ui/screens/StartupError.tsx` on the shared `ErrorState`, and `UpdateRequired` in `apps/mobile/src/adapters/ui/screens/UpdateRequired.tsx` on the shared `EmptyState` without action (it needs no store or navigation, which do not exist yet), and wire `apps/mobile/App.tsx`: build the reporter, call `composeApp` and render `ThemeProvider` → `AppStoreProvider` → `SafeAreaProvider` → `Navigation` given the reporter (T055), with `LoadingState` while it runs, `UpdateRequired` if it throws `DataFromNewerVersion`, and `StartupError` if it throws anything else. Finally add `Screens/Startup/Error` and `Screens/Startup/UpdateRequired` to `required-stories.ts`, see the story test fail, and write `apps/mobile/src/adapters/ui/screens/StartupError.stories.tsx` (`StartupError` with a no-op retry) and `UpdateRequired.stories.tsx` (no store scenario: the app has no store when they show), to turn it green.

  The tests say "a second report" because each failure goes to `report` again; `RecordingErrorReporter` records every call, and the once-per-opening drop belongs to the Sentry adapter (T038, [research.md](research.md) R13).

  Then the error boundary (FR-039a, [research.md](research.md) R13a, [contracts/ui-screens.md](contracts/ui-screens.md#a-screen-fails-while-drawing-fr-039a)). Extend `App.test.tsx` first, with a test-only screen that throws while rendering, made reachable from the mocked `composeApp`: the app is replaced by the full-screen `CrashError` with "Une erreur est survenue." and "Réessayer", and one report with `{ operation: 'render', screen }` names the route shown; "Réessayer" shows `LoadingState` and calls `composeApp` again, reaching CurrentList when it succeeds, or `CrashError` and a second report when the screen throws again; no call deletes, resets or overwrites data (the mocked `composeApp` is only called again). Then write `AppErrorBoundary` in `apps/mobile/src/adapters/ui/components/app-error-boundary.tsx` (a class component with `getDerivedStateFromError` and `componentDidCatch`, reporting through the `ErrorReporter` it receives and never rethrowing) and `CrashError` in `apps/mobile/src/adapters/ui/screens/CrashError.tsx` on the shared `ErrorState`, and wrap the navigation in `App.tsx` with the boundary, whose "Réessayer" runs the same restart as `StartupError`. Finally add `Screens/Crash/Error` to `required-stories.ts`, see the story test fail, and write `apps/mobile/src/adapters/ui/screens/CrashError.stories.tsx` (no store scenario) to turn it green.
- [ ] T063 [P] Add the `apps/mobile/jest.setup.ts` global mocks needed by `jest-expo` (`@sentry/react-native`, `expo-sqlite` never loaded in UI tests), referenced from `apps/mobile/jest.config.js`.
- [ ] T064 Write a composition test in `apps/mobile/src/composition/composition-root.test.ts` with `openDatabase` replaced by a `node:sqlite` database: a fresh start seeds 11 categories and "Ma liste" as current, and a second start does not seed again; the replacement database goes through `configureDatabase` like `openDatabase` does; when `initializeStore` throws, `composeApp` closes the database and rethrows, and a later `composeApp` on the same file finds the earlier data intact (FR-039).

**Checkpoint**: the app launches on a seeded store and shows the CurrentList placeholder; every test (the story test included), the architecture test, the bundle and the launch journey are green; Storybook shows the state components in light and dark.

---

## Phase 3: User Story 1 - Tick items off the current list while shopping (Priority: P1) 🎯 MVP

**Goal**: the app opens on the current list, grouped by category, with quantities; tap to tick or
untick at once; the remaining count; "Terminer les courses"; explicit loading, empty and error
states; works offline.

**Independent Test**: seed a current list with a few items (fakes in tests; on a device, items
added through US2). Open the app, tick and untick, kill and reopen, check the ticks were kept, then
finish shopping and check every item is unticked and still present.

### Tests for User Story 1 ⚠️ (write first, confirm they fail)

- [ ] T065 [US1] Write the failing journey `tests/e2e/journeys/first-launch.e2e.ts` ([contracts/ui-validation.md](contracts/ui-validation.md#end-to-end-journeys)): on a fresh install (`device.launchApp({ delete: true, newInstance: true })`), the app opens on "Ma liste" with "Votre liste est vide" and "Ajouter des articles" (US3-1, US1-10), found by text only. Delete `launch.e2e.ts` (T014), whose check this one includes. Run `yarn test:e2e:android` and confirm it fails on the placeholder screen.
- [ ] T066 [P] [US1] Write failing domain tests for the current list view in `apps/mobile/src/domain/current-list-view.test.ts`:
  - sections only for categories holding an item of the list, ordered by `position` (FR-003, US4-5);
  - within a section, unticked items first, then ticked, each group sorted with `compareNames` (`Intl.Collator('fr', { sensitivity: 'base', numeric: true })`), so "Lait 2 L" comes before "Lait 10 L" (US1-6, FR-005, Assumptions);
  - `remainingCount` = unticked items (US1-7, FR-006: 5 items with 2 ticked → 3);
  - `totalCount`, and `hasItemsInCart`.
- [ ] T067 [P] [US1] Write failing domain tests for the list item transitions in `apps/mobile/src/domain/list-item.test.ts`:
  - `toggle` flips `inCart` (US1-2, US1-3);
  - `finish` sets every `inCart = false` and keeps quantities and items (US1-8);
  - `finish` on a list with nothing in the cart succeeds and changes nothing (FR-007).
- [ ] T068 [P] [US1] Write failing use case tests on fakes:
  - `apps/mobile/src/application/use-cases/get-current-list.test.ts`: it returns the `CurrentListView` of the current list (US1-1);
  - `apps/mobile/src/application/use-cases/toggle-item-in-cart.test.ts`: it flips and persists (US1-4), and returns `ItemNotOnList` for an unknown item;
  - `apps/mobile/src/application/use-cases/finish-shopping.test.ts`: it unticks all and keeps quantities (US1-8), and with nothing in the cart succeeds with no change (FR-007).
- [ ] T069 [P] [US1] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.current-list.test.ts`:
  - `loadCurrentList()` goes `loading` → `success` / `empty`, and on a throw goes `error` and reports `{ operation: 'getCurrentList', screen: 'CurrentList' }` (US1-12);
  - `toggleItem` updates the region immediately (optimistic) before the use case resolves, then keeps it (US1-2, US1-3), with `remainingCount` and `hasItemsInCart` updated at once too: the first tick on a list with none sets `hasItemsInCart` before its save resolves, and a failed save of the only tick sets it back to `false` (FR-007);
  - quick toggles on one item are saved one after the other in tap order: with the use case held pending, three taps show ticked, unticked, ticked at once, and `toggleItemInCart` is called a second time only after the first call resolves; toggles on other items and other writes join the same queue behind them (FR-004, [research.md](research.md) R9);
  - a failed toggle drops the toggles still queued for that item, reloads the region so the item shows the state stored on the device, sets `notice = writeFailed` and reports `{ operation: 'toggleItemInCart' }` (edge case "storage fails"): after taps 1 (saved), 2 (fails) and 3 (queued), the item shows the state after tap 1 and the use case was called twice; a toggle of another item queued behind the failure is still saved;
  - a queued toggle that throws `StorageFull` is handled the same way, except that it sets `notice = storageFull` and reports nothing (FR-030, R12a);
  - `finishShopping` called while toggles are still queued runs after them, and is still saved when one of them fails, so every item ends unticked (FR-004, FR-007);
  - when the only tick fails and a queued `finishShopping` then finds nothing in the cart, it succeeds with no change: the one notice is the tick's `writeFailed` and there is one report (FR-007);
  - `finishShopping` refreshes the list; when it throws, no item changes in the region, `notice = writeFailed` and `{ operation: 'finishShopping' }` is reported (FR-007, R9a).
- [ ] T070 [P] [US1] Write failing component tests for `ListItemRow` in `apps/mobile/src/adapters/ui/components/list-item-row.test.tsx`:
  - role `checkbox` with the `checked` state;
  - the label "Lait, 2 L, dans le caddie" or "Pommes, pas dans le caddie" (FR-032);
  - a ticked row shows a check mark and struck-through text, not only a color (FR-035);
  - a ticked row's text uses `theme.colors.onSurfaceVariant` and the row has no `opacity` style, so its contrast is the one T041 checks (FR-036);
  - the row has `minHeight` 48 (FR-034);
  - the name has no `numberOfLines`, so long names wrap (FR-033);
  - tapping calls `onToggle`.
- [ ] T071 [US1] Write failing screen tests for `CurrentList` in `apps/mobile/src/adapters/ui/screens/current-list-screen.test.tsx`, through `renderWithStore`:
  - US1-1: the list name is in the Appbar, items sit under category headings, and "Lait" shows "2 L";
  - US1-2 / US1-3: tapping ticks and unticks immediately;
  - US1-6, FR-005: ticked items move after unticked ones;
  - US1-7, FR-006: the subtitle reads "3 articles restants", "1 article restant", or "Tout est dans le caddie";
  - US1-10: "Votre liste est vide" with "Ajouter des articles";
  - US1-11, FR-029: `LoadingState` shows while the use case is pending;
  - US1-12: "Impossible de charger la liste." with "Réessayer" retrying, and the error reported;
  - US4-5: an empty category heading is not shown;
  - "Terminer les courses" is absent when nothing is ticked;
  - FR-037: with `AccessibilityInfo` mocked, a row keeps screen reader focus when ticking moves it below the unticked rows, and the remaining count is not announced (FR-038).
- [ ] T072 [US1] Write failing tests for finishing in `apps/mobile/src/adapters/ui/screens/finish-shopping-dialog.test.tsx`:
  - the dialog text is "Terminer les courses ?" / "Tous les articles seront décochés et resteront dans la liste.";
  - US1-8: "Terminer" unticks all, and items and quantities stay;
  - US1-9: "Annuler" changes nothing;
  - FR-007: when `finishShopping` fails, every item stays as it was, the dialog closes, focus goes back to "Terminer les courses" (still shown), and the snackbar "La modification n'a pas pu être enregistrée." appears;
  - FR-037: opening moves focus to the dialog title; "Annuler" gives it back to "Terminer les courses", and "Terminer", which hides that action, gives it to the Appbar title.
- [ ] T073 [US1] Write a failing offline test for US1-5 in `apps/mobile/src/adapters/ui/screens/current-list-offline.test.tsx`: with `global.fetch` replaced by a function that throws, open the app and tick items. Everything works and no error is shown or reported.

### Implementation for User Story 1

- [ ] T074 [P] [US1] Implement `buildCurrentListView` in `apps/mobile/src/domain/current-list-view.ts` to turn T066 green.
- [ ] T075 [P] [US1] Implement `toggle` and `finish` with the `ItemNotOnList` error in `apps/mobile/src/domain/list-item.ts` to turn T067 green.
- [ ] T076 [US1] Implement `getCurrentList`, `toggleItemInCart` and `finishShopping` in `apps/mobile/src/application/use-cases/get-current-list.ts`, `toggle-item-in-cart.ts` and `finish-shopping.ts`, per [contracts/driving-ports.md](contracts/driving-ports.md#current-list-user-story-1), to turn T068 green. Add them to `UseCases` (`apps/mobile/src/adapters/ui/use-cases.ts`) and to the composition root.
- [ ] T077 [US1] Add the `currentList` region and the `loadCurrentList`, `toggleItem` (optimistic, saved through the store's single write queue, and on failure the item's queued toggles dropped and the region reloaded, [research.md](research.md) R9) and `finishShopping` actions to `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T069 green.
- [ ] T078 [P] [US1] Implement `ListItemRow.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T070 green. Leave the trailing action slots empty for now; US2 fills them.
- [ ] T079 [US1] Implement `CurrentListScreen.tsx` in `apps/mobile/src/adapters/ui/screens/`:
  - a `SectionList` with one section per category, memoized rows identified by article id ([research.md](research.md) R11);
  - Appbar title and subtitle;
  - the "Terminer les courses" action, shown only when `hasItemsInCart`;
  - the "Mes listes" action and the FAB "Ajouter", wired to placeholder routes;
  - `ScreenStateView` for the states;
  - a ticked row keeps focus when it moves (FR-037): rows keyed by article id keep their native view.

  Replace the placeholder in `navigation.tsx`. It turns T071 and T073 green.
- [ ] T080 [US1] Implement `FinishShoppingDialog.tsx` in `apps/mobile/src/adapters/ui/screens/` (Paper `Dialog` in a `Portal`) and open it from CurrentList, with the focus moves of FR-037, to turn T072 green.
- [ ] T081 [US1] Add the US1 ids of [contracts/ui-validation.md](contracts/ui-validation.md#required-stories) to `apps/mobile/src/adapters/ui/required-stories.ts`: `Components/ListItemRow/NotInCart`, `.../InCart`, `.../WithQuantity`, `.../LongName`, `Components/NoticeSnackbar/WriteFailed`, `Components/NoticeSnackbar/StorageFull`, `Screens/CurrentList/Loading`, `.../Error`, `.../Empty`, `.../Success`, `.../AllInCart` and `Dialogs/FinishShoppingDialog/Default`. Run the story test and confirm it fails on each missing story.
- [ ] T082 [US1] Write the stories to turn T081 green:
  - `apps/mobile/src/adapters/ui/components/ListItemRow.stories.tsx`, from the fixtures (the long-name story uses the 60-character article);
  - `apps/mobile/src/adapters/ui/components/NoticeSnackbar.stories.tsx`: scenario with `failing: ['toggleItemInCart']` and a `prepare` that loads the current list and toggles an item, and a `StorageFull` story with `failingWith: { toggleItemInCart: 'storageFull' }` and the same `prepare`;
  - `apps/mobile/src/adapters/ui/screens/CurrentListScreen.stories.tsx`: `pending: ['getCurrentList']` (Loading), `failing: ['getCurrentList']` (Error), an empty "Ma liste" (Empty), several categories with ticked, unticked and quantified items (Success), every item ticked (AllInCart);
  - `apps/mobile/src/adapters/ui/screens/FinishShoppingDialog.stories.tsx`.

  Review them with `yarn storybook` on Android and iOS, in light and dark mode and at 200% text size.
- [ ] T083 [US1] Make `first-launch.e2e.ts` (T065) green with `yarn test:e2e:android` and `yarn test:e2e:ios`. Any production fix it forces starts with its own failing unit or screen test.

**Checkpoint**: on a device with items added through US2, US1 works end to end, offline included; its stories are in Storybook and `first-launch.e2e.ts` is green on both platforms. This is the first half of the MVP. The US1 journeys that need items (ticking, persistence, finishing) are written in US2, which adds them.

---

## Phase 4: User Story 2 - Add and remove items on a list, with an optional quantity (Priority: P1)

**Goal**: browse or search the catalog, add with an optional quantity, create an article on the
spot, mark articles already on the list, change or clear a quantity, remove with a 5-second
"Annuler" (no timeout while a screen reader is on).

**Independent Test**: from an empty current list, add existing articles with and without a
quantity, create a new article, change a quantity, remove one item and undo, and check the list
content matches.

### Tests for User Story 2 ⚠️ (write first, confirm they fail)

- [ ] T084 [US2] Write the failing journeys of [contracts/ui-validation.md](contracts/ui-validation.md#end-to-end-journeys) that need items to be added, each in `tests/e2e/journeys/`, starting from a fresh install, finding elements by French text and accessibility label only:
  - extend `first-launch.e2e.ts`: "Ajouter" shows the 11 default categories in the spec's order (US4-1);
  - `add-and-tick.e2e.ts`: create "Lait" in Crèmerie with "2" "L" and add it, add an existing article, go back, tick "Lait": the row's label becomes "Lait, 2 L, dans le caddie", it moves below the unticked items, and the remaining count updates (US2-7, US2-2, US1-2, US1-6, US1-7);
  - `persistence.e2e.ts`: add and tick an item, `device.terminateApp()`, `device.launchApp({ newInstance: true })`: the tick and the items are kept (US1-4, SC-007, FR-028);
  - `remove-and-undo.e2e.ts`: remove a ticked item with a quantity, tap "Annuler" in the snackbar: it is back, ticked, with its quantity (US2-6, US2-16);
  - `finish-shopping.e2e.ts`: "Terminer les courses" then "Annuler" changes nothing; again with "Terminer": every item is unticked and kept (US1-8, US1-9).

  Run `yarn test:e2e:android` and confirm each fails for a missing screen or action.
- [ ] T085 [P] [US2] Write failing domain tests for the catalog view in `apps/mobile/src/domain/catalog-view.test.ts`. `buildCatalogView` builds the full view (no query); the query rules below are tested on `filterCatalog(view, query)`, which filters an already built view in memory ([research.md](research.md) R11a, SC-011):
  - `buildCatalogView`: every category ordered by `position`, including empty ones (US2-15), and each article carries its `searchText` = `searchForm(name)`, computed once when the view is built;
  - `filterCatalog` matches on the article's `searchText`, not on its name: an article built by hand with `searchText` "zzz" is found by "zz", so the search form is never recomputed while typing;
  - `filterCatalog` keeps the order of the full view (sections and articles) and sorts nothing again;
  - with a query: only articles whose `searchText` contains `searchForm(query)`, so "pom" finds "Pommes" and "Pommes de terre" and "POM" finds them too, ignoring case and accents (FR-009, US2-10);
  - empty categories are omitted under a query, and no section at all means no match (US2-14);
  - "oeuf" and "œuf" both find "Œufs" (US2-10), and "d'amande" finds "Pâte d’amande" (FR-009);
  - "mais" finds "Maïs" and "francais" finds "Pain français": the cedilla and diaeresis are ignored like accents (FR-009);
  - "   " is treated as no query: every category is shown, empty ones included (US2-10, FR-009);
  - "pommes  de" (double space) finds "Pommes de terre" (FR-009);
  - `onList` and the target-list `quantity` are set for articles already on the list (US2-8);
  - articles are sorted by name with `compareNames`, numbers by value ("Pack 6" before "Pack 12", Assumptions).
- [ ] T086 [P] [US2] Write failing domain tests for adding to a list in `apps/mobile/src/domain/list-item.test.ts`:
  - `add` creates an unticked item (FR-012) with the given quantity or none (US2-1, US2-2, FR-013, FR-014);
  - adding an article already on the list → `AlreadyOnList` carrying the current quantity (FR-011);
  - `changeQuantity` keeps `inCart` and sets or clears the quantity (US2-3, US2-4, FR-015).
- [ ] T087 [P] [US2] Write failing use case tests on fakes, one file each in `apps/mobile/src/application/use-cases/`:
  - `get-catalog.test.ts`: the catalog with `onList` marks for the given list; with a query, the same result as `filterCatalog` applied to the full view (R11a);
  - `add-article-to-list.test.ts`: US2-1 and FR-008; US2-2; US2-5, the same article on two lists keeps a quantity per list; `AlreadyOnList`; `ArticleNotFound`;
  - `create-article-and-add-to-list.test.ts`: US2-7 and FR-018, created and added in one transaction; US2-9, " beurre " → `NameAlreadyUsed` with `existing` = "Beurre" and nothing created, and "pommes  de  terre" → `NameAlreadyUsed` with `existing` = "Pommes de terre", and "Oeufs" → `NameAlreadyUsed` with `existing` = "Œufs" (FR-021); a new name is stored cleaned, so "  Houmous   maison " is created as "Houmous maison" (FR-022); US2-11, `NameRequired`; `NameTooLong`; `CategoryNotFound`;
  - `change-item-quantity.test.ts`: US2-3, the article itself is unchanged; US2-4, cleared; `ItemNotOnList`;
  - `remove-item-from-list.test.ts`: US2-6, the item is gone, the article stays in the catalog, and a `RemovedItem` is returned;
  - `restore-removed-item.test.ts`: US2-16, back ticked with "2 kg"; `AlreadyOnList` / `ListNotFound` / `ArticleNotFound`;
  - `get-categories.test.ts`: ordered by `position`.
- [ ] T088 [P] [US2] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.edit-list.test.ts`:
  - `loadCatalog()` calls `getCatalog` without a query and loads `catalog.full` and `catalog.view` with the region states, reporting `{ operation: 'getCatalog', screen: 'AddArticles' }` on failure; "Réessayer" calls it again ([002 ui-state contract](../002-manage-articles/contracts/ui-state.md));
  - `searchCatalog(query)` sets `catalog.query` and derives `catalog.view` from `catalog.full` with `filterCatalog`, synchronously, with no storage read: with a `getCatalog` fake that throws on any call after the first, searching "p", "po" then "pom" shows the matches each time, `catalog.view` never goes through `loading`, and nothing is reported (SC-011, [research.md](research.md) R11a);
  - a search for "   " gives the full view; a query with no match gives the `empty` state with that query (US2-10, US2-14);
  - a successful write reloads `catalog.full` and applies the current query again, so an article just added shows its "Déjà dans la liste" mark under the same search;
  - `addArticleToList` and `createArticleAndAddToList` return their `Result`, refresh, and set `notice = { type: 'articleAdded', name }` on success;
  - `changeItemQuantity` refreshes;
  - `removeItem` sets `pendingUndo = { kind: 'removedItem', removed, name }`;
  - a removal queued behind a toggle of the same item that fails is still saved, and its `removed` snapshot holds the ticked state stored on the device (FR-004);
  - `undo()` clears `pendingUndo`, restores and refreshes; on failure the item stays removed, the offer stays ended (`pendingUndo` is not set again), `notice = writeFailed`, and `{ operation: 'restoreRemovedItem', screen }` is reported, with the screen shown at that moment (FR-010, [research.md](research.md) R8);
  - `dismissUndo()` clears the offer;
  - a successful write clears a pending offer, a toggle included; a failed write or refused input (`NameRequired`, `AmountNotPositive`) leaves it (FR-010);
  - `undo()` called while an earlier write is still queued is carried out when its turn comes, even if that write ends the offer (R8);
  - a new removal replaces the previous offer;
  - a store built afresh on the same fakes, standing for a closed app, has `pendingUndo = null`: the removal is final (FR-010).
- [ ] T089 [P] [US2] Write failing component tests:
  - `apps/mobile/src/adapters/ui/components/article-row.test.tsx`: the "Déjà dans la liste" chip appears only when `onList`, and the row is ≥ 48 dp;
  - `apps/mobile/src/adapters/ui/components/quantity-fields.test.tsx`: the labels "Quantité" and "Unité", a decimal numeric input mode, and `HelperText` errors, each announced with its French text as it appears (FR-038);
  - `apps/mobile/src/adapters/ui/components/name-field.test.tsx`: the label "Nom", no native `maxLength` (it counts UTF-16 units; the 60-character limit is the `NameTooLong` error, [research.md](research.md) R6), and a `HelperText` error, announced as it appears (FR-038).
- [ ] T090 [P] [US2] Write failing tests for `UndoSnackbar` in `apps/mobile/src/adapters/ui/components/undo-snackbar.test.tsx`:
  - `removedItem` shows "« {name} » retiré de la liste" with "Annuler" calling `undo`, and announces that text with "Annuler" as it appears (FR-038);
  - it calls `dismissUndo` after 5 s (Jest fake timers);
  - with the fake clock advanced 6 s while `AppState` is `background`, returning to `active` calls `dismissUndo` at once (FR-010);
  - with a screen reader on, an offer 8 s old stays; turning the screen reader off then calls `dismissUndo` at once, while turning it off 2 s after the removal leaves the offer until 5 s have passed (FR-010);
  - with a screen reader on (mocked `AccessibilityInfo`), it does not call `dismissUndo` after 5 s and stays until dismissed or the next write (FR-010);
  - it stays visible across navigation, because it is rendered at the root.
- [ ] T091 [US2] Write failing tests for `QuantityDialog` in `apps/mobile/src/adapters/ui/screens/quantity-dialog.test.tsx`:
  - add mode: "Ajouter" with empty fields adds without a quantity (SC-003);
  - FR-016 errors: "La quantité doit être un nombre positif écrit en chiffres, par exemple 2 ou 1,5." for "0", "-1", "abc" and "1 000" (US2-12); "La quantité ne peut pas avoir plus de 3 décimales." for "1,2345"; "La quantité ne peut pas dépasser 9999." for "10000"; "Indiquez une quantité pour cette unité." (US2-13); "L'unité ne peut pas dépasser 15 caractères.";
  - "1.5" + "kg" is shown as "1,5 kg" on the list (US2-2), and "1,50" as "1,5" (FR-017);
  - edit mode prefills "1,5" for 1.5, and saving it unchanged keeps 1.5;
  - already-on-list mode: "« {name} » est déjà dans la liste." with the fields prefilled and the buttons "Fermer" and "Modifier la quantité" (US2-8);
  - edit mode: "Effacer la quantité" (US2-4);
  - FR-037: opening moves focus to the dialog title, and closing gives it back to the row that opened it.
- [ ] T092 [US2] Write failing screen tests for `AddArticles` in `apps/mobile/src/adapters/ui/screens/add-articles-screen.test.tsx`:
  - Appbar "Ajouter des articles" and the Searchbar placeholder "Rechercher un article";
  - US2-15: an empty category shows "Aucun article dans cette catégorie" with "Créer un article", which opens CreateArticle with that category preselected (FR-018);
  - US2-10: search results grouped by category; typing only spaces shows the full catalog, not the no-match state;
  - US2-14: "Aucun article ne correspond à « xyz »" with "Créer « xyz »";
  - US2-8: the "Déjà dans la liste" mark, and tapping opens already-on-list mode without duplicating;
  - adding keeps the screen open and shows "« {name} » ajouté";
  - US2-17, FR-029: loading, shown when the screen opens (it calls `loadCatalog` on mount);
  - typing in the Searchbar never shows `LoadingState` and calls no use case: each letter filters the loaded catalog (FR-029, SC-011, [research.md](research.md) R11a);
  - US2-18: error "Impossible de charger les articles." with "Réessayer", reported;
  - US2-19, FR-008: the "Nouvel article" action is shown with and without matches; with "Pâte" in the catalog, searching " pâté " shows "Pâte", and "Nouvel article" opens CreateArticle with the name "pâté" (the query cleaned).
- [ ] T093 [US2] Write failing screen tests for `CreateArticle` in `apps/mobile/src/adapters/ui/screens/create-article-screen.test.tsx`:
  - Appbar "Nouvel article";
  - the "Nom" field, the category radio list from `getCategories`, the optional quantity, and "Créer et ajouter";
  - US2-7: "Houmous" + "Épicerie salée" is created and added, the screen goes back to AddArticles, and the snackbar shows "« Houmous » ajouté";
  - US2-11: "Indiquez un nom.";
  - "Le nom ne peut pas dépasser 60 caractères.";
  - US2-9: "« Beurre » existe déjà." with "Ajouter « Beurre »" adding the existing article with the quantity typed in the form ("500 g");
  - US2-20, FR-011: when "Beurre" is already on the current list with "250 g", "Ajouter « Beurre »" opens QuantityDialog in already-on-list mode prefilled with "250 g", and nothing is added;
  - FR-018: opened from the empty state of "Boissons", "Boissons" is preselected; opened from "Nouvel article", no category is preselected;
  - "Choisissez une catégorie." when no category is chosen.
- [ ] T094 [US2] Extend `apps/mobile/src/adapters/ui/screens/current-list-screen.test.tsx` with failing tests:
  - the row action and accessibility action "Modifier la quantité" opens QuantityDialog prefilled, and saving shows the new quantity (US2-3, US2-4);
  - "Retirer de la liste" removes at once and shows "« Beurre » retiré de la liste" with "Annuler" (US2-6);
  - "Annuler" restores the item ticked with "2 kg" (US2-16);
  - after 5 s the offer is gone;
  - FR-037: after a removal, focus moves to the next row, or the previous one when the removed row was last, or the `EmptyState` when the list becomes empty;
  - the FAB "Ajouter" opens AddArticles, and coming back shows the added items.

### Implementation for User Story 2

- [ ] T095 [P] [US2] Implement `buildCatalogView` (each article with its `searchText`) and `filterCatalog(view, query)` in `apps/mobile/src/domain/catalog-view.ts` to turn T085 green ([data-model.md](data-model.md#read-models-returned-by-query-use-cases), [research.md](research.md) R11a).
- [ ] T096 [P] [US2] Implement `add` and `changeQuantity` with the `AlreadyOnList` error in `apps/mobile/src/domain/list-item.ts` to turn T086 green.
- [ ] T097 [US2] Implement the use cases in `apps/mobile/src/application/use-cases/` to turn T087 green, per [contracts/driving-ports.md](contracts/driving-ports.md#editing-a-list-user-story-2): `get-catalog.ts` (building the full view, then applying `filterCatalog` when a query is given), `add-article-to-list.ts`, `create-article-and-add-to-list.ts`, `change-item-quantity.ts`, `remove-item-from-list.ts`, `restore-removed-item.ts`, `get-categories.ts`. Every write runs in `UnitOfWork.run`. Add them to `UseCases` and to the composition root.
- [ ] T098 [US2] Add the `catalog` region (`query`, `full` and `view`, per the [002 ui-state contract](../002-manage-articles/contracts/ui-state.md)) and the `loadCatalog`, `searchCatalog` (synchronous, filtering `full` with `filterCatalog`), `addArticleToList`, `createArticleAndAddToList`, `changeItemQuantity`, `removeItem`, `undo` and `dismissUndo` actions to `apps/mobile/src/adapters/ui/state/app-store.ts`, to turn T088 green.
- [ ] T099 [P] [US2] Implement `ArticleRow.tsx`, `QuantityFields.tsx` and `NameField.tsx` in `apps/mobile/src/adapters/ui/components/` to turn T089 green.
- [ ] T100 [P] [US2] Implement `UndoSnackbar.tsx` in `apps/mobile/src/adapters/ui/components/` (no timeout while a screen reader is on, per [contracts/ui-screens.md](contracts/ui-screens.md#undo-offer); the deadline is taken from the removal time and checked again on each `AppState` change to `active` and on each screen reader on/off change (`AccessibilityInfo` `screenReaderChanged`)) and render it once at the root in `apps/mobile/src/adapters/ui/navigation.tsx`, to turn T090 green.
- [ ] T101 [US2] Implement `QuantityDialog.tsx` in `apps/mobile/src/adapters/ui/screens/`, with modes add / already-on-list / edit, parsing through the domain's `parseQuantity`, with the focus moves of FR-037, to turn T091 green.
- [ ] T102 [US2] Implement `AddArticlesScreen.tsx` in `apps/mobile/src/adapters/ui/screens/` and replace its placeholder in `navigation.tsx`, to turn T092 green.
- [ ] T103 [US2] Implement `CreateArticleScreen.tsx` in `apps/mobile/src/adapters/ui/screens/`, validating the name through the domain's `validateName` before submitting, taking an optional `categoryId` route parameter to preselect (FR-018). The category picker lists categories only; "Nouvelle catégorie" comes with US4. Replace the placeholder in `navigation.tsx`. It turns T093 green.
- [ ] T104 [US2] Fill the trailing actions and accessibility actions of `ListItemRow` ("Modifier la quantité", "Retirer de la liste") and wire them in `CurrentListScreen.tsx`, moving focus after a removal (FR-037), to turn T094 green.
- [ ] T105 [US2] Add the US2 ids of [contracts/ui-validation.md](contracts/ui-validation.md#required-stories) to `required-stories.ts`: `Components/ArticleRow/Default`, `.../AlreadyOnList`, `Components/QuantityFields/Empty`, `.../Filled`, `.../WithError`, `Components/NameField/Empty`, `.../WithError`, `Components/UndoSnackbar/RemovedItem`, `Screens/AddArticles/Loading`, `.../Error`, `.../NoQuery`, `.../SearchMatches`, `.../SearchNoMatch`, `Screens/CreateArticle/Empty`, `.../NameAlreadyUsed`, `Dialogs/QuantityDialog/Add`, `.../Edit`, `.../AlreadyOnList` and `.../InvalidAmount`. Confirm the story test fails on each.
- [ ] T106 [US2] Write the stories to turn T105 green: `ArticleRow.stories.tsx`, `QuantityFields.stories.tsx`, `NameField.stories.tsx` and `UndoSnackbar.stories.tsx` (a `prepare` that removes an item) in `apps/mobile/src/adapters/ui/components/`; `AddArticlesScreen.stories.tsx` (pending and failing `getCatalog`, an empty category, a `prepare` searching "pom" with "Pommes" already on the list, a search for "xyz"), `CreateArticleScreen.stories.tsx` (the `NameAlreadyUsed` story renders the form with the error "« Lait » existe déjà.", T058) and `QuantityDialog.stories.tsx` in `apps/mobile/src/adapters/ui/screens/`. Review them in Storybook on both platforms, light and dark.
- [ ] T107 [US2] Make the T084 journeys green with `yarn test:e2e:android` and `yarn test:e2e:ios`. Any production fix starts with its own failing unit or screen test.

**Checkpoint**: US1 and US2 together form the MVP: a usable single-list app, offline, with
undo; every story so far is in Storybook and every journey so far is green on Android and iOS.

---

## Phase 5: User Story 3 - Manage several named lists and choose the current one (Priority: P2)

**Goal**: create named lists, see them with item counts and the current mark, and switch the
current list in 2 taps; the choice survives restarts.

**Independent Test**: create "Barbecue", make it current, add items and tick one, switch back and
check the first list is untouched, then reopen the app and check "Barbecue" is shown if it was
current.

### Tests for User Story 3 ⚠️ (write first, confirm they fail)

- [ ] T108 [US3] Write the failing journeys:
  - `tests/e2e/journeys/several-lists.e2e.ts`: with "Lait" ticked on "Ma liste", create "Barbecue", make it current from "Mes listes", add "Lait" (unticked there), switch back: "Ma liste" is untouched and "Lait" is still ticked on it (US3-2, US3-3, US3-4, US3-8, US2-5);
  - extend `tests/e2e/journeys/persistence.e2e.ts`: make "Barbecue" current, terminate and relaunch: "Barbecue" is still the current list.

  Confirm they fail.
- [ ] T109 [P] [US3] Write failing use case tests on fakes in `apps/mobile/src/application/use-cases/`:
  - `get-lists.test.ts`: lists sorted by name with `compareNames` ("Liste 2" before "Liste 10"), each with `itemCount` counting ticked and unticked items alike and `isCurrent` (US3-8);
  - `create-list.test.ts`:
    - US3-2, FR-024: an empty list is created and is not made current;
    - US3-5: "barbecue" → `NameAlreadyUsed`;
    - US3-6: `NameRequired`;
    - `NameTooLong`;
  - `set-current-list.test.ts`: US3-3 and FR-025, persisted across a new store instance on the same fakes; `ListNotFound`;
  - FR-026 / US3-4: ticking "Lait" on one list leaves it unticked on another.
- [ ] T110 [P] [US3] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.lists.test.ts`:
  - `loadLists()` uses the region states and reports `{ operation: 'getLists', screen: 'Lists' }` on failure (US3-7);
  - `createList` returns its `Result` and refreshes;
  - `setCurrentList` refreshes, so `currentList` shows the new list.
- [ ] T111 [US3] Write failing screen tests in `apps/mobile/src/adapters/ui/screens/lists-screen.test.tsx`:
  - Appbar "Mes listes";
  - US3-7: loading; the error "Impossible de charger vos listes." with "Réessayer", reported;
  - US3-8: rows show the name, "{n} articles" / "1 article", and "Liste actuelle" with a check icon and text;
  - row accessibility: "Barbecue, 0 articles, liste actuelle";
  - US3-3, FR-002: tapping a list makes it current and returns to CurrentList, which shows "Barbecue";
  - FR-025: tapping the current list returns to CurrentList without calling `setCurrentList`, and a pending undo offer stays;
  - SC-005: two taps from CurrentList ("Mes listes", then the list).
- [ ] T112 [US3] Write failing dialog tests in `apps/mobile/src/adapters/ui/screens/create-list-dialog.test.tsx`:
  - title "Nouvelle liste", buttons "Annuler" / "Créer";
  - US3-2, FR-024: the list appears empty in Lists, in its alphabetical place, the dialog closes on Lists and "Ma liste" stays current;
  - US3-5: "Une liste porte déjà ce nom.";
  - US3-6: "Indiquez un nom.";
  - FR-037: opening moves focus to the dialog title, and closing gives it back to the FAB "Nouvelle liste".

### Implementation for User Story 3

- [ ] T113 [US3] Implement `get-lists.ts`, `create-list.ts` and `set-current-list.ts` in `apps/mobile/src/application/use-cases/` to turn T109 green, per [contracts/driving-ports.md](contracts/driving-ports.md#named-lists-user-story-3). Add them to `UseCases` and to the composition root.
- [ ] T114 [US3] Add the `lists` region and the `loadLists`, `createList` and `setCurrentList` actions to `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T110 green.
- [ ] T115 [US3] Implement `ListsScreen.tsx` (with the FAB "Nouvelle liste") in `apps/mobile/src/adapters/ui/screens/` and replace its placeholder in `navigation.tsx`, to turn T111 green.
- [ ] T116 [US3] Implement `CreateListDialog.tsx` in `apps/mobile/src/adapters/ui/screens/`, with the focus moves of FR-037, to turn T112 green.
- [ ] T117 [US3] Add `Screens/Lists/Loading`, `.../Error`, `.../Success`, `Dialogs/CreateListDialog/Default` and `.../NameAlreadyUsed` to `required-stories.ts` and see the story test fail. Then write `apps/mobile/src/adapters/ui/screens/ListsScreen.stories.tsx` (pending and failing `getLists`, two lists with the current one marked) and `CreateListDialog.stories.tsx` (the error story renders the form with "Une liste porte déjà ce nom.") to turn it green. Review them in Storybook.
- [ ] T118 [US3] Make the T108 journeys green with `yarn test:e2e:android` and `yarn test:e2e:ios`.

**Checkpoint**: several lists, each with its own items and ticks; the current list survives a
restart.

---

## Phase 6: User Story 4 - Organize articles in categories (Priority: P3)

**Goal**: the default categories exist from the first launch; users create their own categories
from the article form and pick them.

**Independent Test**: on a fresh install, check the default categories exist. Create a category,
create an article in it, add it to the current list, and check it appears under the new heading.

### Tests for User Story 4 ⚠️ (write first, confirm they fail)

- [ ] T119 [P] [US4] Write failing use case tests in `apps/mobile/src/application/use-cases/create-category.test.ts`:
  - US4-2, FR-019: the category is appended with `position = max + 1` and `getCategories` lists it last;
  - US4-3: "boissons" → `NameAlreadyUsed`;
  - US4-4: `NameRequired`;
  - `NameTooLong`.
- [ ] T120 [P] [US4] Write failing store tests in `apps/mobile/src/adapters/ui/state/app-store.categories.test.ts`: `createCategory` returns its `Result` (with `categoryId`) and refreshes.
- [ ] T121 [US4] Write failing dialog tests in `apps/mobile/src/adapters/ui/screens/create-category-dialog.test.tsx`:
  - title "Nouvelle catégorie", buttons "Annuler" / "Créer";
  - US4-3: "Cette catégorie existe déjà.";
  - US4-4: "Indiquez un nom.";
  - FR-037: opening moves focus to the dialog title, and closing gives it back to "Nouvelle catégorie".
- [ ] T122 [US4] Extend `apps/mobile/src/adapters/ui/screens/create-article-screen.test.tsx` with failing tests:
  - US4-1: the 11 default categories are offered in the spec's order;
  - US4-2: "Nouvelle catégorie" opens CreateCategoryDialog, and on success "Bébé" is offered and preselected;
  - an article created in "Bébé" and added appears under a "Bébé" heading on CurrentList.

### Implementation for User Story 4

- [ ] T123 [US4] Implement `create-category.ts` in `apps/mobile/src/application/use-cases/` to turn T119 green, and add it to `UseCases` and to the composition root.
- [ ] T124 [US4] Add the `createCategory` action to `apps/mobile/src/adapters/ui/state/app-store.ts` to turn T120 green.
- [ ] T125 [US4] Implement `CreateCategoryDialog.tsx` in `apps/mobile/src/adapters/ui/screens/`, with the focus moves of FR-037, to turn T121 green.
- [ ] T126 [US4] Add the "Nouvelle catégorie" entry to the category picker of `CreateArticleScreen.tsx` and preselect the new category, to turn T122 green.
- [ ] T127 [US4] Add `Dialogs/CreateCategoryDialog/Default` and `.../NameAlreadyUsed` to `required-stories.ts` and see the story test fail. Then write `apps/mobile/src/adapters/ui/screens/CreateCategoryDialog.stories.tsx` (the error story renders the form with "Cette catégorie existe déjà.") to turn it green. Review it in Storybook. Run every journey again: `first-launch.e2e.ts` covers US4-1.

**Checkpoint**: all four stories work independently and together.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: the full offline scenario, development hooks, documentation and the device
validation of [quickstart.md](quickstart.md).

- [ ] T128 Write the full offline UI scenario in `apps/mobile/src/adapters/ui/offline.test.tsx`: with `global.fetch` replaced by a function that throws, do each of the 12 actions listed under the spec's Success Criteria, in its order: open, tick and untick, finish, add by browsing and by searching, create and add, set, change and clear a quantity, remove, undo, see the lists, create a list, choose the current list, and create a category. Every step succeeds and nothing is reported (Principle VII, FR-027, SC-006). Make it green with no production change; any change it forces gets its own failing test first.
- [ ] T129 [P] Write a test in `apps/mobile/src/adapters/ui/screens/current-list-screen.test.tsx` that renders a 200-item list through `renderWithStore`, ticks the last item, and checks that only that row re-renders (memoized rows identified by article id, [research.md](research.md) R11, SC-008). If it fails, fix the memoization in `ListItemRow.tsx` and `CurrentListScreen.tsx`.
- [ ] T130 [P] Extend `apps/mobile/src/adapters/ui/components/list-item-row.test.tsx` to render a ticked row under the light and dark themes of T041/T042: the check mark and the struck-through text are present in every theme, not only a color change (FR-035).
- [ ] T131 [P] Write a test in `apps/mobile/src/adapters/ui/state/error-context.test.ts` that every `report` call made during the US1–US4 store tests carries only the `operation` and `screen` fields, never names or quantities, and that the Sentry adapter's `beforeSend` output for a thrown `Error('Lait')`, on an event carrying `user.id` "install-1" and the device name "iPhone de Marie", contains none of "Lait", "install-1" and "Marie" anywhere in the serialized event (FR-030, Principle VIII).
- [ ] T132 [P] Write accessibility tests in `apps/mobile/src/adapters/ui/screens/accessibility.test.tsx`: every interactive element on the four screens and four dialogs has a French `accessibilityLabel` or a visible French text (FR-032, FR-031), and every touch target is ≥ 48 dp (FR-034). The focus moves (FR-037) and announcements (FR-038) are driven by the tests of the components that make them: T052, T071, T072, T089, T090, T091, T094, T112 and T121.
- [ ] T133 Add the build-time Sentry smoke test to `apps/mobile/src/composition/composition-root.ts`: when `EXPO_PUBLIC_SENTRY_SMOKE_TEST=1`, report one test error at startup with `{ operation: 'smokeTest', screen: 'CurrentList' }`; when it is `native`, call the reporter's `crashNatively()` 10 seconds after startup, which the Sentry adapter implements with `Sentry.nativeCrash()`, the console reporter with a log line and `RecordingErrorReporter` by recording the call (quickstart §6 step 5). Test-first in `apps/mobile/src/composition/composition-root.test.ts`, with Jest fake timers and a `RecordingErrorReporter`: `1` gives one report, `native` one `crashNatively` call after 10 seconds and none before, and any other value or none is ignored.
- [ ] T134 [P] Configure the Sentry Expo plugin options (organization, project, source map and native debug file upload through EAS Build) in `apps/mobile/app.config.ts`. Create `apps/mobile/eas.json` ([research.md](research.md) R13): `cli.appVersionSource: "remote"`; a `production` profile (store builds) and a `preview` profile (`distribution: "internal"`), each with `autoIncrement: true` and `env.EXPO_PUBLIC_APP_ENVIRONMENT` set to `production` and `preview`; a `development` profile with neither. `createErrorReporter()` reads `EXPO_PUBLIC_APP_ENVIRONMENT` (T061). Document in `README.md` the EAS environment variables the maintainer sets, never committed: the DSN, defined for the EAS `production` and `preview` environments only, and the Sentry access EAS uses to upload source maps. The README also lists the Sentry alert setup of FR-030c ([research.md](research.md) R13): two issue alert rules on the `production` environment, each emailing the maintainer ("a new issue is created", "an issue changes state from resolved to unresolved"), the default alert rule deleted, and the maintainer's personal workflow notifications turned off; quickstart §6 step 7 checks it once. The README also says what to declare if the app is published on a store: crash data and a random installation identifier, neither linked to the user nor used for tracking (Google Play "Crash logs" and "Device or other IDs", App Store "Crash Data" and "Device ID"), as the spec's Assumptions and R13 state. Also, per [research.md](research.md) R24: set `version: '1.0.0'` in `apps/mobile/app.config.ts` (semantic versioning, changed by hand in the pull request that leads to a release: MINOR for a new feature, PATCH for fixes only); set `"node"` to the Node 24 version the flake provides on every build profile of `eas.json`; add `submit.production` with the Android track `internal` and the iOS App Store Connect app, the Google Play service account and App Store Connect API access file being stored in EAS by the maintainer, never committed and never read by CI.
- [ ] T135 Add the measurement seed to `apps/mobile/src/composition/measurement-seed.ts`: when `EXPO_PUBLIC_SEED_ITEMS=<n>` is set at build time, fill an empty store to the spec's data size, shaped like real use, through the use cases ([research.md](research.md) R11, spec Assumptions):
  - 1 000 articles: a base list, in the same file, of 100 common French products spread over the 11 default categories (including "Pommes", "Lait demi-écrémé" and "Farine de blé", which quickstart step 15 searches), each made into 10 numbered variants ("Pommes", "Pommes 2" … "Pommes 10"); one variant of each product (100 names in all) is lengthened to exactly 60 characters, the limit of FR-022, by appending descriptive words, never by cutting;
  - 20 lists: "Ma liste", current, and 19 more ("Liste 2" … "Liste 20");
  - n items on the current list: item i (from 0) is ticked when i is odd and has the quantity "2 kg" when `floor(i / 2)` is odd, so ticked rows, quantities and both together all appear;
  - 50 items on each of the 19 other lists, unticked, without quantity.

  Seeding runs about 2 300 transactions on the first launch of the measurement build and takes several seconds; that launch is not timed (SC-001 applies to launches with existing data). It works in release builds too, so SC-001, SC-002, SC-008 and SC-011 can be measured on a `preview` build made with `EXPO_PUBLIC_SEED_ITEMS=200 eas build --profile preview` (like the Sentry smoke test, T133, [research.md](research.md) R11); builds for users never set it. Test-first in `apps/mobile/src/composition/measurement-seed.test.ts`: with `n = 200` the store holds 1 000 articles with unique names, 100 of them exactly 60 characters long and none longer; 20 lists; 200 items on the current list, 100 of them ticked, 100 with a quantity and 50 both; 50 items on each other list; searching "pom" with `filterCatalog` finds at least 10 articles; ignored when the variable is unset or the store already holds an article.
- [ ] T136 Update `README.md` with what the app does, the architecture in one paragraph (hexagonal layers, Zustand store in the UI adapter), how to review screens in Storybook and when to run the iOS journeys (before a release and on pull requests that change native configuration), how to run the device checks of [quickstart.md](quickstart.md), and the build-time flags `EXPO_PUBLIC_SEED_ITEMS` and `EXPO_PUBLIC_SENTRY_SMOKE_TEST`, which builds for users never set. It says that the performance targets (SC-001, SC-002, SC-008, SC-011) are measured on the two reference phones with the seeded `preview` build and the phone setup of [research.md](research.md) R11 (screen at 60 Hz), and that a target missed on either phone blocks the release. It also gives the release steps of [quickstart.md](quickstart.md) §8: a release is a `production` build, made from `main` after a pull request that sets the version and records every manual check and the iOS device suite; `eas build --profile production --platform all` then `eas submit --profile production --platform all` to Google Play's internal testing track and TestFlight; the first Android upload made once by hand in the Play Console; a faulty release fixed forward, never rolled back ([research.md](research.md) R24). Finally, a short privacy and security section ([research.md](research.md) R25): the Sentry organization lives in the EU region (and a US one is replaced); two-factor sign-in on the Expo, Sentry, Google Play Console, App Store Connect and GitHub accounts; Dependabot security alerts turned on in the repository settings, with no update bot; how to recover a lost Android upload identity (Google Play support) or iOS certificate (`eas credentials`); and that the app must not reach anyone else before a privacy notice and a lawful basis exist (spec Assumptions).
- [ ] T137 Run [quickstart.md](quickstart.md) sections 1–7 on an Android device or emulator and on an iOS simulator: every required story reviewed in Storybook in light and dark mode and at 200% text size (§2), every journey green with `yarn test:e2e:android` and `yarn test:e2e:ios` (§3), and the 15 hands-on scenarios (the power cut of step 13 on an Android emulator, the system backup check of step 14 on both platforms once), including airplane mode and TalkBack/VoiceOver over the spec's 12 actions, kill and restart, 200% text, and the seeded `preview` build for 200 items, start time and the add screen at full catalog size (§5 steps 11, 12 and 15), with steps 4, 11, 12 and 15 run on the two reference phones under the setup of [research.md](research.md) R11, each result recorded per phone; a missed SC-001, SC-002, SC-008 or SC-011 blocks the release until a fix meets it, and the pull request records the miss, its cause and the new measurement, and the error tracking steps of §6 on a `preview` build, each delivery timed against 1 minute (SC-010): a readable stack trace with the version and build number; no user, installation id or device name; one report per opening; reports raised in airplane mode arriving once the network returns with the app open, after a phone restart; a native test crash carrying only the installation id; nothing sent from a development run (FR-030, FR-030a). Step 7 (alert rules and a test notification, FR-030c) runs once, when error tracking is first set up; record its date in the pull request. If a delivery misses 1 minute on a platform, do not add a dependency: report it in the pull request, as [research.md](research.md) R13 says. Record the results, and anything not checked, in the pull request's test plan. This covers the manual checks of SC-004 (quickstart §2) and SC-009 (quickstart §10).
- [ ] T138 [P] Write the traceability test `apps/mobile/src/traceability.test.ts` (`@jest-environment node`), once T128 is green and every story is done: it reads `specs/001-shopping-lists/spec.md`, collects every FR id (`FR-001` … `FR-041`, lettered ids such as `FR-030a` and `FR-039a` included, so its pattern is `FR-\d{3}[a-z]?`) and every scenario id (`US1-1` … `US4-5`, skipping any marked "Removed"), then scans every `*.test.ts(x)` of the app (`apps/mobile/src/` and `apps/mobile/build-config/`, where FR-041 is cited), every `tests/e2e/journeys/*.e2e.ts` and `specs/001-shopping-lists/quickstart.md` for those ids, and fails, naming each one, for any id cited nowhere (spec Success Criteria, Principle II). Prove it red first with a throwaway id added to a copy of the spec read from a temporary folder, then point it at the real spec; any id it reports gets its test written first, or its citation added to an existing test name.
- [ ] T139 [P] Write the failing test `apps/mobile/build-config/release-guard.test.ts` (`@jest-environment node`) for `assertNoTestOptionsInProduction(env)` ([research.md](research.md) R24): with `EXPO_PUBLIC_APP_ENVIRONMENT: 'production'` and `EXPO_PUBLIC_SEED_ITEMS: '200'` it throws an error whose message names `EXPO_PUBLIC_SEED_ITEMS`; with `EXPO_PUBLIC_SENTRY_SMOKE_TEST` and `STORYBOOK_ENABLED` both set, the message names both; with `DETOX_BUILD: '1'`, it names `DETOX_BUILD`; with `EXPO_PUBLIC_SENTRY_DSN` at a host ending in `.ingest.sentry.io` (US region) it throws and names the DSN's region, while a host ending in `.de.sentry.io` returns, and so does no DSN at all ([research.md](research.md) R25); with `production` and none of the three set, or with an empty string for each, it returns; with `preview`, `development` or no environment, any of them set, it returns. Jest's default `roots` (the whole `apps/mobile/` folder, T006 sets none) already finds it: check that `yarn test` lists `release-guard.test.ts`, and do not add a `roots` setting that leaves out `src/`. Confirm it fails because the module does not exist.
- [ ] T140 Implement `assertNoTestOptionsInProduction(env: Record<string, string | undefined>)` in `apps/mobile/build-config/release-guard.ts`, with no import beyond the standard library, to turn T139 green. Before wiring it, check with `yarn expo config` in `apps/mobile/` that `app.config.ts` can import a local TypeScript file; if it cannot, write the guard as `release-guard.js` with JSDoc types instead (T139 imports it the same way). Then call it with `process.env` at the top of `apps/mobile/app.config.ts`, so a `production` build stops while reading its configuration and names the option to unset or the Sentry address to replace (spec Success Criteria, [research.md](research.md) R24, R25). Check by hand once that `EXPO_PUBLIC_APP_ENVIRONMENT=production EXPO_PUBLIC_SEED_ITEMS=200 yarn expo config` in `apps/mobile/` fails with that message, and record it in the pull request.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T004 must land before any commit that contains `flake.lock` or `yarn.lock`. Storybook (T009–T011) needs Jest and dependency-cruiser (T006, T008); the e2e chain T012 → T013 → T014 → T016 needs the app scaffold and the CI workflow (T015).
- **Foundational (Phase 2)**: depends on Setup. It blocks every user story. Inside it:
  - domain (T018–T024) → ports (T025) → contract suites and fakes (T026–T029) → SQLite (T030–T035) → seed (T036–T037);
  - theme and shared components (T041–T046) can run beside the SQLite work;
  - the store core (T047–T053) needs the fakes;
  - the composition (T054–T064) comes last, with the story store, decorator and component stories (T056–T059) after the navigation (T055), because the decorator wraps stories in a navigation container.
- **US1 (Phase 3)** and **US2 (Phase 4)**: both start after Foundational. US2's T094 and T104 extend the CurrentList screen built in US1, so finish T079 first.
- **US3 (Phase 5)**: after Foundational. SC-005's two-tap test (T111) needs the "Mes listes" action of T079.
- **US4 (Phase 6)**: after US2, because it extends `CreateArticleScreen` (T103).
- **Polish (Phase 7)**: after the stories it covers. T128 needs all four. T138 runs after T128, once every story's tests exist. T139 then T140 run after T134, which sets up `app.config.ts` and `eas.json` for releases.

### Within Each User Story

- The story's journey first (red), as the outer loop; it turns green at the end of the story.
- Tests first; run them and see them fail (Red) before the matching implementation task.
- Stories after the screens they show: required ids first (the story test goes red), then the story files.
- Then domain → use cases → store actions → components → screens.
- Each Green step is followed by a refactor with the suite green, and a commit.

### Parallel Opportunities

- Setup: T006, T007 and T008 touch different config files; the Storybook tasks (T009–T010) and the e2e scaffold (T012) touch different workspaces.
- Foundational:
  - T018 / T020 / T022 and their implementations, three domain files;
  - T038–T040 (error reporting, ids);
  - T041–T046 (theme, state components, `formatQuantity`);
  - T052–T053 (`NoticeSnackbar`), once the store core exists.
- US1: T066–T070 are five independent test files; T074, T075 and T078 in parallel after them.
- US2: T085–T090 are independent test files; T095, T096, T099 and T100 in parallel after them.
- US3 and US4 test files (T109, T110, T119, T120) can be written in parallel.
- Within a story, the journey file and the unit test files are independent and can be written together.

---

## Parallel Example: User Story 1

```bash
# Red: write these failing tests together (different files)
Task: "T066 current list view tests in apps/mobile/src/domain/current-list-view.test.ts"
Task: "T067 list item transition tests in apps/mobile/src/domain/list-item.test.ts"
Task: "T068 use case tests in apps/mobile/src/application/use-cases/{get-current-list,toggle-item-in-cart,finish-shopping}.test.ts"
Task: "T069 store tests in apps/mobile/src/adapters/ui/state/app-store.current-list.test.ts"
Task: "T070 ListItemRow tests in apps/mobile/src/adapters/ui/components/list-item-row.test.tsx"

# Green: then these in parallel
Task: "T074 buildCurrentListView in apps/mobile/src/domain/current-list-view.ts"
Task: "T075 toggle and finish in apps/mobile/src/domain/list-item.ts"
Task: "T078 ListItemRow in apps/mobile/src/adapters/ui/components/ListItemRow.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T085 catalog view tests in apps/mobile/src/domain/catalog-view.test.ts"
Task: "T087 use case tests in apps/mobile/src/application/use-cases/*.test.ts"
Task: "T089 ArticleRow / QuantityFields / NameField tests"
Task: "T090 UndoSnackbar tests in apps/mobile/src/adapters/ui/components/undo-snackbar.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Phase 1: Setup, merged with CI green before any application code.
2. Phase 2: Foundational. The app launches on a seeded, empty "Ma liste".
3. Phase 3: US1. Ticking works on seeded data.
4. Phase 4: US2. The list can be filled, so the app is usable on a device.
5. **Stop and validate**: the US1 and US2 journeys green on Android and iOS, the stories reviewed
   in Storybook, then quickstart §5 steps 4 and 10 by hand on a device.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 → MVP (single list).
3. US3 → several lists.
4. US4 → custom categories.
5. Polish → full offline scenario, dev hooks, README, device validation.

Each increment is one or more pull requests, merged only when `gh pr checks` is all green
(constitution v2.2.0, Quality Gates); application pull requests always run `e2e-android`.

### Handover to 002

002 ([plan](../002-manage-articles/plan.md#implementation-notes-for-speckit-tasks)) builds on this
store and adds `editArticle`, `deleteArticle`, the `deletedArticle` undo and the `CategoryPicker`
extracted from `CreateArticleScreen`.

---

## Notes

- [P] tasks touch different files and depend on no unfinished task.
- The [Story] label maps each task to its user story for traceability.
- Never delete, skip or weaken a test to make a change pass (Principle I).
- A flaky test is a failing test: fix it before anything else (Principle III). This holds for the
  journeys: no retries, no sleeps.
- Commit after each Green + Refactor step, with Conventional Commits.
- Test gates (constitution v2.2.0, Quality Gates): before each commit, `yarn test` (the fast
  suite) is green; before each push, `yarn test:e2e:android` (the device suite) is green, unless
  the branch changes only documentation (`specs/`, `.specify/`, Markdown files, as
  `.github/scripts/app-changed.sh` decides); the
  iOS journeys (`yarn test:e2e:ios`) run before each release and before merging a pull request
  that changes native configuration (`apps/mobile/app.config.ts`, a config plugin or a native
  dependency), and that pull request's test plan records the run.
