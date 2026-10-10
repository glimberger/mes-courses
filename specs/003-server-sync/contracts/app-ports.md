# Contract: App Ports and Use Cases

Additions and changes to the app's driving and driven ports
([001 driving ports](../../001-shopping-lists/contracts/driving-ports.md),
[001 driven ports](../../001-shopping-lists/contracts/driven-ports.md),
[002 driving ports](../../002-manage-articles/contracts/driving-ports.md)). The conventions are
those of 001: `Result` for expected failures, throws for unexpected ones, and every write in
`UnitOfWork.run`. Types are in [../data-model.md](../data-model.md).

## New driven ports (`apps/mobile/src/application/ports/`)

```ts
interface ChangeRecorder {                     // part of Repositories, so it shares the transaction
  record(kind: EntityKind, id: string, fields: object, options?: { heldBy?: string; seed?: boolean }): Promise<void>;
  // stamps the change with clock.nextHlc() and appends it to pending_change; with `seed`, with the
  // minimum HLC of a device id that sorts before any server-issued one (R13), and the clock is left alone
  pending(limit: number): Promise<PendingChange[]>;      // held entries excluded, in seq order
  acknowledge(changeIds: string[]): Promise<void>;
  release(heldBy: string): Promise<void>;                // held → pending
  releaseAll(): Promise<void>;                           // at startup (killed app)
  discard(heldBy: string): Promise<void>;                // undo: the server never sees them
  count(): Promise<number>;                              // pendingCount, held excluded
}

interface SyncStateRepository {                // part of Repositories
  get(): Promise<SyncState>;
  save(state: SyncState): Promise<void>;
}

interface PulledRowsApplier {                  // part of Repositories; applies ServerRow[] to local tables
  apply(rows: ServerRow[], pendingFields: Set<string>): Promise<{ deferred: number; effects: RemoteEffects }>;
  // also moves app_state.current_list_id to the survivor when the current list is merged (research R8a)
}

interface Clock {                              // replaces wall-clock reads; fake in tests (Principle III)
  nowMs(): number;
}

interface SyncServer {                         // HTTP adapter; never the production server in tests
  health(url: string): Promise<Result<HealthInfo, ServerUnreachable>>;
  claim(url: string, code: string, deviceName: string): Promise<Result<Pairing, InvalidCode | TooManyAttempts | ServerUnreachable>>;
  sync(conn: Connection, request: SyncRequest): Promise<Result<SyncResponse, SyncFailure>>;
  createPairingCode(conn: Connection): Promise<Result<{ code; expiresAt }, SyncFailure>>;
  listDevices(conn: Connection): Promise<Result<DeviceSummary[], SyncFailure>>;
  renameDevice(conn: Connection, id: string, name: string): Promise<Result<void, SyncFailure | NotFound>>;
  revokeDevice(conn: Connection, id: string): Promise<Result<void, SyncFailure | NotFound>>;
}
// SyncFailure = Offline | DeviceNotAuthorized | UpdateRequired | ServerError | UntrustedServer
// Offline covers no network, DNS failure, timeout and connection refused (never reported).
// UntrustedServer = TLS verification failed (FR-019): never retried insecurely.

interface CredentialStore {                    // expo-secure-store adapter; in-memory fake in tests
  // iOS: accessibility option WHEN_UNLOCKED_THIS_DEVICE_ONLY; Android: excluded from Auto Backup
  // (research R12a). A value that cannot be decrypted after a restore reads as null.
  read(): Promise<string | null>;
  write(credential: string): Promise<void>;
  clear(): Promise<void>;
}
```

`Connection = { url, deviceId, credential }`. It is built by the use cases from
`SyncStateRepository` and `CredentialStore`, and never stored in SQLite.

## New use cases (`apps/mobile/src/application/use-cases/`)

| Use case | Signature | Behavior |
|---|---|---|
| `connectToServer` | `(url, code, deviceName) => Promise<Result<void, InvalidUrl \| ServerUnreachable \| UntrustedServer \| InvalidCode \| TooManyAttempts>>` | Normalizes the URL (`https://` only), calls `health` and then `claim`, stores the credential, and saves `serverUrl`, `serverId` and `deviceId` with `lastSeq = 0` and `snapshotDone = false`. The first sync is left to the scheduler (US4-4, US4-5, US4-6). |
| `synchronize` | `() => Promise<{ outcome: SyncOutcome; effects: RemoteEffects }>` | One cycle (research R9). Steps: the snapshot if `!snapshotDone` (R13); push `pending(500)` until empty; apply the pulled rows; acknowledge; save `lastSeq` and `maxHlc`. `outcome` is `saved \| waiting \| failed(reason) \| disconnectedByServer \| updateRequired \| notConnected`; `effects` lists what the pull deleted, removed or merged (research R10a), empty when nothing was pulled. A different `serverId`, a `401`, or `serverUrl` set with no stored credential (a restored phone, FR-018b) gives `disconnectedByServer` and keeps every local row and pending change (FR-018a). |
| `getSyncInfo` | `() => Promise<SyncInfo>` | Read model for the status bar and Settings. Reports `disconnectedByServer` when `serverUrl` is set and no credential is stored (FR-018b). |
| `createPairingCode` | `() => Promise<Result<{ code; expiresAt }, SyncFailure>>` | "Ajouter un appareil" (US4-3). |
| `listDevices` | `() => Promise<Result<DeviceSummary[], SyncFailure>>` | US4-8; marks `isThisDevice`. |
| `renameDevice` | `(id, name) => Promise<Result<void, NameError \| SyncFailure \| NotFound>>` | Uses 001's `validateName` (FR-019c). |
| `revokeDevice` | `(id) => Promise<Result<void, SyncFailure \| NotFound>>` | US4-9. Revoking this device goes through `disconnect`. |
| `disconnect` | `() => Promise<Result<void, never>>` | Revokes this device on the server when it can be reached (best effort), clears the credential and the connection fields, and keeps the local data and the outbox (US4-11). |
| `releaseHeldChanges` | `(undoId) => Promise<void>` | Called by the store when an undo offer ends (research R10). |

## Changes to existing use cases (001 and 002)

Every command records its changes with `changes.record` in its existing transaction:

| Use case | Recorded changes |
|---|---|
| `initializeStore` (001) | Seeded categories (`name`, `position`) and the first list (`name`), recorded with `seed: true` (minimum HLC). At every start it also calls `changes.releaseAll()`. |
| `toggleItemInCart` | `listItem.inCart` |
| `finishShopping` | `listItem.inCart = false` for each item ticked at that moment (FR-013) |
| `addArticleToList` | `listItem { listId, articleId, present: true, inCart: false, quantity }` |
| `createArticleAndAddToList` | `article { name, categoryId }`, then the `listItem` as above |
| `changeItemQuantity` | `listItem.quantity` |
| `removeItemFromList` | `listItem.present = false`, **held** by the removal's undo id |
| `restoreRemovedItem` | `changes.discard(undoId)`; no change is recorded |
| `createList` | `list.name` |
| `createCategory` | `category { name, position }` |
| `editArticle` (002) | `article.name` and/or `article.categoryId` (only the changed fields) |
| `deleteArticle` (002) | `article.deleted = true`, **held** by the deletion's undo id |
| `restoreDeletedArticle` (002) | `changes.discard(undoId)` |
| `setCurrentList` | nothing: the current list is per device (FR-015) |

`RemovedItem` and `DeletedArticle` gain an `undoId: string`, used as `heldBy`.
