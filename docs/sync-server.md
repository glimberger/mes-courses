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

The diagram follows the server's use cases (`invite-account`, `sign-in`, `choose-password`,
`request-password-reset`, `resend-credentials`) and the `set-password` command; the choices behind them are in
[ADR 0005](adr/0005-accounts-and-authentication.md). A reset does not replace the current password:
it issues a new temporary password, and the current one keeps working until the new one is used.

```mermaid
flowchart TD
  start(["Start"]) --> invite["The administrator invites an address<br/>(Réglages › Gérer les comptes)"]
  invite --> created["The server creates the account<br/>with a temporary password valid 7 days"]
  created --> mailok{"Mail sent?"}
  mailok -- "no" --> undone["The account is deleted<br/>and the invitation is refused"]
  undone --> stop1(["End"])
  mailok -- "yes" --> mail["The person receives an email<br/>with the temporary password"]
  mail --> signin["Sign-in screen:<br/>server address, email, password"]

  signin --> which{"Which password<br/>was typed?"}
  which -- "current password" --> susp1{"Suspended?"}
  susp1 -- "no" --> device["The server creates the device<br/>and the app is signed in"]
  susp1 -- "yes" --> suspended["Refused: suspended.<br/>The administrator reactivates the account"]
  suspended --> signin
  which -- "temporary password" --> exp{"Expired?"}
  which -- "anything else" --> refused["Refused, counted against<br/>the attempt limit"]
  refused --> signin
  exp -- "yes" --> expired{"Did the person already<br/>choose a password?"}
  expired -- "no (invitation)" --> resend["The administrator resends<br/>the credentials"]
  resend --> mail
  expired -- "yes (reset)" --> reset
  exp -- "no" --> susp2{"Suspended?"}
  susp2 -- "yes" --> suspended
  susp2 -- "no" --> choose["Choose-password screen:<br/>new password, typed twice"]
  choose --> rules{"Rules met and<br/>both entries equal?"}
  rules -- "no" --> choose
  rules -- "yes" --> save["The server stores the password,<br/>clears the temporary one<br/>and creates the device"]
  save --> device
  device --> stop2(["End"])

  signin -. "forgotten password" .-> relay{"Mail relay<br/>configured?"}
  relay -- "yes" --> reset["Request a reset from the sign-in screen"]
  reset --> newtemp["The server issues a new temporary password<br/>and emails it (same answer for any address)"]
  newtemp --> mail
  relay -- "no" --> setpw["On the Pi, the maintainer runs<br/>set-password with the address"]
  setpw --> newpw["The password is set and the<br/>temporary one cleared"]
  newpw --> signin
```

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
