# ADR-0010: Staging and production run as two instances of one systemd template

- **Status**: Accepted
- **Date**: 2026-10-15
- **Decided by**: maintainer (two instances on one Pi), proposed by the agent (layout)
- **Supersedes**: none
- **Related**: [005 research](../../specs/005-continuous-delivery/research.md) R8;
  [ADR-0006](0006-pull-based-continuous-delivery.md),
  [ADR-0011](0011-stop-copy-validate-rollback.md)

## Context

Staging must exist beside production on the same Pi, without one being able to read or break the
other. Until now there was a single `mes-courses` unit, one environment file and one database.

## Decision

We run one systemd template unit, `deploy/mes-courses@.service`, with an instance per
environment: `mes-courses@production` and `mes-courses@staging`. Each instance has its own
system user (`mes-courses-%i`), environment file (`/etc/mes-courses/%i.env`), database
(`/var/lib/mes-courses/%i/`), code (`/opt/mes-courses/%i/current`, a symlink to a release
directory), loopback port (3000 production, 3002 staging) and public address, both through the
existing Caddy. Each release carries its own Node runtime. The agent keeps the current release
and the two before it.

## Consequences

- One unit file for both instances, so they cannot drift apart.
- Separate users mean neither instance can read the other's database.
- Production must be migrated once, by hand: move the database and environment file, create the
  users, install the agent and drop the old checkout and deploy key.
- Both instances share the Pi's resources and the mail relay. A staging fault can still starve
  production of CPU or memory.

## Alternatives considered

- **Two hand-copied unit files**: they would drift apart.
- **Containers**: a runtime on the Pi for one Node process that systemd already sandboxes.
- **`DynamicUser=`**: the database owner would change unpredictably across releases.
