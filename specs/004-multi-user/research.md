# Research: Multi-User Accounts

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-12

This feature extends [003](../003-server-sync/research.md): the server and the app already exist,
with a single implicit owner and device pairing codes. Each entry gives the decision, why it was
made, and what else was considered. The spec left these to the plan: the mail service (Assumptions),
the password and rate-limit values (Assumptions), and the French wording (the app's
[ui-screens.md](contracts/ui-screens.md)). The rest follows from the spec's requirements. R16 to
R18 come from the security review ([checklists/security.md](checklists/security.md)), and R18
maps each of its items to the decision that answers it.

## R1. Several accounts in one database (FR-001, FR-009, SC-003, SC-007)

- **Decision**: one SQLite file, as today. A new `account` table is the root; every data table
  (`category`, `article`, `shopping_list`, `list_item`, `applied_change`) and `device` gain an
  `account_id` column that references it with `ON DELETE CASCADE`.
  - Primary keys and unique indexes become per account: `(account_id, id)`, and
    `(account_id, normalized_name)` for live rows. Foreign keys between data tables become
    composite (`(account_id, category_id)` → `category(account_id, id)`), so a row can never
    point at another account's row, whatever a client sends.
  - The repositories are **bound to an account** when a transaction opens:
    `store.runForAccount(accountId, work)` hands `work` repositories whose every statement carries
    `WHERE account_id = ?` and whose inserts set it. Use cases and the domain never see an
    `account_id` and cannot forget it. Operations that are not about one account's data (sign-in,
    invitation, administration) use `store.run(work)`, which has only the directory repositories
    (accounts, devices, ended credentials, attempts); the type system keeps the two apart.
  - `meta.seq` stays one global counter. A device only receives rows of its account, so the gaps
    it sees in `seq` reveal how many changes other accounts made, nothing more. A per-account
    counter would rewrite the pull logic for no benefit at about 10 users. This activity count is
    the one thing a device learns about other accounts, and it is accepted. No row, id, name or
    position of another account is ever sent.
  - **Every identifier a client can send is read inside its own account**: list, item, article,
    category, change and device ids. An id that exists only in another account is, for the caller,
    an id that does not exist. A sync change that refers to it is an unknown entity, acknowledged
    and ignored as 003's sync contract says. A change that creates a row with that id creates a
    separate row in the caller's account. A device route answers `404 NotFound`. Account ids are
    taken only by the administration routes (R12).
  - Deleting an account is one `DELETE FROM account`. The cascade removes its data, its
    devices and its applied changes in that transaction, which is what makes SC-007 testable
    (`SELECT COUNT(*)` on every table filtered by the id, expecting 0).
- **Rationale**: isolation is enforced twice, by construction in the repositories and by the
  schema's composite keys, and each layer has its own test. Reusing the existing tables and the
  existing sync use case keeps 003's merge and pull logic untouched: it runs per account because
  it only ever sees one account's rows. The migration is a single atomic transaction.
- **Alternatives considered**:
  - **One database file per account.** The strongest isolation and the simplest deletion, but
    devices must then live in a separate directory database to authenticate before the right
    file is known, a migration must split one file into two atomically (it cannot), and each
    request opens or caches a connection. More moving parts for a guarantee the cascade and
    composite keys already give.
  - **Row-level filtering in every use case** (pass `accountId` to each repository call): one
    forgotten argument is a data leak, and the compiler cannot see it.
  - **A `WHERE` added in the HTTP layer only**: the layer that must not know the data model.

## R2. The maintainer's account is created by migration, completed by a command (FR-015)

- **Decision**: server migration 2 creates the `account` table, inserts one account with a random
  id, the role `administrator` and **no email and no password** (the *setup account*), attaches
  every existing row of every table and every existing device to it, and drops the pairing tables.
  The same migration runs on a fresh database, so there is a single path.
  - `yarn workspace @mes-courses/server create-admin <email>` completes it: it asks for the
    password twice on the terminal (no echo), checks the rules of FR-005, and stores the email and
    the password hash. It refuses to run once the setup account has an email.
  - Until then the server runs, and the maintainer's existing devices keep syncing with their
    credentials (SC-005). Nobody can sign in, because the setup account has no password. The
    `create-admin` command is the only way to give it one, as FR-015 asks ("provided at setup").
- **Rationale**: a migration has no access to a secret or an address, and must be atomic and
  repeatable. Splitting "attach the data" (automatic, atomic) from "name the owner" (a command
  that needs input) keeps both simple and testable. A password given on the command line or in the
  environment would land in the shell history or the process list.
- **Alternatives considered**: the address and a password hash in the environment, read by the
  migration (a secret in a file, and the migration then depends on configuration); a first-run web
  page (a public, unauthenticated way to claim the server, which is a worse risk than the command);
  attaching the data on the first sign-in (the data would belong to nobody in the meantime).

## R3. Passwords are hashed with scrypt (FR-004, FR-005, FR-006)

- **Decision**: `node:crypto` `scrypt`, no new dependency. Stored as
  `scrypt$N$r$p$salt$hash` (base64url), with a 16-byte random salt, `N = 2^15`, `r = 8`, `p = 3`
  (the OWASP minimum for scrypt), compared with `timingSafeEqual`. The parameters live in the stored
  string, so they can be raised later and old hashes still verify. Tests use `N = 2^4` through an
  injected `PasswordHasher` port; one adapter test uses the real parameters.
  - A password is 12 to 128 characters (the upper bound stops an enormous input from costing
    CPU), compared as given: no trimming and no case folding. Spaces, punctuation and any Unicode
    character are allowed. The password is normalized to Unicode NFC before it is counted, hashed
    or verified, so the same accented letter typed on iOS and on Android gives the same hash;
    characters are counted as code points after NFC, not UTF-16 units. The JSON schemas of the
    routes cap every password field at 512 UTF-16 units (`400 BadRequest` beyond), so a huge body
    never reaches the hasher; between 129 code points and that cap, a new password is `TooLong`
    and a sign-in is simply `InvalidCredentials`.
  - A changed password (US6-2) must also differ from the current one (`SameAsCurrent`). Both
    values are in the request, so this is a string comparison after NFC, on the app and on the
    server. A password chosen after a reset may equal the old one: the user who asked for the
    reset does not remember it, and refusing it would tell a stranger holding the temporary
    password what the old one was.
  - Sign-in for an address with no account runs a verification against a fixed dummy hash, so a
    missing account and a wrong password take about the same time (FR-006).
  - Hashing runs on libuv's thread pool (`crypto.scrypt` is asynchronous), so a sign-in does not
    stop the sync requests of other users.
- **Rationale**: scrypt is memory-hard, built in, and the Pi can afford about 100 to 200 ms and
  32 MB for a sign-in that happens once per device. Credentials of devices (R5) are long random
  secrets and keep SHA-256, which is right for them: a slow hash protects only low-entropy secrets.
- **Alternatives considered**: argon2 (the better algorithm, but a native dependency to build on
  arm64 for one operation); bcrypt (72-byte truncation, a dependency); PBKDF2 (weak against GPUs);
  SHA-256 (unacceptable for passwords).

## R4. Temporary passwords and the "forgot my password" flow (FR-004, FR-010, clarification B)

- **Decision**:
  - A temporary password is 16 characters from the unambiguous alphabet of 003's pairing codes
    (31 symbols, about 79 bits), shown as `XXXX-XXXX-XXXX-XXXX`. It is accepted in any case, with
    or without dashes or spaces. It is stored hashed with the same scrypt (`temporary_password_hash`)
    next to its expiry (`temporary_expires_at`, now + 7 days). An account has at most one.
  - An invited account has only a temporary password. For an active account, a reset adds a new
    temporary password and **leaves the current one working** (spec clarification). The old
    temporary password, if any, is overwritten.
  - **Sign-in** checks the current password first, then the temporary one:
    - the current password matches → signed in;
    - the temporary one matches and has not expired → `PasswordChangeRequired`, no device is
      created yet;
    - the temporary one matches but has expired → `TemporaryPasswordExpired` (US2-5). This code
      is returned **only to someone who typed the expired temporary password**, so it reveals
      nothing to a stranger (FR-006);
    - otherwise → `InvalidCredentials`, the same for an unknown address and a wrong password.
  - **Choosing the password** is `POST /v1/auth/choose-password` with the address, the temporary
    password again, the new password and the device name. The server verifies again, then in one
    transaction sets the password hash, clears the temporary one, and creates the device. This is
    stateless: no ticket table, and the app keeps the temporary password in memory only for the
    length of the screen. The new password must differ from the temporary one (FR-005).
  - **Forgotten password** is `POST /v1/auth/password-reset` with an address. The answer is always
    the same `202`, whether the account exists or not. For an existing, non-suspended account the
    server stores the new temporary password and sends the email **after** answering, without the
    request waiting for the mail service, so the response time does not reveal whether the account
    exists. A failure to send is reported (R8) but cannot change the answer. A suspended account
    gets no email, and the answer is the same `202`.
  - **A reset on an invited account** (never signed in, no current password) replaces its
    temporary password, so the one from the invitation stops working, exactly like "send the
    credentials again". This is the only case where a reset invalidates something, and there is
    nothing else to lock out.
  - **"Send the credentials again" and a reset are not the same thing**, though both store a new
    temporary password:

    | | Send the credentials again (US5-6) | Reset (US4) |
    |---|---|---|
    | Who | an administrator, authenticated | anyone, not authenticated |
    | For | an invited account only (`409 NotInvited` otherwise, a suspended one included) | any account that is not suspended |
    | Email | the invitation, with the server address | the new temporary password, without the server address |
    | Mail failure | `502 MailFailed` to the administrator; the previous temporary password and its expiry are restored, as `inviteAccount` removes the account (R8) | reported to the tracking tool; the answer stays `202` (it must not reveal the account) |
    | Limits | none (the administrator is trusted) | R6 |

    The resend exists because an invited person may have lost the email that held the server
    address, which a reset does not send.
  - **A temporary password that changes while ChoosePassword is open** (a reset or a resend from
    elsewhere, its use on another device, or its expiry): `choose-password` verifies it again, so
    the request fails with `InvalidCredentials` or `TemporaryPasswordExpired` and nothing is
    stored. The screen says the temporary password is no longer valid and sends the user back to
    SignIn ([ui-screens.md](contracts/ui-screens.md#choosepassword-new-screen)).
  - **Accepted risk: a password in clear in an email.** The temporary password crosses the mail
    provider, the recipient's mailbox and its backups in readable form. Whoever reads it before the
    owner can take the account: for an invited account that is an empty account; for a reset it
    replaces the owner's password. Mitigations: it is random (about 79 bits), single-use, valid 7
    days at most, useless once a password is chosen from it, and the owner's own password keeps
    working meanwhile; the owner's devices stay signed in, and the device list shows any device
    the intruder added, which the owner can revoke. Taking over a mailbox gives the account, as it
    does with every email-based recovery; the spec chose this (FR-003), and a reset link would
    carry the same risk.
- **Rationale**: keeping the current password valid means a stranger who knows an invited address
  cannot lock its owner out by asking for resets, and the rate limit (R6) still stops mailbox
  flooding. No ticket keeps the schema and the attack surface small.
- **Alternatives considered**: a single-use reset link by email (needs a web page and deep links
  for an app with neither, and the spec chose a temporary password); invalidating the current password
  at once (rejected in the clarification); a ticket table between the two steps (more state for the
  same guarantee).

## R5. Sign-in creates a device; the device credential is unchanged (FR-007, FR-008, 003 R11)

- **Decision**: a successful sign-in (or `choose-password`) creates a `device` row for the account
  and returns a new random 256-bit credential, exactly as 003's pairing claim did. The server keeps
  the SHA-256, every other request sends `Authorization: Bearer`, and the app keeps the credential
  in secure storage. The credential identifies a device, and the device identifies its account:
  the authentication hook resolves the credential to `(device, account)` and passes the account id
  to `store.runForAccount`.
  - The check order on every authenticated request is: credential unknown → `401
    DeviceNotAuthorized` or `401 AccountDeleted` (R7); device revoked → `401 DeviceNotAuthorized`;
    account suspended → `403 AccountSuspended`; then the route. Nothing is read before it passes.
  - Pairing codes, `POST /v1/pairing/claim`, `POST /v1/pairing-codes` and the `pairing-code`
    command are removed. `minAppVersion` is raised to this feature's app version, so an app that
    still shows pairing gets `426 UpdateRequired` and the app's existing message.
  - The devices already paired belong to the setup account (R2) and keep their credentials. The
    app learns its account id from the `accountId` field every response now carries (R9).
  - **A device credential never expires** and has no inactivity timeout. It ends only when the
    device signs out, is revoked, or its account is deleted; a suspension pauses it. An offline
    device can stay unreachable for months and must still open its lists (Principle VII), and
    revocation from another device is the way to end a lost or stolen one. The time between a
    suspension, deletion or revocation and its effect on an offline device is therefore
    **unbounded**: it is applied at the device's next request, and the data already on the device
    stays there until then (SC-004 is measured on requests: every request made after the change
    is refused, which T058 tests).
  - **Every route that carries a password goes over verified TLS.** The server listens on
    `127.0.0.1` only; the one way in from outside is Caddy with its Let's Encrypt certificate (003
    R4). The app's release build accepts only `https://` server addresses and the platform's
    certificate check (`UntrustedServer` otherwise, 003 FR-019); only a development build accepts
    `http://`, as in 003. Caddy redirects `http://` to `https://`, but the app never sends a
    password to an `http://` address in the first place.
- **Rationale**: the device credential model of 003 (hashed, revocable, per device) is exactly
  what the spec keeps ("the other device rules of 003"). Only the way a credential is obtained
  changes, from a code to a password.
- **Alternatives considered**: JWT or session cookies (revocation and suspension need a lookup
  anyway, and a signed token adds key management); keeping pairing codes beside sign-in (the spec
  replaces them).

## R6. Limiting attempts and requests (FR-006, FR-010)

- **Decision**: one table, `auth_attempt(kind, key_hash, at)`, replaces `pairing_failure`.
  Keys are SHA-256 hashes, so an address typed for a non-existent account leaves no readable
  trace, and unknown addresses are limited exactly like known ones.

  | Kind | Counted | Key | Limit in a rolling window |
  |---|---|---|---|
  | `signIn` | each failure (wrong password, unknown address, wrong temporary password) | normalized email | 5 in 10 minutes |
  | `signIn` | each failure | client address | 20 in 10 minutes |
  | `passwordReset` | each request, known address or not | normalized email | 3 in 60 minutes |
  | `passwordReset` | each request | client address | 10 in 60 minutes |

  Beyond a limit the server answers `429 TooManyAttempts` with `Retry-After`, before checking any
  password (so the answer does not depend on whether the password was right). Changing the password
  and deleting the account, both authenticated, count their failures under the same `signIn` limit
  for the account's key. A success does not erase the count. Because counts live in the database,
  a restart does not reset them.
  - **"A device" in FR-006 is the client's network address.** A device has no identity before it
    signs in, and anything it could send to identify itself (a header, an install id) is chosen by
    the client and costs nothing to change. The network address is the one thing a guesser cannot
    pick freely. Phones behind a carrier's shared address share a count; at about 10 users and 20
    failures per 10 minutes, a legitimate user will not hit it.
  - **The lock lasts until the oldest counted failure leaves its window**: at most 10 minutes for
    sign-in, at most 60 for reset. `Retry-After` gives the exact seconds.
  - **Rows older than the longest window (60 minutes) are deleted** at server start and at the
    start of every request that reads or writes attempts, so a quiet server keeps none for long.
    Deleting an account also deletes the rows keyed by its address, in the same transaction (R16).
  - The client address is the first value Caddy puts in `X-Forwarded-For`. Fastify is created with
    `trustProxy` set to the loopback address only, because the server listens on `127.0.0.1` behind
    Caddy (003 R4); a request that reaches the server any other way never has a forwarded address
    that is trusted.
- **Rationale**: a per-address limit makes guessing a password hopeless (5 tries per 10 minutes
  against a 12-character minimum). A per-client-address limit stops one machine from trying many
  addresses. The cost is that someone can block an address for 10 minutes by failing five times,
  which the spec accepts ("slowed down or refused for a while"), and the owner's other devices,
  already signed in, are unaffected.
- **Alternatives considered**: progressive delays (state to hold per request, and harder to test
  deterministically); CAPTCHAs (no web page to put one on); a global limit as in 003's pairing
  (one user's mistakes would block everyone now).

## R7. Telling a device why it is signed out (FR-014, FR-017, US5, US6)

- **Decision**: three distinct answers, each with a code the app turns into a French message:
  - `401 DeviceNotAuthorized`: the device was revoked (by its owner, or by itself);
  - `401 AccountDeleted`: the device's account no longer exists;
  - `403 AccountSuspended`: the account is suspended; nothing is lost, and the device is allowed
    again as soon as the account is reactivated, with no new sign-in.

  Deleting an account removes its devices (FR-016), so that the server can still say
  `AccountDeleted` later, it first copies each device's credential hash into
  `ended_credential(credential_hash, reason, ended_at)`, with `reason = 'accountDeleted'`. That row
  holds no data of the account (a hash that matches nothing any more). It is kept forever: it is
  tiny, and a device may stay offline for months.
- **Rationale**: without it, a deleted account and a revoked device look the same, and the app
  could not say why (US6-5). SC-007 asks that no data of the account remains; a hash of a credential
  that no longer exists is not data of the account, and the test for SC-007 states that the
  `ended_credential` table is the only table that may keep a row after the account is deleted.
- **Alternatives considered**: one `401` for both (a vague message, against FR-017); keeping the
  device rows with a deleted flag (it keeps the device name, which is personal data).

## R8. Sending email (FR-003, FR-020, the Assumptions' mail service)

- **Decision**: an application port, `Mailer`, with one operation, `send(message)`, where the
  message is typed (`{ kind: 'invitation' | 'newTemporaryPassword', to, temporaryPassword, expiresAt, serverUrl }`)
  and carries no text. The adapter `adapters/mail/` renders the French subject and body and sends
  by **SMTP submission** through `nodemailer`, configured by two environment variables:
  `MES_COURSES_SMTP_URL` (for example `smtp://user:password@smtp.example.org:587`, STARTTLS
  required: the adapter refuses a plain connection) and `MES_COURSES_MAIL_FROM`. The public
  address of the server (`MES_COURSES_PUBLIC_URL`, the same domain Caddy serves) goes in the email,
  because the invited person needs it to sign in (US2).
  - The maintainer chooses the provider: any provider with an SMTP relay works, including the free
    tiers of transactional services, or the maintainer's own mailbox. A residential address is
    not used to send directly: such mail is routinely rejected as spam.
  - Every email is plain text, in French, and says that the temporary password expires in 7 days.
    The reset email also says the current password still works until the temporary one is used.
  - **Failures**: the adapter throws a `MailFailed` error whose message is fixed. It carries
    nothing from the mail library's own message, which can contain the recipient. The error is
    reported to the tracking tool (R10) without the address (FR-018, SC-008).
  - **Invitation order**: (1) a transaction creates the account with its temporary password;
    (2) the email is sent, outside any transaction, so a slow mail service never holds the
    database; (3) on a failure, a second transaction deletes the account and the administrator
    gets `MailFailed` (FR-003). If the server stops between (1) and (2), the account stays as
    "invited" with no email, and the administrator uses "send the credentials again" (US5-6).
  - **Development**: with `MES_COURSES_SMTP_URL` empty and `NODE_ENV` not `production`, the
    composition uses a `ConsoleMailer` that prints each message, temporary password included, to the
    server's own output, so the flow can be tried with no relay. In production an empty variable
    is not accepted: every send fails with `MailFailed`, and the server logs a warning at startup.
  - **The relay is trusted with addresses and temporary passwords.** Every email hands the
    recipient's address and, in its body, a temporary password to the provider the maintainer
    chose, which keeps them in its own logs under its own retention. STARTTLS protects the hop from
    the Pi to the relay, not what happens after. The maintainer accepts this when choosing the
    relay; the README says so next to the variables, and recommends a provider whose logs and
    retention they are comfortable with.
  - Mail sending has a test double (`FakeMailer`, which records messages and can be told to
    fail); no test sends an email. The adapter is tested against a real SMTP server run in the
    test process (`smtp-server`, a development dependency).
- **Rationale**: SMTP with STARTTLS and authentication is not worth writing by hand, and
  `nodemailer` is the standard, dependency-free library for it. A provider's HTTP API would tie
  the project to one provider; SMTP leaves the choice to the maintainer.
- **Alternatives considered**: a provider's HTTP API through `fetch` (no dependency, but one
  provider's lock-in and one more secret format); running a mail server on the Pi (deliverability);
  sending the credentials through the maintainer by hand (against the spec).

## R9. What the app needs from the server beyond sync (FR-011, FR-016, FR-017)

- **Decision**:
  - Every response gains `accountId`, an opaque random id, next to `serverId`. The app stores it in
    `sync_state` (R11) the first time it sees one. A device paired before this feature learns it
    from its next sync.
  - `GET /v1/account` returns `{ id, email, role }` for Settings (US6-1) and for deciding whether
    to offer the account management entry. The app does not cache the role for authorization;
    the server decides on every call.
  - Changing the password (`POST /v1/account/password`) and deleting the account
    (`DELETE /v1/account`) take the password in the body. Changing it keeps the other devices
    signed in (US6-2), and that is the right choice against a stolen device: a device holds a
    credential, not the password, so changing the password would not stop a thief holding a
    signed-in phone. Revoking that device does (US6-3), from any other device of the account. A
    password change protects against someone who knows the password; if that person already
    signed in somewhere, their device is in the owner's device list, to be revoked as well. The
    Settings dialog does not explain this; the device list is right under it.
- **Rationale**: the app has no other way to know whose copy it holds, and an opaque id is safe to
  keep and to send in error reports (it is pseudonymous: it is random, not derived from the
  address).

## R10. Observability (FR-018, FR-020, SC-008)

- **Decision**:
  - The error reports of the server and of the app may carry the `accountId` as the user
    identifier. **Personal data that never goes in a report or a log line** (FR-018, SC-008), the
    list the log test checks: an email address or any part of one (its domain included), a
    password, a temporary password, a device credential, a device name, the server's address, the
    SMTP URL (it holds the relay's password), and a client's network address. The Sentry SDKs keep
    their personal-data collection off (the server's `dataCollection`, the app's
    `sendDefaultPii: false`), which also keeps the native layers from attaching the phone's own name
    or the network address; the `mes-courses-server` and `mes-courses-app` projects have
    "Prevent storing of IP addresses" turned on. A **scrubber** in each `ErrorReporter` adapter removes anything that looks like an
    email address from messages and breadcrumbs before sending, as a second line after not putting
    one there.
  - Fastify's request logging logs the method, path and status, never the body or headers.
    Auth routes have no secret in the path. A test signs in, resets, invites and deletes an account
    against a log sink and asserts that no email address and no password appears in it (SC-008).
  - The new failures reported: a mail failure (fixed message, no address), an unexpected error in
    any new route. Not reported: wrong passwords, expired temporary passwords, limits hit, a
    suspended or deleted account (these are normal outcomes).
  - **What SC-008 covers**: everything this project emits: the server's log (journald), the
    error reports of the server and of the app, and the app's console in a release build. Caddy
    keeps no access log (the Caddyfile has no `log` directive), and the project has no analytics.
    The mail provider's logs are outside it: they hold addresses by nature (R8).
  - The administration routes put an account id in the path
    (`/v1/admin/accounts/:id/suspend`), so the request log holds account ids. They are opaque and
    random, and match nothing once the account is deleted.
- **Rationale**: SC-008 is a promise about every log and report, so it is tested as one.

## R11. The app: sign-in replaces pairing, and a device holds one account at a time (FR-007, FR-008, FR-011, FR-017)

- **Decision**:
  - `connectToServer` (address + code) becomes `signIn` (address + email + password).
    `createPairingCode` and its dialog are removed. `disconnect` becomes `signOut`.
  - `sync_state` (app migration 3) gains `account_id TEXT`, the account whose data the replica
    holds. It is `NULL` before any sign-in.
  - **Local copy rule**, applied by `signIn` and `chooseInitialPassword` after the server accepts
    the credentials, before anything is stored:
    - `account_id` equals the signing-in account → keep the copy (the same person returns);
    - `account_id` is `NULL` and the device was **never connected** (`server_url` is `NULL`) → the
      copy is anonymous local data, created before any account existed. It is kept and adopted by
      the account through 003's first-sync snapshot (003 R13), exactly as the maintainer's phone did
      when it first paired;
    - anything else (another account, or a copy of a connection whose account is not known) → the
      copy is erased first (`LocalDataEraser`), then the device is signed in. Two accounts are
      never mixed (FR-017).
  - **Signing out** (voluntary) warns first if changes are pending (the count comes from
    `getSyncInfo`), then revokes the device on the server (best effort: offline, it is only
    cleared locally and the server keeps an unused device that the owner can revoke), clears the
    credential, **erases** the replica and the sync state, and shows the sign-in screen.
  - **Forced sign-out** (revoked, account deleted): the sync slice goes to a state that shows the
    reason in French; when the user dismisses it, the same erasure runs. Until then the data is
    still on screen behind the message, so a reader can finish what they were looking at, as FR-017
    says ("once the message was seen"). When changes are still waiting to be sent, the message says
    how many will be lost: the device can no longer send them, so this is information, not a
    choice. A suspended device that learns of a deletion or a revocation goes to the same state:
    "suspension then deletion" (US6-5) is a deletion.
  - **Suspended**: a new connection state `suspended`. The replica is kept and usable, edits are
    queued, the sync bar shows the French message, and the scheduler retries on its slow backoff
    until the account is reactivated.
  - **Erasing** deletes every row of the data tables, the outbox and the sync state, then runs the
    seed of 001 R18 again, so the device is back to a first launch: usable locally with the default
    list and categories. Those seed rows are anonymous local data (above) and are adopted by the
    next account that signs in; the same-name merge (003 R8) makes this safe on a server that
    already has them.
  - The sign-in screen is shown after a sign-out or a deletion as a full-screen route (as
    `ConnectServer` was). Its back button leads to the app in local-only mode, as before: the app
    never required an account to be usable offline (Principle VII).
- **Rationale**: this keeps 003's offline-first behavior and its snapshot mechanism intact, and
  puts the isolation rule in one place (the local copy rule), tested with the cases above.
- **Alternatives considered**: forcing sign-in at launch (breaks a first launch in a shop with no
  network, against Principle VII); keeping each account's copy on a device in separate databases
  (the spec forbids holding two accounts' data at once); never adopting anonymous data (a
  maintainer's phone that predates sync would lose its lists on first sign-in).

## R12. Roles and the administrator (FR-013, FR-016)

- **Decision**: `role` is `user` or `administrator`, stored on the account, and checked by a
  `requireAdministrator` step in the authentication hook of the `/v1/admin/*` routes. Rules in the
  server's domain, each with tests:
  - an administrator cannot be suspended or deleted if no **other** active administrator exists
    (`409 LastAdministrator`); with the single administrator the spec assumes, this is "not
    yourself", and it stays correct if a second one is added by a later feature;
  - an administrator cannot invite an address that has an account (`409 AccountExists`);
  - sending the credentials again is allowed only for an account that never signed in
    (`409 NotInvited` otherwise: an active user uses the reset flow);
  - an ordinary user's calls to `/v1/admin/*` get `403 Forbidden`, before any read (US1-5).
  The app shows the management entry only when `GET /v1/account` says `administrator`; the server
  never trusts that.
  - **What an administrator sees of another account**: its email, role, state, whether its
    invitation expired, and its last sync. Never its lists, articles, categories or devices: no
    route returns them, because the data repositories are only reachable through
    `runForAccount` with the caller's own account (R1). Every device list, including the one in
    the administrator's own Settings, is the caller's own devices.
  - **Accounts that never signed in**: suspending one makes it `suspended` (its temporary password
    then gives `AccountSuspended`, and a reset sends nothing); reactivating it returns it to
    `invited`, with its temporary password still subject to its 7-day expiry; deleting it is a
    deletion like any other; "send the credentials again" is refused while it is suspended
    (`409 NotInvited`, and the app does not offer it).
  - **An expired invitation is shown, not notified**: `AccountSummary` carries
    `invitationExpired`, true for an invited account whose temporary password expired, and the
    Accounts screen shows "Invitation expirée" with "Renvoyer les identifiants". There is no email
    or push to the administrator.
  - **No record of administrator actions** (who suspended or deleted whom). R14 lists it as not
    built: there is one administrator, who is also the person with a shell on the Pi.
  - **The last-administrator rule applies to every path that can remove one**: suspending or
    deleting through `/v1/admin/*` (one's own account or another administrator's) and deleting
    one's own account through `DELETE /v1/account`. There is no self-suspension.
  - **A mistyped invitation** sends a temporary password to a stranger, who gets an empty account
    on the Pi and nothing else (R1). The success snackbar and the Accounts list both show the
    address, and deleting the account undoes it. A confirmation step was not added: SC-002 asks
    for speed, and the cost of the mistake is one empty account.

## R13. Email addresses (FR-001)

- **Decision**: an address is trimmed and lower-cased (Unicode `toLowerCase`) before any
  comparison or storage. It is valid if it is at most 254 characters and matches
  `^[^\s@]+@[^\s@]+\.[^\s@]+$`: one `@`, a dot in the domain, no space. No attempt is made to
  implement the full RFC 5322 grammar; the invitation email itself is the verification (the
  Assumptions say there is none beyond that). The rule is one pure function, `normalizeEmail`, in
  `sync-core`, so the app's form and the server agree to the character.
- **Alternatives considered**: a validation library (a dependency for one regular expression); the
  RFC grammar (rejects nothing real addresses need and accepts what mail servers refuse anyway).

## R14. Sizing and what is not built (Principle IV)

- **Decision**: no queue for emails (R4's detached send is one promise), no background job for
  expired temporary passwords (expiry is checked when one is used), no session table, no
  audit log, no email change, no second administrator, no per-account export, no limit on the
  number of accounts. Each is out of scope in the spec or has no requirement behind it. The one
  addition from the security review is the `set-password` command (R17), which reuses
  `create-admin`'s code.
- **New dependencies**: `nodemailer` (server, R8) and `smtp-server` (server, development only,
  adapter test). Nothing new in the app: its secure storage, HTTP and navigation are unchanged.

## R15. Deployment (the maintainer's one-time steps)

- **Decision**: upgrade the Pi in this order, documented in [quickstart.md](quickstart.md#3-upgrade-the-pi):
  1. copy the database file (`cp`) to a safe place, since migration 2 rebuilds the data tables and
     003 has no backup (FR-018a);
  2. add `MES_COURSES_SMTP_URL`, `MES_COURSES_MAIL_FROM` and `MES_COURSES_PUBLIC_URL` to
     `/etc/mes-courses.env`;
  3. deploy and restart the server (migration 2 runs);
  4. run `create-admin` as `mes-courses`;
  5. update the maintainer's phone and tablet to the new app, which keep syncing without signing
     in again;
  6. once the hands-on checks pass, delete the copy of step 1 (R16), and check that both Sentry
     projects have "Prevent storing of IP addresses" turned on (R10).
- **Rationale**: the order never leaves the maintainer's devices without a working server, and the
  copy in step 1 is the only rollback until it is deleted.

## R16. What is kept, for how long, and who can read it (FR-016, SC-007, FR-018)

- **Decision**:

  | What | Where | Kept | Readable by |
  |---|---|---|---|
  | Email address, role, password hashes, state | `account` | until the account is deleted | the maintainer (database) |
  | Lists, items, articles, categories, applied changes | data tables | until the account is deleted | the account's devices; the maintainer (database) |
  | Devices: name, credential hash, last sync | `device` | until revoked and the account deleted (a revoked device stays listed, as in 003) | the account's devices; the maintainer |
  | Failed sign-ins and reset requests | `auth_attempt`, SHA-256 keys | 60 minutes at most; deleted with the account | the maintainer (hashes only) |
  | Credential hashes of a deleted account's devices | `ended_credential` | forever (R7) | nobody can link them to anyone |
  | Account ids in request paths | journald | journald's own retention on the Pi | the maintainer |
  | Error events with the opaque account id | Sentry | Sentry's retention for the plan | the maintainer |
  | Addresses and temporary passwords in sent mails | the relay's logs | the provider's retention (R8) | the provider |
  | The database copy made before the upgrade | `/var/lib/mes-courses/*.before-004` | until the maintainer deletes it after a successful upgrade (quickstart §3) | the maintainer |

  "All its data on the server are deleted" (FR-016, SC-007) means every row of the first four
  lines that belongs to the account, in one transaction. The other lines are the named remnants:
  none of them holds the address, a password or a row of the account's data, except the relay's
  logs, which are outside the server, and the upgrade copy, which predates every invited account.
- **Rationale**: the checklist asked for the remnants to be named so that SC-007 can be checked;
  the deletion test asserts the first four lines, and this table is the list of what it does not
  cover and why.

## R17. Recovering the administrator without email (FR-013)

- **Decision**: a second command on the Pi, beside `create-admin`:
  `yarn workspace @mes-courses/server set-password <email>`. It asks for a new password twice
  with no echo, checks the rules of FR-005, sets the hash of an existing account, and clears its
  temporary password. It does not touch the account's state, role or devices. It refuses an
  unknown address and the setup account (that is `create-admin`'s job). It shares the prompt and
  the checks with `create-admin`.
- **Rationale**: the only administrator who forgot their password while the relay is down (or
  misconfigured, which is likely right after the upgrade) has no other way back in, and no other
  administrator exists to help. The command gives nothing new to anyone: whoever can run it on
  the Pi can already read and write the database. It also helps an ordinary user whose mail never
  arrives.
- **Alternatives considered**: editing the database by hand with a hash made elsewhere (error-prone,
  and the maintainer would need to reproduce the scrypt format); waiting for the relay (the
  administrator's devices keep working, but nothing in Accounts or Settings that needs the
  password does); a recovery code shown at `create-admin` (one more secret to keep, for the same
  result).

## R18. Answers to the security checklist

[checklists/security.md](checklists/security.md) was run on the spec after this plan was first
written. Its items are reviewer-owned and stay unticked here; this table says where the plan
answers each one, and which ones only the spec can close.

| Item | Answer |
|---|---|
| CHK001 | R6: the client's network address |
| CHK002 | R6: 5 failures in 10 minutes per address, 20 per client; the lock ends when the oldest failure leaves the window |
| CHK003 | R5: the server is reachable only through Caddy's TLS, and a release app sends nothing to `http://` |
| CHK004 | R5: no expiry and no inactivity timeout |
| CHK005 | R3: a changed password must differ from the current one (`SameAsCurrent`); a password chosen after a reset may equal the old one |
| CHK006 | R3: 12 to 128 code points after NFC, any character, no trimming |
| CHK007 | R4: `choose-password` verifies the temporary password again; the screen sends the user back to SignIn |
| CHK008 | R9: kept, and why that is right against a stolen device |
| CHK009, CHK010 | R4: a reset on an invited account replaces its temporary password; the resend/reset table |
| CHK011 | R4: nothing sent, the same `202` |
| CHK012 | R4: the temporary password's expiry never touches the current password |
| CHK013 | R6: 3 per hour per address and 10 per hour per client, both |
| CHK014 | R4: accepted risk and its mitigations |
| CHK015 | R1: every identifier is per account; another account's list, item, article or category id is an unknown entity (acknowledged and ignored, 003 sync contract); another account's device id is `404 NotFound` |
| CHK016 | R1: `seq` gaps reveal how many changes other accounts made, accepted; no row, id, name or position crosses |
| CHK017 | R1: the live-name indexes are per account |
| CHK018, CHK019 | R12: an administrator sees email, role, state, invitation expiry and last sync only |
| CHK020 | R17: `set-password` on the Pi |
| CHK021 | R12: every path that can remove an administrator |
| CHK022 | R12: suspend, reactivate (back to invited), delete, no resend while suspended |
| CHK023 | R12, R14: no audit log, out of scope |
| CHK024 | R12: `invitationExpired` shown in Accounts, no notification |
| CHK025 | R16: what deletion removes and the named remnants |
| CHK026, CHK027 | R7, R11: the three answers, what each device keeps, and the messages |
| CHK028 | **Spec only**: US6-5's "suspension-then-deletion" is a deletion of a suspended account; the plan treats it as `AccountDeleted` (data-model, connection states). The spec's wording should drop the term |
| CHK029, CHK030 | R10: the enumerated list; R9: random, not derived from the address |
| CHK031 | R10: what SC-008 covers and what it does not |
| CHK032 | R16 |
| CHK033 | R8: the relay is trusted with addresses and temporary passwords |
| CHK034, CHK035 | R5: unbounded, applied at the next request; SC-004 measured on requests |
| CHK036 | R4: an anonymous reset cannot report a mail failure, an authenticated invitation must; both are reported to the tracking tool |
| CHK037 | R8: the account stays invited with no email; the administrator resends |
| CHK038 | R11: voluntary sign-out warns; a forced sign-out says how many changes are lost (SignedOutNotice); account deletion discards them (spec edge case); suspension loses nothing |
| CHK039 | No limit is enforced; nothing in the design grows per account beyond its rows. Behavior beyond about 10 accounts is not specified or tested |
| CHK040 | R2: migration 2 creates an administrator on every database, fresh or reset, so one always exists; `create-admin` names it |
| CHK041 | R12: accepted, undone by deleting the account |

**Spec wording the plan cannot fix** (for `/speckit-clarify` or a direct edit of spec.md; no
design depends on them):

- FR-006 says "for a device"; R6 reads it as the client's network address. The spec could say so.
- US6-3 says a revoked device "keeps its local copy until it signs out", while FR-017 and US6-5
  say the data goes once the message was seen. The plan follows FR-017; US6-3 could say "until the
  user has seen the message".
- US6-5's "suspension-then-deletion" (CHK028, above).
- SC-007 says "none of its data remains"; the named remnants of R16 are not its data, but the
  criterion could point to them.
