# ADR-0005: Accounts live in one database, bound per request; passwords use scrypt

- **Status**: Proposed
- **Date**: 2026-10-12
- **Decided by**: proposed by the agent, approved by the maintainer
- **Supersedes**: none
- **Related**: [004 research](../../specs/004-multi-user/research.md) R1, R3, R5, R8; constitution
  Principles VI, VII, VIII and XI; [003 research](../../specs/003-server-sync/research.md) R11

## Context

The server was built for one user with several devices, authorized by pairing codes. The project is
opening to a few invited people (about ten), each with private data. The server runs on one Raspberry
Pi, can only be reached through the maintainer's Freebox, and has no mail system. Three choices will
outlive the feature: where accounts and their data live, how passwords are stored, and how the
server sends email.

## Decision

We keep **one SQLite database**. An `account` table is the root; every data table and the device
table carry an `account_id` with `ON DELETE CASCADE`, part of the primary keys and of the foreign
keys. The server's repositories are **bound to one account** when a transaction opens, so no use case
or domain rule handles an account id, and a statement without the account cannot be written.

We store passwords with **scrypt** from `node:crypto` (parameters in the stored string, so they can
be raised), and device credentials as before: long random secrets, kept as SHA-256.

We send email through a **driven port** implemented with SMTP submission (`nodemailer`), configured
by environment variables, so the maintainer picks the relay.

## Consequences

- Isolation is enforced by construction and again by the schema, and each has a test. Deleting an
  account is one statement, so "nothing remains" is checkable.
- 003's merge and pull logic is reused as is: it only ever sees one account's rows.
- One file still holds every account, so a corrupt file or a bad migration affects everyone. There is
  no backup (003 FR-018a); the upgrade procedure copies the file first.
- A new dependency on the server (`nodemailer`) and on the maintainer's choice and credentials of a
  mail relay. A relay outage blocks invitations and resets, nothing else; a `set-password` command
  on the Pi covers recovery while it lasts.
- The relay is trusted: it sees every invited address and, in the body of each email, a temporary
  password, and keeps them under its own retention.
- Raising the scrypt cost later needs no migration; old hashes verify with their own parameters.

## Alternatives considered

- **One database file per account**: stronger separation, but devices must be found before the right
  file is known, the first migration cannot be atomic across files, and connections multiply.
- **Filtering by account in every use case**: one forgotten argument is a leak the compiler cannot
  see.
- **argon2 or bcrypt**: argon2 is the better algorithm but a native dependency to build on arm64;
  bcrypt truncates input and also needs a dependency.
- **A provider's HTTP mail API through `fetch`**: no dependency, but it ties the project to one
  provider.
- **Sending directly from the Pi**: mail from a residential address is routinely rejected.
