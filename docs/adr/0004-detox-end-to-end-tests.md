# ADR-0004: End-to-end tests with Detox

- **Status**: Accepted
- **Date**: 2026-10-06
- **Decided by**: maintainer
- **Supersedes**: none
- **Related**: [research R23](../../specs/001-shopping-lists/research.md#r23-end-to-end-tests-with-detox),
  constitution Principles I, II, III and the Quality Gates, [ADR-0002](0002-yarn-workspaces-monorepo.md)

## Context

Jest covers behavior through in-memory fakes and `node:sqlite`, but nothing automated checked the
binary itself: that expo-sqlite opens and migrates on a device, that screens navigate, that data
survives a killed process.

## Decision

We use Detox, with the Jest runner, to drive the release build on an Android emulator and an iOS
simulator:

- the journeys live in a test-only workspace, `tests/e2e/`, which imports nothing from the other
  workspaces and only drives the built binary;
- Detox is added to a build only when `DETOX_BUILD=1`, so `production` and `preview` builds have
  no test runner and no test hooks;
- each journey starts from a fresh install, finds elements by their French text and accessibility
  labels, never waits by time and is never retried;
- a few journeys cover what Jest cannot reach on a device; every acceptance scenario is still
  covered by a Jest test;
- Android runs in CI (`e2e.yml`, on every push to `main` and on demand on a branch); iOS runs on
  the maintainer's Mac before each release and on pull requests that touch native configuration.

## Consequences

- The binary users get is the one the journeys test, and Detox's gray-box synchronization avoids
  the timing sleeps that make black-box UI tests flaky.
- A story's journey is written first and fails, as the outer loop of Test-First (Principle I).
- A run takes about thirty minutes, so it does not run on every push to a pull request.
- iOS has no CI coverage: macOS runners cost ten times the Linux rate on a private repository.
- Release builds stay unminified so the keep rules Detox reaches by reflection are not stripped.

## Alternatives considered

- **Maestro**: YAML flows, the option Expo documents with EAS Workflows; not chosen by the
  maintainer, and its black-box waits are less deterministic than Detox's synchronization.
- **Appium**: a WebDriver setup heavier than a two-platform app needs.
- **Detox on debug builds**: needs Metro during tests and differs from what users run.
- **The journeys inside `apps/mobile/`**: `yarn test` would pick them up.
- **iOS in CI on `macos-latest`**: cost; it can be added if the repository becomes public.
