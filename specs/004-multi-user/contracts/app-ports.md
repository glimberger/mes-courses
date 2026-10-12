# Contract: App and Server Ports and Use Cases

Additions and changes to the ports of [003](../../003-server-sync/contracts/app-ports.md), on both
sides. The conventions are those of 001: `Result` for expected failures, throws for unexpected
ones, every write in `UnitOfWork.run` (app) or `ServerStore.run` (server). Types are in
[../data-model.md](../data-model.md).

## Shared (`packages/sync-core`, pure)

```ts
normalizeEmail(raw: string): string | null;
validateNewPassword(password: string, previous?: { temporary: string } | { current: string }): PasswordProblem | null;
```

## Server

### Driven ports (`apps/server/src/application/ports/`)

```ts
interface ServerStore {
  /** Directory work: accounts, devices, ended credentials, attempts. No access to user data. */
  run<T>(work: (repos: DirectoryRepositories) => Promise<T>): Promise<T>;
  /** User data of one account, plus the directory. Every data statement is bound to the account. */
  runForAccount<T>(accountId: string, work: (repos: Repositories) => Promise<T>): Promise<T>;
}

interface AccountRepository {
  add(record: AccountRecord): Promise<void>;
  get(id: string): Promise<AccountRecord | null>;
  findByEmail(normalizedEmail: string): Promise<AccountRecord | null>;
  update(record: AccountRecord): Promise<void>;
  all(): Promise<AccountRecord[]>;                          // by creation time, then id
  delete(id: string): Promise<void>;                        // the cascade does the rest
  countOtherActiveAdministrators(id: string): Promise<number>;
  lastSyncAt(id: string): Promise<Instant | null>;          // latest of its devices
}
interface DeviceRepository {                                // 003's, plus the account
  add(record: DeviceRecord): Promise<void>;                 // DeviceRecord gains accountId
  findByCredentialHash(hash: string): Promise<DeviceRecord | null>;
  forAccount(accountId: string): Promise<DeviceRecord[]>;   // replaces all(): a user lists only their own
  // get, update as before
}
interface EndedCredentialRepository {
  add(credentialHash: string, reason: 'accountDeleted', at: Instant): Promise<void>;
  find(credentialHash: string): Promise<{ reason: 'accountDeleted' } | null>;
}
interface AuthAttemptRepository {                           // replaces PairingFailureRepository
  add(kind: AttemptKind, keyHash: string, at: Instant): Promise<void>;
  countSince(kind: AttemptKind, keyHash: string, since: Instant): Promise<number>;
  earliestSince(kind: AttemptKind, keyHash: string, since: Instant): Promise<Instant | null>;
  pruneBefore(before: Instant): Promise<void>;              // called at start and before each auth request (research R6)
  deleteForKey(keyHash: string): Promise<void>;             // both kinds; used when an account is deleted (research R16)
}

interface PasswordHasher {                                  // scrypt adapter; a cheap fake in tests (research R3); both normalize to NFC first
  hash(password: string): Promise<string>;
  verify(password: string, stored: string | null): Promise<boolean>;   // null verifies a dummy hash and returns false
}
interface PairingCrypto { /* 003's: sha256Hex, generateCredential; the code helpers become generateTemporaryPassword / normalizeTemporaryPassword */ }
interface Mailer {                                          // nodemailer adapter; FakeMailer in tests (research R8)
  send(message: MailMessage): Promise<void>;                // throws MailFailedError, whose message is fixed
}
type MailMessage =
  | { kind: 'invitation'; to: string; temporaryPassword: string; expiresAt: Instant; serverUrl: string }
  | { kind: 'newTemporaryPassword'; to: string; temporaryPassword: string; expiresAt: Instant };
```

`Clock`, `IdGenerator`, `ErrorReporter` and `Random` are 003's. `ErrorReporter` gains the scrubber of
research R10 inside its adapters, not in the port.

### Use cases (`apps/server/src/application/use-cases/`)

| Use case | Behavior |
|---|---|
| `signIn` | Contract of `POST /v1/auth/sign-in`. Limits first, then the dummy-or-real verification, then current password, temporary password, suspension. Returns an outcome (`signedIn`, `passwordChangeRequired`, `invalid`, `expired`, `suspended`, `blocked`). Failures are recorded and returned, never thrown. |
| `choosePassword` | Verifies the temporary password again, applies `validateNewPassword`, sets the hash, clears the temporary password, creates the device, in one transaction. |
| `requestPasswordReset` | Limits, then for an existing non-suspended account stores a new temporary password and returns the message to send; the HTTP layer sends it after answering (detached, errors reported). Always the same outcome to the caller. |
| `getAccount`, `changePassword`, `deleteOwnAccount` | US6. `changePassword` refuses a new password equal to the current one (`SameAsCurrent`). Deletion copies the credential hashes to `EndedCredentialRepository`, deletes the account's attempt rows, and deletes the account. |
| `inviteAccount` | Normalizes and validates the address, refuses an existing one, creates the account and its temporary password (transaction 1), sends the email, deletes the account again if the send fails (transaction 2). |
| `listAccounts`, `suspendAccount`, `reactivateAccount`, `deleteAccount`, `resendCredentials` | US5. The last-administrator rule is in the domain (`canLoseAdministrator`). |
| `authenticateDevice` | Used by the HTTP auth hook. Returns `{ device, account }` or the refusal code in the order of [auth-api.md](auth-api.md#common-rules-changed). |
| `claimPairingCode`, `createPairingCode` | **Removed**, with `PairingCodeRepository` and `PairingFailureRepository`. |
| `sync`, `listDevices`, `renameDevice`, `revokeDevice` | **Unchanged in logic**: they receive repositories bound to the caller's account. `listDevices` and `rename`/`revoke` find devices through `forAccount`, so another account's device id answers `NotFound`. |

The composition adds `create-admin.ts` and `set-password.ts` (the commands, sharing one prompt and
one check, research R17), the `Mailer` wiring from the environment, and
the hooks that call `authenticateDevice` before `runForAccount`.

## App

### Driven ports (`apps/mobile/src/application/ports/`)

```ts
interface AccountServer {                      // HTTP adapter, over the same transport as SyncServer
  signIn(url: string, email: string, password: string, deviceName: string):
    Promise<Result<SignInOutcome, InvalidCredentials | TemporaryPasswordExpired | AccountSuspended | TooManyAttempts | ServerUnreachable | UntrustedServer | UpdateRequired>>;
  choosePassword(url: string, email: string, temporaryPassword: string, newPassword: string, deviceName: string):
    Promise<Result<Pairing, InvalidCredentials | TemporaryPasswordExpired | AccountSuspended | PasswordRejected | TooManyAttempts | ServerUnreachable | UntrustedServer>>;
  requestPasswordReset(url: string, email: string):
    Promise<Result<void, TooManyAttempts | ServerUnreachable | UntrustedServer>>;
  getAccount(conn: Connection): Promise<Result<AccountInfo, SyncFailure>>;
  changePassword(conn: Connection, current: string, next: string): Promise<Result<void, InvalidCredentials | PasswordRejected | TooManyAttempts | SyncFailure>>;
  deleteAccount(conn: Connection, password: string): Promise<Result<void, InvalidCredentials | TooManyAttempts | LastAdministrator | SyncFailure>>;
}
// SignInOutcome = { type: 'signedIn'; pairing: Pairing } | { type: 'passwordChangeRequired' }
// Pairing is 003's (deviceId, credential, serverId, apiVersion, minAppVersion) plus accountId.

interface AdminServer {                        // same adapter family; used only by the administrator screens
  listAccounts(conn): Promise<Result<AccountSummary[], SyncFailure | Forbidden>>;
  invite(conn, email): Promise<Result<AccountSummary, InvalidEmail | AccountExists | MailFailed | SyncFailure | Forbidden>>;
  suspend(conn, id): Promise<Result<void, LastAdministrator | NotFound | SyncFailure | Forbidden>>;
  reactivate(conn, id): Promise<Result<void, NotFound | SyncFailure | Forbidden>>;
  resendCredentials(conn, id): Promise<Result<void, NotInvited | NotFound | MailFailed | SyncFailure | Forbidden>>;
  delete(conn, id): Promise<Result<void, LastAdministrator | NotFound | SyncFailure | Forbidden>>;
}

interface LocalDataEraser {                    // SQLite adapter; deletes every data row, the outbox and sync_state, then reseeds (research R11)
  erase(): Promise<void>;
}
```

`SyncServer` loses `claim` and `createPairingCode`. `SyncFailure` gains
`AccountDeleted` and `AccountSuspended`, and its `DeviceNotAuthorized` keeps meaning "revoked".
`SyncState` gains `accountId`. `CredentialStore` is unchanged.

### Use cases (`apps/mobile/src/application/use-cases/`)

| Use case | Behavior |
|---|---|
| `signIn` | `(url, email, password, deviceName) => Result<'signedIn' \| 'passwordChangeRequired', SignInError>`. Normalizes the URL (`https://` only), the address (`normalizeEmail`, `InvalidEmail` locally) and calls `health` then `AccountServer.signIn`. On `signedIn`: applies the **local copy rule** (data-model), stores the credential, then saves the connection fields and `accountId` with `lastSeq` and `snapshotDone` reset as 003's `connectToServer` did, in the same order (credential first). On `passwordChangeRequired`: stores nothing. |
| `chooseInitialPassword` | `(url, email, temporaryPassword, newPassword, confirmation, deviceName)`. Checks the two entries match and `validateNewPassword` locally (US2-3), then `AccountServer.choosePassword`, then stores the connection as `signIn` does. `InvalidCredentials` here means the temporary password is no longer valid (replaced, used elsewhere): it is returned as `TemporaryPasswordInvalid` so the screen can say so (research R4). |
| `requestPasswordReset` | `(url, email) => Result<void, ...>` for US4. The screen shows the same message on success and on a missing account (the server's answer is identical). |
| `getAccountSettings` | The read model of US6-1: `getSyncInfo`, `AccountServer.getAccount` and `listDevices`; offline, the cached email and the devices error state of 003. The email and role are kept in memory only. |
| `changePassword` | `(current, next, confirmation)` with the same local checks, plus `SameAsCurrent`. |
| `signOut` | `() => Promise<Result<void, never>>`. Revokes this device on the server (best effort), clears the credential, erases the replica through `LocalDataEraser`. The warning about pending changes is the store's: it reads `getSyncInfo().pendingCount` before offering the confirmation (US6-4). Replaces 003's `disconnect`, which kept the data. |
| `deleteMyAccount` | `(password)`. `AccountServer.deleteAccount`, then the same local cleanup as `signOut` without calling revoke. |
| `acknowledgeSignedOut` | Called when the user dismisses the "signed out by the server" message: erases the replica and returns the connection to `notConnected` (research R11). |
| `listAccounts`, `inviteAccount`, `suspendAccount`, `reactivateAccount`, `resendCredentials`, `deleteAccountAsAdmin` | Thin use cases over `AdminServer`, each returning the server's refusals as typed errors. |
| `connectToServer`, `createPairingCode` | **Removed.** `ChangeServerUrl` and the device use cases of 003 are unchanged. |
| `synchronize` | From `connected` and from `suspended` alike, gains the two refusals: `AccountDeleted` gives the outcome `signedOut('accountDeleted')`, `AccountSuspended` gives `suspended`. `DeviceNotAuthorized` gives `signedOut('revoked')`. It records `accountId` the first time a response carries one. Local data and the outbox are kept in all three outcomes until `acknowledgeSignedOut`. |
| `getSyncInfo` | `connection` takes the values of [data-model.md](../data-model.md#connection-state-ui-store-syncconnection). |

### Tests that pin the local copy rule and the isolation of devices

- `signIn` with every row of the rule's table: same account (copy and outbox kept), an anonymous
  never-connected copy (kept, adopted by the snapshot), another account (erased before the
  credential is stored), a connection with no known account (erased).
- A failed `signIn` changes nothing (credential, `sync_state`, data).
- `signOut` offline clears the credential and the data and leaves the server's device for the owner
  to revoke later.
- `synchronize` on `AccountSuspended` keeps the outbox and keeps trying on its slow backoff; on
  `AccountDeleted` and `DeviceNotAuthorized` it stops and keeps the data on screen until
  `acknowledgeSignedOut`.
