# Mes courses server

The sync server of Mes courses: a Fastify service backed by SQLite that keeps each account's
shopping data and lets every signed-in phone converge on it (features
[003](../../specs/003-server-sync/spec.md) and [004](../../specs/004-multi-user/spec.md)).

It follows the same hexagonal layout as the app: `domain/`, `application/`, `adapters/`, and a
`composition/` module that wires them. The shared sync rules live in `packages/sync-core`.

## Run it

From the repository root:

```sh
pnpm --filter @mes-courses/server dev                 # watch mode, database in apps/server/.data
pnpm --filter @mes-courses/server create-admin:dev    # create the first account
```

## Test it

```sh
pnpm --filter @mes-courses/server test
pnpm --filter @mes-courses/server typecheck
```

## Build and deliver it

`pnpm --filter @mes-courses/server build` compiles to `dist/`. In production the server is packed
by `.github/scripts/pack-server.sh` (once, on staging: production promotes the same archive,
[ADR-0015](../../docs/adr/0015-production-reuses-the-staging-server-artifact.md)) and delivered to
the Raspberry Pi by the delivery agent; see [the agent](../../docs/delivery-agent.md). The agent
writes `build-info.json` next to `package.json`; the archive does not carry it. `GET /v1/health` reports the delivered release.
