# Sync server

## In development

From the repository root:

```sh
yarn workspace @mes-courses/server dev           # http://127.0.0.1:3000, database in apps/server/.data/
yarn workspace @mes-courses/server create-admin:dev you@example.org  # asks for the password twice
```

`create-admin` (without `:dev`) completes the first account, the one that owns the data already on
the server, with an address and a password. On the Pi, run the built script as the user of the
instance, since only it can read the database (`<env>` is `staging` or `production`; it needs a
terminal for the password):

```sh
sudo -u mes-courses-<env> env MES_COURSES_DB=/var/lib/mes-courses/<env>/mes-courses.db \
  /opt/mes-courses/<env>/current/runtime/bin/node --conditions=production \
  /opt/mes-courses/<env>/current/apps/server/dist/composition/create-admin.js you@example.org
```

It refuses, and changes nothing, when the first account already has an address. `set-password` resets any account's password the same way. Everyone else is invited from the app
(Réglages › Gérer les comptes) and signs in with the address and the temporary password they
receive by email (`MES_COURSES_SMTP_URL`, `MES_COURSES_MAIL_FROM`, `MES_COURSES_PUBLIC_URL`). A
development build accepts `http://127.0.0.1:3000` (or the machine's LAN address) only when built
with `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1`; release builds refuse `http://`.

## Signing in

The administrator invites an address from the app (Réglages › Gérer les comptes). The person
receives a temporary password by email (valid 7 days), enters it with the server address on the
sign-in screen, then chooses their own password. A forgotten password is reset from the sign-in
screen, by email; with no mail relay, `set-password` on the Pi does it.

## Environment variables

| Variable                              | Where                 | What it does                                                                                                   |
| ------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                          | server                | Sends server errors to the Sentry project `mes-courses-server` (EU region). Unset: they go to the journal only |
| `MES_COURSES_DB`                      | server                | The SQLite database path. Default: `/var/lib/mes-courses/<env>/mes-courses.db`                                 |
| `MES_COURSES_SMTP_URL`                | server                | The SMTP relay that sends invitations and resets, `smtp://user:password@host:587` (STARTTLS required)          |
| `MES_COURSES_MAIL_FROM`               | server                | The sender of those emails, an address the relay allows                                                        |
| `MES_COURSES_PUBLIC_URL`              | server                | The public address of the server, written in the emails                                                        |
| `MES_COURSES_DOMAIN`                  | Caddy                 | The public domain Caddy serves and gets a certificate for                                                      |
| `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL` | app, development only | `1` lets a development build sign in to an `http://` server; ignored by release builds                         |

**The relay sees every address and temporary password it sends.** Choose a provider whose logs and
retention you accept; the app and the server never write an address or a password in their own
logs or reports ([research R8](../specs/004-multi-user/research.md)). The systemd unit refuses to start
the server when one of the three mail variables is empty.

On the Pi, each instance's variables go in `/etc/mes-courses/<env>.env` (from
`deploy/mes-courses.env.example`, mode 600, owned by the instance's user). The agent's are in
`/etc/mes-courses/agent.env` (from `deploy/agent.env.example`, mode 600, root).
