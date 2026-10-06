# Research: Server Synchronization

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

This feature adds a server to the project and a sync layer to the app built by
[001](../001-shopping-lists/research.md) and [002](../002-manage-articles/research.md). The
maintainer chose a Node.js server on the Raspberry Pi, which sits behind a Freebox. Each entry
gives the decision, why it was made, and what else was considered. It also settles the three
points the clarification deferred to the plan: clock skew (R6), how long deletion records are
kept (R7) and the first pairing code (R11).

## R1. Repository layout: Yarn workspaces

- **Decision**: the server and the shared rules join the Yarn workspaces monorepo set up by 001
  ([001 research R20](../001-shopping-lists/research.md#r20-monorepo-layout-principle-xi),
  constitution Principle XI):
  - the Expo app stays in `apps/mobile/` (`@mes-courses/mobile`, 001's layout);
  - `apps/server/` (`@mes-courses/server`) is the Node.js server;
  - `packages/sync-core/` (`@mes-courses/sync-core`) is a pure TypeScript package shared by
    both. It holds the sync protocol types, the hybrid logical clock (R6), the field merge rule
    (R5) and `normalizedName`;
  - local dependencies use the `workspace:*` protocol (001 R20);
  - `tests/sync/` (`@mes-courses/sync-tests`, private, test-only) holds the tests that need the
    app and the server together: the app's `SyncServer` adapter against a real in-process
    server, and the cross-stack scenarios. The root `"workspaces"` already holds `"tests/*"`, added by 001 for its
    `tests/e2e/` workspace ([001 research](../001-shopping-lists/research.md) R23).

  `sync-core` has no dependency and no side effect. The app's domain and application layers,
  and the server's, may import it; dependency-cruiser allows `@mes-courses/sync-core` there and
  nothing else (R16). The app and the server never import each other. Each exposes a
  `./testing` entry point in its `package.json` `exports` (the app: the `node:sqlite` wrapper, a
  `buildTestAppStack()` helper and its `SyncServer` adapter; the server: `startTestServer()`),
  and only `tests/*` may import those entries.
- **Rationale**: the app and the server must apply the same rules to the same data. One copy of
  those rules, tested once, avoids a drift that would break the "same data on every device"
  guarantee (SC-003). Workspaces keep one `yarn install --immutable`, one CI and one lockfile. A separate test
  workspace keeps Principle XI's "the app and the server must not depend on each other" true
  even for tests, while Principle VII still gets its adapter tests against a real server.
- **Alternatives considered**: a separate server repository (two copies of the rules, two CIs;
  ruled out by Principle XI); copying the shared files (drift); the app's adapter tests
  importing the server's test helper directly (a dev dependency from the app on the server,
  which Principle XI forbids); starting the server as a child process from the app's tests (no
  import, but the cross-stack scenarios need a shared or skewed fake clock in-process).

## R2. Server runtime and framework

- **Decision**: Node.js 24 LTS (arm64) with TypeScript in strict mode, compiled with `tsc`. HTTP
  is served by Fastify 5 with JSON schemas on every route.
- **Rationale**: the maintainer chose Node. The server shares TypeScript and `sync-core` with the
  app. Fastify validates requests against schemas before they reach the code, has
  `app.inject()` for fast in-process tests with no open port (Principle III), and is light enough
  for a Pi.
- **Alternatives considered**: `node:http` alone (hand-written routing and validation, more
  untested surface); Express 5 (no built-in validation, slower); Hono (fine, but Fastify's
  `inject` and schema tooling fit the test-first workflow better).

## R3. Server storage

- **Decision**: SQLite on the Pi through Node's built-in `node:sqlite` (`DatabaseSync`), in WAL
  mode with `synchronous = FULL`. The database lives in `/var/lib/mes-courses/` and is migrated
  by `PRAGMA user_version`, like the app's.
- **Rationale**: one user, a few devices and hundreds of rows. An embedded database has no
  extra service to run on the Pi. `node:sqlite` is the same engine 001 already tests with, and
  needs no native build on arm64. With WAL and `synchronous = FULL`, a committed sync survives
  a power cut (FR-005, FR-006).
- **Pi storage**: an SD card wears out with frequent writes. The quickstart recommends a USB SSD
  for `/var/lib/mes-courses/`. Losing the card is covered by FR-018a: the devices repopulate the
  server.
- **Fallback**: if `node:sqlite` is still flagged experimental on the Node version used, the
  server uses `better-sqlite3` behind the same `SqlDatabase` interface (as in 001 R4).
- **Alternatives considered**: PostgreSQL (a service to run and back up, for one user);
  plain JSON files (no transactions, so FR-006 would be hand-built).

## R4. Network: Freebox, domain name and TLS

- **Decision**:
  - **Reverse proxy**: Caddy 2 runs on the Pi and terminates TLS. It obtains and renews a
    Let's Encrypt certificate on its own (HTTP-01 challenge on port 80) and proxies
    `https://<domain>` to the Node server on `127.0.0.1:3000`. The Node server never listens
    on a public interface.
  - **Freebox**:
    - a static DHCP lease gives the Pi a fixed LAN address;
    - Freebox OS forwards TCP 80 and 443 to it ("Gestion des ports");
    - the Freebox's own remote access must not use ports 80 or 443.
  - **IPv4 address**: Free gives each line a fixed public IPv4 address. On lines where Free
    shares the IPv4 address between subscribers (only a port range is reachable, so 80 and 443
    are not), the maintainer requests a full-stack IPv4 address, free of charge, in the Free
    subscriber area.
  - **Domain**: an A record of the maintainer's domain (for example `courses.<domain>`) points
    to that fixed address. A dynamic DNS name works the same way if the address ever changes.
    The domain is configuration (`MES_COURSES_DOMAIN` for Caddy, the address typed in the
    app), not code.
  - **IPv6**: the Freebox provides IPv6, but its IPv6 firewall would need its own opening. IPv4
    only, with no AAAA record, keeps one path to test. It can be added later.
- **Rationale**: the spec requires a publicly trusted, automatically renewed certificate under
  the maintainer's domain (FR-019). Caddy does issuance, renewal, HTTP→HTTPS redirect and
  modern TLS settings with a three-line configuration, so the Node code has no TLS logic to get
  wrong. Phones verify the certificate like any website, so the app needs no pinning code.
- **Home Wi-Fi**: a device on the home Wi-Fi reaches the server through the public address
  (NAT loopback on the Freebox), so the app always uses one address. The quickstart checks it.
  If loopback ever fails, a local DNS override is the fix; the app keeps one address.
- **Alternatives considered**:
  - TLS in Node with an ACME library (more code, and renewal failures would be ours to handle);
  - Nginx with certbot (two tools and a renewal timer instead of one);
  - Cloudflare Tunnel (rejected in the spec's clarification);
  - the Freebox's own `freeboxos.fr` name (it belongs to the box's admin interface, and its
    certificate is managed by the box).

## R5. Sync model: server-authoritative, field-level last-writer-wins

- **Decision**:
  - **The server's state is authoritative.** Devices send changes; the server applies them,
    resolves conflicts and returns its canonical state. Devices then replace their local data
    with it. Determinism across devices (FR-010, SC-003) follows from there being a single
    place that decides.
  - **Changes are field-level.** A change is
    `{ changeId, hlc, entity, id, fields: { field: value } }`. Every field the spec reconciles
    is a last-writer-wins register on the server, holding `(value, hlc)`:
    - category: `name`, `position`;
    - article: `name`, `categoryId`;
    - list: `name`;
    - list item: `present`, `inCart`, `quantity`.

    A field is overwritten only by a change with a greater HLC (R6), compared as
    `(hlc, deviceId)`, so ties break the same way everywhere. Changes to different fields never
    conflict (FR-009).
  - **List items carry a `present` flag** instead of being deleted:
    - removing an item sets `present = false` (FR-011);
    - a concurrent tick or quantity change does not touch `present`, so the removal wins;
    - adding the article to the list again later sets `present = true` with a newer HLC.

    Only the server and the sync payloads see the flag. Locally, 001's `list_item` rows are
    deleted as before.
  - **Article deletion is final on the server**: a tombstone (`deletedHlc`) that no later
    change undoes, so the deletion wins over any concurrent edit (FR-011). Changes to a deleted
    article are acknowledged and ignored. Its name is free again (002 FR-007). A new article
    with that name gets a new id.
  - **"Terminer les courses"** is sent as `inCart = false` changes for the items ticked at that
    moment, stamped with the finish's HLC. A tick made later has a greater HLC and wins
    (FR-013).
- **Rationale**: per-field registers give exactly the spec's rules with one small, pure merge
  function in `sync-core`, testable without I/O. A server-authoritative design avoids
  replicating merge state on every device.
- **Alternatives considered**:
  - a CRDT library such as Automerge or Yjs (heavy, generic, and the name merge of FR-012 is not
    a CRDT operation);
  - operation transforms (needless for registers);
  - whole-row last-writer-wins (loses the concurrent edits that FR-009 keeps).

## R6. Ordering changes: hybrid logical clock with a server bound (deferred question 1)

- **Decision**: every change carries a hybrid logical clock (HLC) stamp
  `{ wallMs, counter, deviceId }`, generated through a `Clock` driven port and the `Hlc` helper
  in `sync-core`.
  - Each device advances its HLC on every local change, and on every sync it merges in the
    server's highest HLC, so a device with a slow clock moves forward as soon as it syncs.
  - The server never stores a stamp whose `wallMs` is more than 60 s ahead of its own clock: it
    clamps such stamps to `serverNow + 60 s`. A device whose clock is set in the future therefore
    wins only within that minute, never "forever" (spec edge case).
  - "Most recently made" (spec Assumptions) means the greatest stamp, compared as
    `(wallMs, counter, deviceId)`.
- **Rationale**: an HLC follows the wall clock when clocks are right, which is what a user
  expects from "the change made last", and it stays ordered and deterministic when they are
  not. The server bound handles the one case an HLC alone cannot: a clock in the future.
- **Alternatives considered**:
  - server arrival time (an offline device's old change would win on arrival, against the
    spec);
  - pure Lamport clocks (they ignore real time, so a change made in the morning could lose to
    one made the day before);
  - plain device wall clocks (no protection against wrong clocks).

## R7. Deletion records and long-offline devices (deferred question 2)

- **Decision**: the server keeps tombstones (deleted articles, merged entities, `present =
  false` items) **forever**. Every server row carries a `seq`, the server's global change
  counter at its last change. A device pulls every row with `seq > lastSeq`, tombstones
  included. So a device offline for weeks gets exactly what changed, and its old changes are
  merged by the same HLC rule. No change is dropped for being old (spec edge case).
- **Rationale**: one user's data is hundreds of rows; keeping every tombstone costs kilobytes
  and removes the "device offline longer than the retention period" failure mode altogether.
- **Alternatives considered**: purging tombstones after N days, with a full resync for older
  devices (more code and a new failure mode, for no measurable saving).

## R8. Same-name merge (FR-012)

- **Decision**: when a create or a rename on the server gives a category, an article or a list
  a `normalizedName` (001 R6) equal to another live entity of the same kind:
  - the **survivor** is the one with the smaller `(createdHlc, id)`;
  - the other is tombstoned with `mergedInto = survivor.id`;
  - for articles, the loser's list items move to the survivor. When the survivor is already on
    that list, the two items merge field by field (R5);
  - for categories, the loser's articles move to the survivor;
  - for lists, the loser's items move to the survivor.

  Later changes that target a merged id are redirected to its survivor. The merge runs on the
  server in the same transaction as the change that caused it. Devices receive the result:
  the loser as a tombstone with `mergedInto`, and the moved rows.
- **Rationale**: the earliest-created entity survives, so default categories and "Ma liste"
  keep the identity they got on the first device (FR-017, SC-007), and the rule does not
  depend on arrival order.
- **Locally**, a device keeps 001's `UNIQUE (normalized_name)`. Rows pulled while the device
  still has a pending local change on a same-named entity are applied on the next cycle, after
  the push has let the server merge them (R9).

## R8a. The current list after a merge (FR-015, US2-10)

- **Decision**: when `PulledRowsApplier` applies a list tombstone whose `mergedInto` is set, and
  `app_state.current_list_id` is that list, it sets `current_list_id` to the survivor (following
  the `mergedInto` chain) in the same transaction. The store reloads the current list after a
  pull as after any write, so the screen shows the survivor's name and the items of both, with
  no notice (spec clarification 2026-10-06).
- **Rationale**: 001 FR-002 needs exactly one existing current list at all times; doing it in
  the transaction that removes the loser means no read ever sees a current list that no longer
  exists. The current list stays per device: nothing is sent (FR-015).
- **Alternatives considered**: a notice "Votre liste a été fusionnée" (rejected in the spec's
  clarification); falling back to the first list by name (loses the user's place).

## R9. Sync cycle and protocol

- **Decision**: one authenticated endpoint, `POST /v1/sync`, pushes and pulls in a single
  round trip ([contracts/sync-api.md](contracts/sync-api.md)).
  1. **Push**: the device sends the released entries of its outbox in order, each with its
     `changeId` (a UUID).
  2. **Server transaction**: the server applies each change unless its `changeId` is already
     in `applied_change`, which makes the push idempotent (FR-006). It resolves merges (R8),
     bumps `seq` on every row it touches, and records the device's `lastSyncAt`.
  3. **Pull**: the response carries the ids of the changes that were applied or already
     known, every row with `seq > lastSeq` (including the effects of the device's own
     changes), the new `seq`, the server's highest HLC and its `serverId`.
  4. **Device transaction**: the device removes the acknowledged entries from its outbox,
     upserts or deletes the pulled rows (skipping the fields of changes still pending, R8),
     stores `lastSeq` and merges the HLC.

  Pushes are capped at 500 changes per request; the device loops until its outbox is empty.
- **When a cycle runs**, through a `SyncScheduler` in the UI adapter:
  - when the app opens and when it comes back to the foreground;
  - 1 s after a local write (debounced);
  - every 5 s while the app is in the foreground and connected (SC-001: under 10 s between
    devices);
  - on "Synchroniser maintenant".

  After a failure, cycles back off exponentially (5 s up to 5 min). There is no background
  sync when the app is closed: FR-004 and FR-007 only require sync while the app is open or
  being opened.
- **Rationale**: one request per cycle keeps the protocol small, and sending the full state of
  changed rows (not deltas) makes applying a pull a plain upsert. Polling every 5 s in the
  foreground is a few bytes when nothing changed, simpler than a WebSocket for one user.
- **Alternatives considered**:
  - a WebSocket or server-sent events (live updates under 1 s, but a connection to keep alive
    on mobile networks, for a 10 s target);
  - separate push and pull endpoints (two round trips per cycle).

## R10. Outbox, and undo that never reaches the server (FR-005, FR-008)

- **Decision**:
  - **The outbox is a local SQLite table.** Every command use case of 001 and 002 records its
    changes in it inside the same `UnitOfWork` transaction as the data. It does so through a
    new `ChangeRecorder` port (`changes.record(entity, id, fields)`), which stamps each change
    with the HLC. A crash therefore never leaves data without its change, or a change without
    its data (001 R19, FR-005).
  - **Undoable changes are held.** The changes of a removal (001 `removeItemFromList`) or of a
    deletion (002 `deleteArticle`) are recorded `held = true` under the undo's id, and a sync
    never sends held entries:
    - `restoreRemovedItem` and `restoreDeletedArticle` delete the held entries, so the server
      never sees the change (FR-008, US1-7);
    - when the offer ends (5 s, the next write, or dismissal), the store calls a new
      `releaseHeldChanges(undoId)` use case;
    - at startup, `initializeStore` releases every held entry left by a killed app, because
      the deletion is then final (002 edge case).
- **Rationale**: recording in the same transaction is the promise 001 R19 and 002 R7 made.
  Holding entries reuses the undo slot that already exists in the store, instead of adding a
  timer to the sync layer.
- **Alternatives considered**:
  - SQLite triggers filling the outbox (they cannot compute the HLC or know about undo);
  - diffing local state against the last pulled state (loses the field-level intent and the
    HLC of each change).

## R10a. What a pull removed: open forms and the undo offer (FR-020a, FR-008)

- **Decision**: `PulledRowsApplier.apply` returns, next to `deferred`, the `RemoteEffects` of the
  rows it applied: the articles deleted, the list items removed (`present = false`), and the
  merges (`loser id → survivor id`, any kind). `synchronize` returns them with its outcome, and
  the store's sync slice applies them after each cycle:
  - **Open forms** (QuantityDialog and EditArticle, the two forms that edit a synced item or
    article; creation dialogs have nothing a pull can remove): every form
    keeps its fields in local component state (001 T058's `…Form` convention), so a reload of
    the store's regions after a pull never resets what the user typed. On save, the store
    action first maps the form's target id through the merges seen during this session (a
    `redirects` map kept in the sync slice, never stored), then calls the use case as usual;
    the save is an ordinary local change, merged on the server by the HLC rules. When the
    form's article was deleted, or its item removed, by the pull, the form closes and the
    store sets `notice` to "Cet article a été supprimé sur un autre appareil." or "Cet article
    a été retiré de la liste sur un autre appareil." (the form subscribes to the effects of the
    next cycle through a `useRemoteRemoval(target)` hook).
  - **The undo offer**: when `pendingUndo` concerns an article the pull deleted (a removed item
    of that article, or 002's deleted article itself), the store clears `pendingUndo` (the
    snackbar disappears), calls `releaseHeldChanges(undoId)` (the server acknowledges and
    ignores changes to a deleted article, R9), and remembers that `undoId` as ended remotely.
    An `undo(undoId)` that arrives afterwards (a tap racing the snackbar's removal) restores
    nothing and sets the notice "Cet article a été supprimé sur un autre appareil."; so does a
    `restoreRemovedItem` that returns `ArticleNotFound` because the deletion was applied first.
- **Rationale**: the applier is the only place that knows what a pull removed, and returning it
  as data keeps the UI reaction in the store, where the undo slot already lives. Local form
  state is the existing convention, so FR-020a's "keep what the user typed" needs no new
  mechanism.
- **Alternatives considered**: re-reading each open form's entity after every cycle (a query
  per open form every 5 s, and it still cannot tell a deletion from a merge); holding pulled
  deletions until the undo offer ends (rejected in the spec's clarification).

## R11. Device pairing and authorization (FR-019a to FR-019c; deferred question 3)

- **Decision**:
  - **Pairing code**: 8 characters from an unambiguous alphabet (no 0/O, 1/I/L), shown as
    `XXXX-XXXX`, single use, valid 10 minutes. The server stores only its SHA-256 hash.
  - **First code**: the maintainer runs `yarn workspace @mes-courses/server pairing-code` in a shell on the Pi.
    This command talks to the database directly and works even while no device exists.
  - **Next codes**: an authorized device calls `POST /v1/pairing-codes` ("Ajouter un
    appareil").
  - **Claiming**: `POST /v1/pairing/claim { code, deviceName }` returns a `deviceId` and a
    random 256-bit device credential. The server stores only the credential's SHA-256 hash.
    The app keeps the credential in the operating system's secure storage through
    `expo-secure-store`, never in SQLite or in logs.
  - **Every other request** sends the credential in the HTTP `Authorization` header with the
    `Bearer` scheme. Requests from unknown or revoked devices get `401` and read or change
    nothing (FR-019a, SC-008).
  - **Rate limit**: at most 5 failed claims in any rolling 10-minute window, counted globally
    since there is one user. Beyond that the server answers `429` with `Retry-After`
    (FR-019b, US4-12). Failed claims are recorded in the database, so a restart does not reset
    the count.
  - **Revocation**: `DELETE /v1/devices/:id` sets `revokedAt`, and the next request from that
    device gets `401` (SC-009). Disconnecting a device revokes itself.
- **Rationale**: 2^40 possible codes, with 5 tries per 10 minutes and a 10-minute lifetime,
  make guessing hopeless. Long random credentials stored hashed give revocable,
  per-device access without user accounts (spec: one user, no accounts). The first code needs
  physical or SSH access to the Pi, which only the maintainer has.
- **Alternatives considered**:
  - one shared server password (no per-device revocation);
  - OAuth or user accounts (needless for a single user);
  - QR codes (a convenience that can come later; typing 8 characters is under a minute,
    SC-006).

## R12. Detecting a reset server and app versions (FR-018a, spec edge cases)

- **Decision**:
  - **Server id**: the server creates a random `serverId` when it creates its database, and
    returns it on every response. The device stores the `serverId` it paired with.
  - **Reset or revoked**: a different `serverId`, or a `401` for its `deviceId`, means the
    server no longer knows the device. The device then:
    - keeps its local data and its outbox;
    - shows "Cet appareil n'est plus connecté au serveur." with "Se reconnecter" (US4-10);
    - after pairing again, starts a full upload (R13).
  - **Versions**: every response also carries `apiVersion` and `minAppVersion`. An app older
    than `minAppVersion` stops syncing and shows "Mettez à jour l'application pour
    synchroniser." Every request carries the app's version, so the server can refuse with
    `426` before touching any data. Newer fields sent by a newer server are ignored, never
    deleted.
- **Rationale**: a server id is the simplest way to tell "this is not the server I paired with",
  and it covers a reinstalled Pi without any backup machinery.

## R12a. A phone restored from a system backup (FR-018b)

- **Decision**:
  - **The credential is never restored onto another device.** On iOS, `CredentialStore` writes with
    the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility option, so the stored item never moves to
    another device through a backup. On Android, the `expo-secure-store` config plugin runs
    with `configureAndroidBackup: true`, which excludes its data from Auto Backup; 001's
    database stays included (001 R18b). A value that cannot be decrypted after a restore is
    read as `null`.
  - **Detection**: `synchronize` (and `getSyncInfo` at startup) treats `serverUrl` set with no
    credential as `disconnectedByServer`: the local copy and the outbox are kept, and the
    status bar shows "Cet appareil n'est plus connecté au serveur." with "Se reconnecter"
    (FR-018b, the same message as US4-10).
  - **Pairing again** goes through `connectToServer` with a new code: a new `deviceId`,
    `lastSeq = 0` and `snapshotDone = false`, so the restored copy is sent as a snapshot with
    the minimum HLC, then the restored outbox with its real, older HLCs (R13). Changes made
    since on other devices carry greater HLCs and win; data only on the restored phone is
    added. The old `deviceId` stays authorized until the user revokes it (FR-018b).
- **Same phone**: an iOS phone restored from its own backup onto the same hardware gets its
  stored credential back (Apple restores "this device only" items to the same device). That phone
  is the very device the server authorized, so no other device gains access; it syncs at once
  with its restored outbox, merged by the same rules. FR-018b allows this: the credential is never
  restored onto another device.
- **Rationale**: the platform's own backup rules keep the credential off any new device, with
  no code of ours in the backup path; the existing reset-server path (R12) already handles a
  device that holds data but no valid credential.
- **Alternatives considered**: storing an install marker outside the backup to detect any
  restore (no such location exists on iOS that also survives app updates); revoking the old
  `deviceId` automatically on re-pairing (the server cannot tell a restored phone from a second
  phone, and FR-018b leaves the old authorization as it is).

## R13. Joining a server with existing local data (FR-017, FR-018, FR-018a)

- **Decision**: on its first sync with a server (`lastSeq = 0`), the device pushes a snapshot:
  one change per local row and field, stamped with the **minimum HLC**
  `{ wallMs: 0, counter: 0, deviceId }`. The outbox then follows with its real-HLC changes.
  - On an empty server (FR-018), the snapshot becomes the server's data.
  - On a server with data (FR-017), the snapshot loses every field conflict, because the
    server's values have a greater HLC. Same-named defaults and "Ma liste" merge into the
    server's ones (R8), so nothing is duplicated (SC-007). Data that exists only on the device
    is added.
  - Several devices re-pairing with a reset server (FR-018a) merge their snapshots by the same
    rules, with ties broken by `deviceId`.
- **Rationale**: no special "first sync" path on the server; the ordinary merge rules give the
  behavior the spec asks for. The device keeps seeding at first launch (001 R18), so it works
  offline before it is ever connected (US4-1).

## R14. Sync status (US3, FR-020 to FR-022, Principle IX)

- **Decision**: the store gains a `sync` slice:
  - `connection`: `'notConnected' | 'connected' | 'disconnectedByServer' | 'updateRequired'`;
  - `status`: `'saved' | 'waiting' | 'sending' | 'failed'`;
  - `pendingCount`;
  - `lastSyncAt`.

  Status rules:
  - a network error, a timeout or a server that cannot be reached means `waiting`. It is never
    reported (FR-022);
  - a `5xx`, an unexpected response, or a certificate that cannot be verified, three times in a
    row, means `failed`, reported once per failure streak with `{ operation: 'sync' }`;
  - a success resets the streak.

  A shared `SyncStatusBar` component, from the shared UI module (Principle V), renders the slice
  under the Appbar of every data screen: CurrentList, AddArticles, Lists, EditArticle and
  Settings.
- **Screen reader** (FR-023, clarified 2026-10-06): the bar is **not** a live region, because a
  cycle runs every 5 s and a live region would read "Synchronisation…" then "Synchronisé" each
  time. The sync slice calls `AccessibilityInfo.announceForAccessibility` only on two
  transitions: into `failed` ("Échec de la synchronisation") and from a failure streak back to
  `saved` ("Synchronisé"). The waiting count and the rows a pull changes are never announced;
  the bar stays readable when focused.
- **Focus after a pull** (FR-023, 001 FR-037): React Native has no cross-platform event telling
  which element has screen reader focus. The CurrentList screen therefore treats the row the
  user last activated, or last received focus through 001's own focus moves, as the focused
  row. When a pull removes that row, the screen moves focus as after a local removal (next row,
  previous one, or the empty state). Rows the user only swiped past are left to TalkBack and
  VoiceOver, which move focus off a removed element themselves. Quickstart step 15 checks both
  platforms.
- **Rationale**: one component and one slice keep the status identical everywhere, and the
  thresholds match the spec ("several times in a row").

## R15. Server error tracking (FR-022a)

- **Decision**: `@sentry/node`, behind an `ErrorReporter` port in the server, mirrors the app's
  (001 R13):
  - `sendDefaultPii: false`;
  - a `beforeSend` that drops request bodies and headers;
  - contexts limited to `{ operation, route }`;
  - release = the server's version, environment from configuration.

  It reports uncaught exceptions, failed transactions, and 5xx responses. Caddy's renewal
  failures appear in Caddy's log, and the app reports a certificate it cannot verify (R14), so
  a failed renewal is still seen. Refused claims and `401`s are expected and not reported.
  Without `SENTRY_DSN`, the server logs to the console.
- **Rationale**: one error tracking tool for the whole project, with the same privacy rules
  (Principle VIII).

## R16. Architecture, tests and CI

- **Server layers**: the server follows the same hexagonal layout as the app (Principle VI):
  - `apps/server/src/domain` (apply a change, merge, authorize) imports only `sync-core`;
  - `apps/server/src/application` (use cases `sync`, `claimPairingCode`, `createPairingCode`,
    `listDevices`, `renameDevice`, `revokeDevice`) imports only domain, `sync-core` and its own
    ports;
  - `apps/server/src/adapters` holds `http` (Fastify), `sqlite`, `error-reporting` and `crypto`;
  - `apps/server/src/composition` wires them.

  dependency-cruiser gains the same rules for `apps/server/`, a rule that `packages/sync-core`
  imports nothing, and a rule that only `tests/*` imports `@mes-courses/mobile/testing` or
  `@mes-courses/server/testing` (Principle XI).
- **Tests**:
  - `sync-core`: Jest unit tests for the HLC, the field merge and `normalizedName`, including
    property-style tests that apply the same changes in every order and check the result is
    identical (SC-003);
  - server domain and use cases: in-memory fakes;
  - server SQLite adapter: shared contract suites on `node:sqlite`;
  - server HTTP adapter: Fastify `inject`;
  - the app's `SyncServer` HTTP adapter: tested in `tests/sync/` against a real in-process
    server on a random local port with an in-memory database (Principle VII: the real
    technology, never the production server);
  - two-device scenarios: in `tests/sync/`, two app stacks on fakes, sharing one in-process
    server, with the acceptance scenarios of US2.
- **CI**: the existing jobs of 001 already run across every workspace from the root
  (`yarn workspaces foreach`), so they cover the server, `sync-core` and `tests/sync/` with
  no new job; the `build` job now also compiles the server. There is no deployment from CI: the maintainer deploys to the Pi by hand
  (quickstart), and the Pi is never reached from CI.

## R17. Deployment on the Pi

- **Decision**:
  - Raspberry Pi OS Lite 64-bit with Nix (multi-user install, flakes enabled), and Caddy from
    its Debian repository;
  - Node comes from the project's flake ([001 R21](../001-shopping-lists/research.md#r21-development-environment-nix-flake)),
    so the Pi runs the exact Node of `flake.lock`, like developers and CI. The flake exposes
    `packages.aarch64-linux.node` (the same `nodejs_24` as the dev shell); deploying builds it
    into `/opt/mes-courses/runtime`, a symlink that is also a Nix garbage-collection root;
  - a system user `mes-courses` owns `/var/lib/mes-courses/` and `/opt/mes-courses/`;
  - a systemd unit `mes-courses.service` runs
    `/opt/mes-courses/runtime/bin/node /opt/mes-courses/apps/server/dist/composition/main.js`
    (the server's `start` script) with `Restart=always` and `NODE_ENV=production`;
  - the Sentry DSN sits in `/etc/mes-courses.env`, readable only by that user;
  - deploying means `git pull`, then, inside the flake's dev shell (`nix develop --command …`,
    which brings Yarn through Corepack): `yarn workspaces focus @mes-courses/server` (installs
    only the server and `sync-core`, not the app's React Native dependencies) and
    `yarn workspace @mes-courses/server build`; then `nix build .#node --out-link
    /opt/mes-courses/runtime` and `systemctl restart mes-courses`. Server migrations run at
    startup in one transaction.

  The files are `deploy/mes-courses.service`, `deploy/Caddyfile` and
  `deploy/mes-courses.env.example` (with no values).
- **Rationale**: plain systemd and Caddy are the least moving parts on a Pi. Containers would
  add a runtime and an image registry for one process. Taking Node from the flake removes the
  last place where the Node version was chosen outside `flake.lock`.
- **Alternatives considered**: NodeSource's Debian repository (a second, unpinned source of
  Node); NixOS on the Pi (would also manage Caddy and the unit declaratively, but replaces the
  whole operating system for one service); a full Nix package of the server built from
  `yarn.lock` (Yarn 4 support in nixpkgs' builders is young, and `git pull` plus a build is
  enough here); Caddy from nixpkgs (it would need its own systemd unit, while the Debian package
  ships one and updates with the system).

## New dependencies (Principle IV)

| Dependency | Where | Why it is needed |
|---|---|---|
| `fastify` (5.x) | server | HTTP routing and schema validation, `inject` for tests (R2). |
| `@sentry/node` | server | Server error tracking (R15, FR-022a). |
| `expo-secure-store` | app | Keeps the device credential in the operating system's secure storage (R11), out of system backups (R12a). |
| Caddy 2 (system package, not npm) | Pi | TLS with automatic Let's Encrypt certificates and reverse proxy (R4, FR-019). |
| Nix (on the Pi) | Pi | Provides the server's Node from the project's flake (R17, 001 R21). |
| Yarn 4 workspaces (through Corepack) | repo | Already set up by 001 (Principle XI); the server, `sync-core` and `tests/sync` join it (R1). |

No new dependency is needed for HTTP in the app (`fetch`), connectivity (a failed request means
offline, R14) or SQLite on the server (`node:sqlite`, R3).
