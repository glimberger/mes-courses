# Contract: Sync HTTP API (server)

The server's public interface, served by Fastify behind Caddy at `https://<domain>`
([../research.md](../research.md) R2, R4). Every request and response body is JSON, validated
by a schema on the server. The TypeScript types live in `packages/sync-core/src/protocol.ts`, so
the app's HTTP adapter and the server use the same definitions. The server returns error codes,
never display text: the app writes the French (Principle X).

## Common rules

- **Base path**: `/v1`. Every response carries:
  - `serverId`, the server's id (research R12);
  - `apiVersion`, `1` for this feature;
  - `minAppVersion`, a semver string.
- **App version**: every request sends the header `X-App-Version: <semver>`. If it is below
  `minAppVersion`, the answer is `426 { error: 'UpdateRequired' }` and nothing is read or
  changed.
- **Authorization**: every route except `GET /v1/health` and `POST /v1/pairing/claim` needs the
  header `Authorization: Bearer <device credential>`. An unknown credential or a revoked device
  gets `401 { error: 'DeviceNotAuthorized' }` before any read (FR-019a, SC-008).
- **Errors**: `{ error: <code> }`, with codes `BadRequest` (400), `DeviceNotAuthorized` (401),
  `NotFound` (404), `UpdateRequired` (426), `TooManyAttempts` (429 with `Retry-After`) and
  `ServerError` (500).
- **Size**: request bodies are limited to 1 MB.

## `GET /v1/health`

Not authenticated. It returns `{ serverId, apiVersion, minAppVersion }`. The app calls it to
check an address before pairing (US4-6).

## `POST /v1/pairing/claim`

Not authenticated. It claims a pairing code and authorizes the device (US4-4).

```text
Request:  { code: string /* "ABCD-EF23" or "ABCDEF23", case-insensitive */, deviceName: string /* 1–60 chars */ }
200:      { deviceId: string, credential: string /* 256-bit, base64url */, serverId, apiVersion, minAppVersion }
400:      { error: 'InvalidCode' }        // unknown, expired or already used (US4-5); counted as a failure
429:      { error: 'TooManyAttempts' }    // 5 failures in the last 10 minutes (FR-019b, US4-12); Retry-After: seconds
```

The code is checked and marked used, and the device created, in one transaction. The
credential is returned only in this response; the server keeps only its SHA-256 hash.

## `POST /v1/pairing-codes`

Authenticated. It creates a code for another device ("Ajouter un appareil", US4-3).

```text
200: { code: "ABCD-EF23", expiresAt: ISO-8601 /* now + 10 min */ }
```

## `POST /v1/sync`

Authenticated. It pushes the device's changes and pulls everything newer than `lastSeq`, in
one transaction on the server ([../research.md](../research.md) R9).

```text
Request:  {
  lastSeq: number,            // 0 on first sync with this server
  hlc: Hlc,                   // device's current HLC (lets the server advance its own)
  changes: Change[]           // ≤ 500, in outbox order; see ../data-model.md
}
200: {
  acknowledged: string[],     // changeIds applied now or already applied before (FR-006)
  rows: ServerRow[],          // every row with seq > lastSeq, tombstones included (research R7)
  seq: number,                // new lastSeq for the device
  hlc: Hlc,                   // server's highest HLC
  serverId, apiVersion, minAppVersion
}
400: { error: 'BadRequest' }  // schema violation; nothing applied
```

Rules:

- Changes are applied in request order. A change whose `changeId` is already in
  `applied_change` is acknowledged without being applied again.
- Every incoming HLC is clamped to `serverNow + 60 s` before use (research R6).
- A change that is valid but has no effect (it targets a deleted article, or loses to a newer
  HLC) is still acknowledged.
- A change that refers to an unknown entity (an item whose article was never created) is
  acknowledged and ignored; the outbox order makes this impossible for a correct client.
- The device's `last_sync_at` is set to now.
- `rows` is limited to 5,000 rows per response. When more remain, the response includes
  `more: true` and the device repeats the request with the returned `seq` and no changes.

## `GET /v1/devices`

Authenticated. It lists the authorized devices (US4-8).

```text
200: { devices: Array<{ id, name, createdAt, lastSyncAt: string | null }> }   // revoked devices excluded
```

## `PATCH /v1/devices/:id`

Authenticated. It renames a device (FR-019c).

```text
Request: { name: string /* trimmed, 1–60 chars */ }
200: { id, name }      404: { error: 'NotFound' }
```

## `DELETE /v1/devices/:id`

Authenticated. It revokes a device (US4-9). A device may revoke itself, which is how
"Déconnecter" works (US4-11).

```text
204      404: { error: 'NotFound' }
```

From the next request on, the revoked device gets `401` (SC-009).

## Command line on the Pi (not HTTP)

```sh
yarn workspace @mes-courses/server pairing-code   # prints "Code d'appairage : ABCD-EF23 (valable 10 minutes)"
```

It creates a code with `created_by = NULL`, directly in the database (research R11). This is
the only way to get the first code (US4-2). The message is French because the maintainer reads
it as a user of the system.

## Tests that pin this contract

- Server: Fastify `inject` tests for every route, status and error code above, including:
  - an expired, used and wrong code;
  - the sixth failed claim in 10 minutes;
  - a revoked device;
  - a replayed `changeId`;
  - an HLC in the future;
  - a pull with `more: true`.
- App: the `SyncServer` HTTP adapter runs against a real in-process server on a random local
  port with an in-memory database (Principle VII), never the production server.
