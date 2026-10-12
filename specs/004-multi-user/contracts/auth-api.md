# Contract: Accounts HTTP API (server)

Changes to [003's sync API](../../003-server-sync/contracts/sync-api.md). Everything not listed
here is unchanged: `GET /v1/health`, `POST /v1/sync`, `GET /v1/devices`, `PATCH /v1/devices/:id`,
`DELETE /v1/devices/:id`, the common rules (JSON, `serverId`, `apiVersion`, `minAppVersion`,
`X-App-Version`, 1 MB limit, error codes not text). The TypeScript types live in
`packages/sync-core/src/protocol.ts`. The server returns codes; the app writes the French
(Principle X).

## Common rules (changed)

- **Every response** also carries `accountId` when the caller is authenticated or has just signed
  in (research R9).
- **Authorization** for every route except `GET /v1/health` and the three `/v1/auth/*` routes. The
  check order is fixed (research R5, R7), and nothing is read before it passes:

  | Case | Answer |
  |---|---|
  | No credential, or an unknown one | `401 { error: 'DeviceNotAuthorized' }` |
  | A credential in `ended_credential` | `401 { error: 'AccountDeleted' }` |
  | The device is revoked | `401 { error: 'DeviceNotAuthorized' }` |
  | The account is suspended | `403 { error: 'AccountSuspended' }` |
  | `/v1/admin/*` and the caller is not an administrator | `403 { error: 'Forbidden' }` |

- **New error codes**: `InvalidCredentials` (401), `TemporaryPasswordExpired` (401),
  `AccountSuspended` (403), `AccountDeleted` (401), `Forbidden` (403), `InvalidEmail` (400),
  `InvalidPassword` (400, with `problem`: `TooShort`, `TooLong`, `SameAsTemporary`, `SameAsCurrent`),
  `InvalidDeviceName` (400), `AccountExists` (409), `LastAdministrator` (409), `NotInvited` (409),
  `MailFailed` (502). `TooManyAttempts` (429, with `Retry-After`) now also applies to sign-in and
  reset.
- **Passwords in requests**: every password field is capped at 512 UTF-16 units by the route's
  JSON schema (`400 BadRequest` beyond). The server normalizes passwords to NFC before checking,
  hashing or verifying them (research R3). These routes are only reachable through Caddy's TLS
  (research R5).
- **Removed**: `POST /v1/pairing/claim`, `POST /v1/pairing-codes`, the `InvalidCode` error and the
  `pairing-code` command. `minAppVersion` is raised to this feature's app version (research R5).

## `POST /v1/auth/sign-in`

Not authenticated. It signs a device in with the current password, or starts the first sign-in with
a temporary password (US2).

```text
Request:  { email: string, password: string, deviceName: string /* 1–60 chars */ }
200:      { outcome: 'signedIn', deviceId, credential /* 256-bit, base64url */, account: AccountInfo, serverId, apiVersion, minAppVersion, accountId }
200:      { outcome: 'passwordChangeRequired' }      // the temporary password matched; no device is created
400:      { error: 'InvalidEmail' | 'InvalidDeviceName' | 'BadRequest' }
401:      { error: 'InvalidCredentials' }            // unknown address or wrong password: identical (FR-006)
401:      { error: 'TemporaryPasswordExpired' }      // only when the expired temporary password was typed (research R4)
403:      { error: 'AccountSuspended' }              // only when the password was right
429:      { error: 'TooManyAttempts' }               // checked before the password (research R6)
```

Order inside the route: normalize the address → check the limits → find the account (a fixed
dummy hash is verified when there is none) → current password → temporary password → suspension.
A failure is recorded in `auth_attempt` in the same transaction that decides it; a throw would
roll the record back, so failures are returned as outcomes, as 003's claim did.

## `POST /v1/auth/choose-password`

Not authenticated. It finishes a first sign-in or a reset (US2, US4).

```text
Request:  { email, temporaryPassword, newPassword, deviceName }
200:      { outcome: 'signedIn', deviceId, credential, account, serverId, apiVersion, minAppVersion, accountId }
400:      { error: 'InvalidPassword', problem } | InvalidEmail | InvalidDeviceName | BadRequest
401:      { error: 'InvalidCredentials' | 'TemporaryPasswordExpired' }
403:      { error: 'AccountSuspended' }
429:      { error: 'TooManyAttempts' }
```

The temporary password is verified again. In one transaction: the password hash is set, the
temporary password is cleared, and the device is created. The new password must satisfy
`validateNewPassword(newPassword, { temporary: temporaryPassword })`; it may equal the account's
previous password (research R3). If the temporary password was replaced, used on another device,
or has expired since the sign-in, the answer is `401 InvalidCredentials` or
`401 TemporaryPasswordExpired` and nothing is stored (research R4).

## `POST /v1/auth/password-reset`

Not authenticated. It asks for a new temporary password (US4).

```text
Request:  { email }
202:      { }                                        // always, known address or not (FR-010)
400:      { error: 'InvalidEmail' | 'BadRequest' }   // a malformed address is a client mistake, not a probe
429:      { error: 'TooManyAttempts' }               // 3 / hour per address, 10 / hour per client (research R6)
```

For an existing, non-suspended account: a new temporary password is stored (7 days), the email is
sent **after** the response (research R4), and the current password is not touched. For an invited
account the new temporary password replaces the one from the invitation. For an unknown or
suspended address nothing is stored and no email is sent. The 202 is identical in every case, and a
failure to send cannot change it.

## `GET /v1/account`

Authenticated. `200 { account: AccountInfo }` (research R9).

## `POST /v1/account/password`

Authenticated. It changes the caller's password (US6-2).

```text
Request:  { currentPassword, newPassword }
204
400:      { error: 'InvalidPassword', problem }      // including SameAsCurrent
401:      { error: 'InvalidCredentials' }            // wrong current password; counted under the account's sign-in limit
429:      { error: 'TooManyAttempts' }
```

The new password must satisfy `validateNewPassword(newPassword, { current: currentPassword })`.
The current password is verified first, so `SameAsCurrent` is only ever told to someone who typed
it right. The other devices stay signed in (research R9). An outstanding temporary password is
cleared.

## `DELETE /v1/account`

Authenticated. It deletes the caller's own account (US6-6, FR-016).

```text
Request:  { password }
204
401:      { error: 'InvalidCredentials' }            429: { error: 'TooManyAttempts' }
409:      { error: 'LastAdministrator' }
```

In one transaction: each device's credential hash goes to `ended_credential`, the `auth_attempt`
rows keyed by the account's address are deleted, then the account is deleted and the cascade
removes everything else (research R7, R16, data-model). The administrator's `DELETE` does the same.

## Administration (`/v1/admin/*`, administrators only)

```text
GET    /v1/admin/accounts                      -> 200 { accounts: AccountSummary[] }           // setup account excluded until completed
POST   /v1/admin/accounts   { email }          -> 201 { account: AccountSummary }
                                                  400 InvalidEmail | 409 AccountExists | 502 MailFailed
POST   /v1/admin/accounts/:id/suspend          -> 204 | 404 NotFound | 409 LastAdministrator
POST   /v1/admin/accounts/:id/reactivate       -> 204 | 404 NotFound
POST   /v1/admin/accounts/:id/resend-credentials -> 204 | 404 NotFound | 409 NotInvited | 502 MailFailed
DELETE /v1/admin/accounts/:id                  -> 204 | 404 NotFound | 409 LastAdministrator
```

- `POST /v1/admin/accounts` follows the order of research R8: create, send, and on failure delete
  again and answer `502 MailFailed` with nothing left behind (US1-4).
- `resend-credentials` replaces the temporary password and sends the email; if the send fails the
  account keeps the new temporary password and the answer is `502 MailFailed`, so the
  administrator tries again.
- `suspend` on an already suspended account and `reactivate` on an account that is not suspended
  are `204` no-ops (idempotent).
- An administrator acting on their own account hits `LastAdministrator` when no other active
  administrator exists (US5-5).
- `AccountSummary.invitationExpired` is true for an invited account whose temporary password has
  expired (research R12).
- `resend-credentials` on a suspended account that never signed in is `409 NotInvited`.
- No administration route returns another account's lists, articles, categories or devices.

## The email (not HTTP)

Plain text, French, sent by the mail adapter (research R8). Two kinds:

| Kind | Subject | Body (in French) contains |
|---|---|---|
| `invitation` | "Votre accès à Mes courses" | the server address; the sign-in name (the address); the temporary password; that it is valid 7 days and must be replaced at the first sign-in |
| `newTemporaryPassword` | "Votre nouveau mot de passe temporaire" | the temporary password and its 7-day validity; that your current password still works until you use it; that you can ignore the message if you did not ask |

The exact wording is in [ui-screens.md](ui-screens.md#emails).

## Command line on the Pi (not HTTP)

```sh
yarn workspace @mes-courses/server create-admin you@example.org   # asks for the password twice, no echo
```

It completes the setup account (research R2): it stores the normalized address and the password
hash. It exits with an error, changing nothing, if the address is invalid, the password breaks the
rules, the two entries differ, or the setup account already has an address. Output is English
technical text (it is a maintainer tool, as 003's `pairing-code` was, minus the French message).

```sh
yarn workspace @mes-courses/server set-password you@example.org   # asks for the new password twice, no echo
```

It sets the password of an existing account and clears its temporary password; state, role and
devices are untouched (research R17). It exits with an error, changing nothing, if the address has
no account, names the setup account, the password breaks the rules, or the two entries differ. It
shares the prompt and the checks with `create-admin`.

## Tests that pin this contract

- Server, with Fastify `inject`: every route, status and error code above, including:
  - the same `401` body and a comparable shape for an unknown address and a wrong password;
  - the sixth failed sign-in in 10 minutes, and the fourth reset in an hour, each with
    `Retry-After`;
  - a limit hit before the password is checked (a correct password is still refused);
  - the current password working after a reset, and the temporary one working once only;
  - an expired temporary password, answered `TemporaryPasswordExpired` only to the person who
    typed it;
  - a suspended account (`403`), a deleted one (`401 AccountDeleted`) and a revoked device;
  - an ordinary user on every `/v1/admin/*` route (`403`, nothing read);
  - the last administrator on suspend and on both deletes;
  - a changed password equal to the current one (`SameAsCurrent`), and an accented password
    typed in NFD that verifies against its NFC hash;
  - `choose-password` after the temporary password was replaced by a reset or used on another
    device (`InvalidCredentials`);
  - a reset on an invited account (the invitation's temporary password stops working) and on a
    suspended one (`202`, nothing stored, nothing sent);
  - `auth_attempt` rows older than 60 minutes gone after the next auth request, and the rows of a
    deleted account's address gone with it;
  - another account's row id in a sync change (ignored) and its device id in a device route
    (`404`);
  - two accounts with the same ids: no read, write or deletion crosses (SC-003);
  - after a deletion, no row remains in any table for the account (SC-007);
  - a log sink that never contains an address or a password (SC-008).
- App: the `SyncServer` and `AccountServer` HTTP adapters run against a real in-process server on
  a random local port with an in-memory database, from `tests/sync/`, never the production server.
- The mail adapter runs against a real SMTP server in the test process, never a real provider.
