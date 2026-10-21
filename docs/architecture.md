# Architecture

The app follows a hexagonal architecture (constitution Principle VI, enforced by
dependency-cruiser): the pure `domain/` holds the rules (names, quantities, list views); the
`application/` layer holds the use cases and the ports they need (repositories, unit of work, ids,
error reporting); `adapters/` implement those ports (SQLite through `expo-sqlite`, Sentry, UUIDs)
and drive them from the UI, a React Native Paper interface whose shared state is a Zustand store
that lives in the UI adapter only; `composition/` is the one module that knows every adapter and
wires them at startup. French text exists only in the UI adapter.

The server (`apps/server/`, Fastify over `node:sqlite`) has the same layers, and the merge rules
both sides apply live in `packages/sync-core/`, which depends on nothing. The server listens on
`127.0.0.1` only; Caddy is its public HTTPS entry.
