# ADR-0001: React Native with Expo

- **Status**: Accepted
- **Date**: 2026-10-05
- **Decided by**: maintainer
- **Supersedes**: none
- **Related**: [research R1](../../specs/001-shopping-lists/research.md#r1-platform-and-framework),
  constitution Principles V and VII

## Context

Mes Courses is a phone application for Android and iOS, in French, that works offline. The
project has one maintainer, so the stack has to give two platforms from one codebase, a fast
development loop and managed native builds, and catch domain errors at compile time.

## Decision

We use React Native with Expo (managed workflow, New Architecture, Hermes) and TypeScript in
strict mode, targeting Android and iOS phones. Expo handles native builds (EAS Build), config
plugins (Sentry, SQLite) and the development loop. The SDK version is pinned in
`apps/mobile/package.json`; moving to a new SDK is a task of its own, with its upgrade notes in
[research R1](../../specs/001-shopping-lists/research.md#r1-platform-and-framework).

## Consequences

- One TypeScript codebase covers both platforms, and strict mode catches most domain type errors
  at compile time.
- Libraries must support React Native and the New Architecture. React Native Paper provides
  Material 3 (Principle V).
- The project follows Expo's SDK schedule and its pre-release lag. SDK 58 was adopted while still
  in pre-release because iOS 27 requires its UIScene lifecycle.
- Native code stays generated (`expo prebuild`) and out of Git.

## Alternatives considered

- **Flutter**: built-in Material 3, but Dart, a second language and ecosystem.
- **Kotlin with Jetpack Compose**: the best Material 3 support, but Android only.
- **Compose Multiplatform**: the iOS tooling is less mature.
