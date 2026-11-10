# Data Model: Fixed Sync Server URL

No schema change.

| Entity | Change |
| --- | --- |
| Fixed server URL | New build-time value: `EXPO_PUBLIC_DEFAULT_SERVER_URL`, normalized once at start-up (`https://host[:port]`, `http://` only in dev builds with `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1`). Immutable at runtime, never shown. Exists only in memory in `composition/` and as a use-case dependency. |
| `sync_state` (SQLite) | `server_url` kept, **never read, no longer written** by a new sign-in; existing values stay. `server_id`, `device_id`, `account_id`, `last_seq` unchanged. `device_id !== null` marks a paired device. |
| `SyncInfo` / store `sync` slice | Loses `serverUrl`. Keeps `lastSyncAt`, `pendingCount`, `connection`. |

State: `connection` is `notConnected` (no device id), `signedOut` (device id, no credential), `connected` (both). Transitions unchanged.
