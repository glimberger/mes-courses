# ADR-0011: A deployment stops the server, copies the database and validates before opening

- **Status**: Accepted
- **Date**: 2026-10-15
- **Decided by**: maintainer (clarification 2026-10-14), proposed by the agent (mechanism)
- **Supersedes**: none
- **Related**: [005 research](../../specs/005-continuous-delivery/research.md) R9;
  [ADR-0005](0005-accounts-and-authentication.md), [ADR-0010](0010-two-instances-on-one-pi.md)

## Context

Migrations run at server start and can be destructive, and the data is one SQLite file. A failed
deployment must be undone without losing what users wrote. Phones treat an unreachable server as
a normal state, so a short outage is acceptable. Writes accepted by a version that is then
rolled back are not.

## Decision

We deploy with the service stopped. The agent copies the database (and `-wal` and `-shm`) to a
timestamped backup, keeps the 5 latest, and starts the new version on a **validation port** that
Caddy does not proxy. Only after a healthy answer there does it restart the service on the public
port and check health once more, within 60 seconds. On failure it stops, restores the copy,
switches `current` back and starts the previous version on the public port. If that also fails,
the outcome is `degraded`: the previous version keeps running under `Restart=always` and a
critical error is reported. Before anything is stopped, a disk-space check can fail the
deployment cleanly.

## Consequences

- No write from a phone can reach a version that is rolled back.
- Downtime is about 10 to 20 seconds per deployment, within the 30-second target.
- The agent needs an in-flight record, so a reboot mid-deployment is rolled back on the next pass.
- Fix-forward remains the rule for the app. The database rollback covers the server only.

## Alternatives considered

- **`sqlite3 .backup` on a live database**: saves a few seconds, needs the `sqlite3` CLI, and
  the stop is still required for the code switch.
- **Blue-green in Caddy**: two writers on one SQLite file.
- **Open to phones at once, restore on failure**: the first design. It loses the writes accepted
  during the 60-second window.
- **Switching Caddy's upstream through its admin API**: saves one start for a second moving part.
