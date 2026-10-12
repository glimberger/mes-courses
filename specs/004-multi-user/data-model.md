# Data Model: Multi-User Accounts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-12

This builds on [003's data model](../003-server-sync/data-model.md). It has three parts: the types
shared by the app and the server (`packages/sync-core`), the server database (migration 2), and the
app's local additions (migration 3).

## Shared types (`packages/sync-core`)

```text
normalizeEmail(raw: string): string | null      // trim + lower-case; null if not a valid address (research R13)
validateNewPassword(password, previous?: { temporary: string } | { current: string }): PasswordProblem | null
  PasswordProblem = 'TooShort' | 'TooLong' | 'SameAsTemporary' | 'SameAsCurrent'
  // 12 to 128 code points after NFC, any character, no trimming (FR-005, research R3).
  // SameAsTemporary: choosing after a temporary password. SameAsCurrent: changing it (US6-2).

AccountRole  = 'user' | 'administrator'
AccountState = 'invited' | 'active' | 'suspended'                   // derived, see below

AccountSummary = {                                                  // admin list (US5-1)
  id: string; email: string; role: AccountRole; state: AccountState; lastSyncAt: string | null
  invitationExpired: boolean                                        // state 'invited' and the temporary password expired (research R12)
}
AccountInfo = { id: string; email: string; role: AccountRole }      // GET /v1/account (R9)
```

The `Hlc`, `Change` and `ServerRow` types of 003 do not change. Every response of the server gains
`accountId` (research R9); the device types of 003 (`DeviceSummary`) are unchanged. The request and
response types of the new routes are in [contracts/auth-api.md](contracts/auth-api.md) and live in
`protocol.ts`.

## Server database (migration 2)

Migration 2 runs in the transaction `migrate` already opens, with `PRAGMA defer_foreign_keys = ON`
and a final `PRAGMA foreign_key_check` that must return nothing.

```sql
CREATE TABLE account (
  id                       TEXT PRIMARY KEY,
  email                    TEXT UNIQUE,                  -- normalized; NULL only for the setup account (research R2)
  role                     TEXT NOT NULL CHECK (role IN ('user', 'administrator')),
  password_hash            TEXT,                         -- scrypt string (research R3); NULL until chosen
  temporary_password_hash  TEXT,                         -- NULL when none outstanding
  temporary_expires_at     TEXT,
  suspended_at             TEXT,
  created_at               TEXT NOT NULL,
  CHECK (email IS NOT NULL OR (role = 'administrator' AND password_hash IS NULL)),
  CHECK ((temporary_password_hash IS NULL) = (temporary_expires_at IS NULL))
);
```

**Derived state** (never stored, so it cannot disagree with its causes):

| Condition | State |
|---|---|
| `suspended_at IS NOT NULL` | suspended |
| else `password_hash IS NULL` | invited (never signed in) |
| else | active |

The setup account (no email) is `invited`, has no way to sign in and does not appear to a user; it
is listed to the administrator only once `create-admin` has completed it.

Every data table is rebuilt with the account as the first key column. Shown for `category` and
`article`; `shopping_list` and `list_item` follow the same pattern, and every foreign key between
data tables becomes composite:

```sql
CREATE TABLE category (
  account_id      TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL, name_hlc TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  position        INTEGER NOT NULL, position_hlc TEXT NOT NULL,
  created_hlc     TEXT NOT NULL,
  deleted_hlc     TEXT, merged_into TEXT,
  seq             INTEGER NOT NULL,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, merged_into) REFERENCES category(account_id, id)
);
CREATE UNIQUE INDEX category_live_name ON category(account_id, normalized_name) WHERE deleted_hlc IS NULL;
CREATE INDEX category_seq ON category(account_id, seq);

CREATE TABLE article (
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  /* name, name_hlc, normalized_name, created_hlc, deleted_hlc, seq: as in 003 */
  category_id TEXT NOT NULL, category_hlc TEXT NOT NULL,
  merged_into TEXT,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, category_id) REFERENCES category(account_id, id),
  FOREIGN KEY (account_id, merged_into) REFERENCES article(account_id, id)
);
-- list_item: PRIMARY KEY (account_id, list_id, article_id), composite foreign keys to both parents.
```

Other changes:

```sql
-- Idempotence is per account: another account's change id can never be mistaken for a replay.
CREATE TABLE applied_change (
  account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  change_id  TEXT NOT NULL,
  device_id  TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  PRIMARY KEY (account_id, change_id)
);

-- A device belongs to exactly one account. Existing rows go to the setup account (research R2).
ALTER TABLE device ADD COLUMN account_id ...;        -- done as a rebuild: NOT NULL REFERENCES account(id) ON DELETE CASCADE
CREATE INDEX device_account ON device(account_id);

-- What lets a device learn that its account was deleted (research R7). Holds no data of the account.
CREATE TABLE ended_credential (
  credential_hash TEXT PRIMARY KEY,
  reason          TEXT NOT NULL CHECK (reason IN ('accountDeleted')),
  ended_at        TEXT NOT NULL
);

-- Replaces pairing_failure (research R6). Keys are SHA-256 hashes: no readable address is stored.
CREATE TABLE auth_attempt (
  kind     TEXT NOT NULL CHECK (kind IN ('signIn', 'passwordReset')),
  key_hash TEXT NOT NULL,
  at       TEXT NOT NULL
);
CREATE INDEX auth_attempt_key ON auth_attempt(kind, key_hash, at);

DROP TABLE pairing_code;
DROP TABLE pairing_failure;
```

`meta` is unchanged (the global `seq`, research R1).

### Rules enforced by the server's domain (each with tests)

- Every statement on a data table carries the bound account (the repositories, research R1). A
  **contract test** run against the in-memory fake and the SQLite store alike writes the same ids
  in two accounts and asserts that neither sees, changes or counts the other's rows.
- An email is stored normalized and is unique (FR-001). Inviting an existing address changes
  nothing.
- A temporary password expires 7 days after it is made; it is cleared by its first successful use
  and replaced by a new one on reset or on "send the credentials again" (FR-004, FR-010, US5-6).
  A reset on an active account does not touch `password_hash` (clarification B).
- A password is set only through `validateNewPassword` (FR-005), and normalized to NFC before it
  is hashed or verified (research R3).
- Suspension sets `suspended_at` and changes nothing else; reactivation clears it (FR-014).
- Deleting an account: in one transaction, copy each of its devices into `ended_credential`, delete
  the `auth_attempt` rows keyed by its address (both kinds), then `DELETE FROM account` (the cascade
  removes the rest, FR-016, SC-007). What remains anywhere afterwards is listed in research R16.
- `auth_attempt` rows older than 60 minutes are deleted at server start and at the start of every
  request that reads or writes attempts (research R6).
- "Send the credentials again" requires the derived state `invited`; a suspended account that
  never signed in is refused with `NotInvited` until reactivated (research R12).
- At least one other active administrator must exist for an administrator to be suspended or
  deleted (FR-013, FR-016, research R12).

### State transitions

```text
(none) --invite--> invited                       temporary password set, email sent; email failure -> deleted again (FR-003)
invited --choose password with the temporary one--> active          password set, temporary cleared, device created
invited --temporary expired--> invited           shown as invitationExpired; "send the credentials again" or a reset makes a new one
invited --reset or resend--> invited             the temporary password is replaced; the previous one stops working
active --reset requested--> active               + a temporary password; the current one still works
active --signs in with the temporary one--> active     must choose a password (replaces both)
invited | active --suspend--> suspended          data kept, devices refused with AccountSuspended
suspended --reactivate--> invited | active       back to what it was; no new sign-in for devices
any --delete (own or administrator)--> (gone)    data and devices removed; credentials remembered as ended
```

## App: local additions (migration 3)

```sql
ALTER TABLE sync_state ADD COLUMN account_id TEXT;      -- the account whose data the replica holds; NULL before any sign-in
```

`SyncState` gains `accountId: string | null`. Nothing else in the local schema changes: data tables,
outbox and `app_state` are the account's data and are erased as a whole (research R11).

### Connection state (UI store, `sync.connection`)

003's states, with the following changes:

```text
notConnected --signIn / chooseInitialPassword succeeds--> connected      (was: claim succeeds)
connected --401 DeviceNotAuthorized--> signedOut(reason: 'revoked')       (was: disconnectedByServer)
connected --401 AccountDeleted--> signedOut(reason: 'accountDeleted')
connected --403 AccountSuspended--> suspended                             data kept, edits queued
suspended --next sync succeeds--> connected                               account reactivated; no sign-in
suspended --401 AccountDeleted--> signedOut(reason: 'accountDeleted')     a suspended account then deleted (US6-5)
suspended --401 DeviceNotAuthorized--> signedOut(reason: 'revoked')
signedOut --user dismisses the message--> notConnected                    replica erased (research R11)
connected --signOut confirmed--> notConnected                             replica erased
connected --serverUrl set but no credential (restored phone)--> signedOut(reason: 'revoked')   (003 FR-018b, message unchanged)
connected --response minAppVersion > app version--> updateRequired        (unchanged)
```

`signedOut` replaces 003's `disconnectedByServer`; its two reasons give the two French messages,
and the notice also shows the number of changes that will be lost when it is not zero
(`getSyncInfo().pendingCount`, research R11).
A restored phone keeps the 003 message because the cause is the same as a revoked device from the
user's point of view.

### Local copy rule (research R11)

```text
decide(copy.accountId, copy.serverUrl, signingInAccountId):
  copy.accountId == signingInAccountId           -> keep
  copy.accountId == null && copy.serverUrl == null -> keep (anonymous local data, adopted by the snapshot)
  otherwise                                       -> erase, then sign in
```

### Read models (new)

```text
AccountSettings = { email, role, serverUrl, lastSyncAt, devices: DeviceSummary[] }   // US6-1
```

`DeviceSummary` and `SyncInfo` are 003's, restricted by the server to the caller's account.
