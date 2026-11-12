# Delivery

The delivery tooling: the agent that runs on the Pi and deploys the channels (see
[the delivery agent](../../docs/delivery-agent.md)), and the maintainer commands run from the
repository.

## Commands

- `pnpm release [major|minor|patch|X.Y.Z|promote] [--yes] [--dry-run]`: deliver to staging, or
  promote to production ([Releases](../../docs/procedures/releases.md)).
- `pnpm agent:update [--version X.Y.Z] [--dry-run] [--host <ssh destination>]`: install a release
  of the agent on the Pi over `ssh agent-pi`: download with the Pi's read-only token, unpack, build
  the Node runtime, then repoint `current`, and print `main.js status`. Safe to re-run; a failure
  leaves `current` untouched ([Updating the agent](../../docs/procedures/updating-the-agent.md)).
  Verify on the Pi afterwards.

## Test

`pnpm --filter @mes-courses/delivery test` (Jest, no Pi needed; the Pi-side script
`src/adapters/ssh-host/agent-host.sh` is tested against a temporary root with a fake `curl` and
`nix`) and `pnpm --filter @mes-courses/delivery typecheck`.
