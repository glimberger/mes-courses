# Quickstart: Deliver a Release to Staging, Then Promote It to Production

Prerequisites: `nix develop`, an authenticated `gh`, a clean `main` matching `origin/main` (for the staging half only).

## Automated checks

```sh
yarn test
yarn typecheck
yarn lint
yarn test:architecture
```

## Dry runs (change nothing)

```sh
yarn release minor --dry-run      # ends with "would stop with X.Y.Z on staging, for `yarn release promote`"
yarn release promote --dry-run    # "X.Y.Z: staging -> production", or "vX.Y.Z is already released"
yarn release promote minor        # usage error, exit code 2
```

## Real release

1. `yarn release patch` ends with `X.Y.Z is on staging (<sha>)`, exit code 0, no tag.
2. Validate the build on staging (`X.Y.Z-staging.<n>`).
3. `yarn release promote` asks `Promote X.Y.Z (<sha>) to production?`, tags and prints the `Release` run link.

Contract and exit codes: [contracts/cli.md](contracts/cli.md). Procedure: `docs/procedures/releases.md`.
