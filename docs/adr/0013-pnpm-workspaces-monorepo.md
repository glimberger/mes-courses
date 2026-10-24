# ADR-0013: pnpm workspaces monorepo

- **Status**: Accepted
- **Date**: 2026-10-22
- **Decided by**: maintainer
- **Supersedes**: [ADR-0002](0002-yarn-workspaces-monorepo.md)
- **Related**: constitution Principle XI

## Context

ADR-0002 recorded the choice of Yarn 4 workspaces. The maintainer approved superseding it
to migrate the monorepo to pnpm, for its stricter dependency resolution and faster installs,
while keeping every existing workflow working.

## Decision

We use one Git repository organized as pnpm workspaces:

- workspaces declared in `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `tests/*`);
- pnpm pinned by `packageManager` and provided by the Nix dev shell;
- `node-linker=hoisted` in `.npmrc`, because React Native and Expo do not support pnpm's
  symlinked layout out of the box (Metro and Jest need a hoisted `node_modules`);
- one `pnpm-lock.yaml` and one `pnpm install` at the root; workspaces depend on each other with
  `workspace:*`;
- patches for detox and react-native-paper migrated to pnpm's `patchedDependencies`.

## Consequences

- Shared tooling (TypeScript base, ESLint, Prettier, dependency-cruiser, CI) lives once at the
  root, and each workspace extends it.
- All `yarn` invocations in scripts, hooks, CI and docs become `pnpm`.
- The Nix dev shell provides pnpm instead of Corepack/Yarn.

## Alternatives considered

- **Keep Yarn 4**: recorded in ADR-0002; superseded by this ADR.
- **pnpm symlinked layout**: needs extra Metro configuration for React Native; avoided by
  `node-linker=hoisted`.
