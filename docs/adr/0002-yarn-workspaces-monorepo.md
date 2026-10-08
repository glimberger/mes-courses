# ADR-0002: Yarn workspaces monorepo

- **Status**: Accepted
- **Date**: 2026-10-06
- **Decided by**: maintainer
- **Supersedes**: none
- **Related**: [research R20](../../specs/001-shopping-lists/research.md#r20-monorepo-layout-principle-xi),
  constitution Principle XI, [ADR-0001](0001-react-native-expo.md)

## Context

The mobile app (001, 002) and the Raspberry Pi server with the shared sync rules (003) belong to
one product and change together. The constitution requires a single repository (Principle XI).
Moving the app into a workspace after the code exists would touch every path in 001 and 002.

## Decision

We use one Git repository organized as Yarn 4 workspaces, set up before any code exists:

- the app is the workspace `@mes-courses/mobile` in `apps/mobile/`; the server will be
  `apps/server/`, shared code `packages/<name>/`, and test-only workspaces live in `tests/`;
- Yarn is pinned by `packageManager` and run through the Corepack shims of the Nix dev shell, so
  every machine and CI use the same version;
- `nodeLinker: node-modules`, because React Native and Expo do not support Plug'n'Play;
- one `yarn.lock` and one `yarn install` at the root; workspaces depend on each other with
  `workspace:*` and only through public entry points, which the architecture test enforces.

## Consequences

- Shared tooling (TypeScript base, ESLint, Prettier, dependency-cruiser, CI) lives once at the
  root, and each workspace extends it.
- The app's Jest, TypeScript and Metro configs do not pick up the server's files.
- A shared package is created only when two workspaces need it (Principle IV); none exists yet.
- Workspaces cannot reach into each other's internals without failing the architecture test.

## Alternatives considered

- **App at the root, also the workspaces root**: simpler today, but the root configs then cover
  nested workspaces and need exclusions.
- **npm workspaces**: no extra tool, but the maintainer chose Yarn, which also brings
  `workspaces foreach` and `workspaces focus` for the Pi deployment in 003.
- **pnpm**: its symlinked layout needs extra Metro configuration for React Native.
- **Yarn Plug'n'Play**: not supported by React Native.
- **Turborepo or Nx on top**: build caching and task graphs a two-app repository does not need
  (Principle IV).
