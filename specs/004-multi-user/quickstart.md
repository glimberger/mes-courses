# Quickstart: Validate Multi-User Accounts

How to check this feature, from the automated suite to the Pi with two real accounts. Behavior is in
[spec.md](spec.md); the API in [contracts/auth-api.md](contracts/auth-api.md); the screens in
[contracts/ui-screens.md](contracts/ui-screens.md). The server and app setup is
[003's quickstart](../003-server-sync/quickstart.md); this feature changes only what is below.

## 1. Automated checks (same as CI)

```sh
yarn install --immutable
yarn typecheck
yarn lint
yarn format:check
yarn test               # sync-core, server, app, tests/sync (adapters, two-account and two-device scenarios)
yarn test:architecture
yarn build
sh .github/scripts/server-smoke.sh
```

Expected: everything green. No test sends an email, reaches an SMTP provider, or reaches the Pi.
Scenario tests are named after the spec ("004 US3-3 …"). The checks that matter most for this
feature:

- the **isolation contract test** (two accounts, same ids, in the in-memory fake and in SQLite);
- the **deletion test** (no row left for an account in any table, only `ended_credential`, and no
  `auth_attempt` row keyed by its address);
- the **log test** (no address and no password in the server's logs or the error reports, SC-008);
- the **migration test** (a database filled by migration 1 and by 003's code, migrated: every row
  and device is the setup account's, and a 003 device credential still authenticates).

Screens and journeys: the stories of [contracts/ui-screens.md](contracts/ui-screens.md#stories-and-end-to-end-journeys)
appear in Storybook; `yarn test:e2e:android` runs the changed `sync-unreachable` journey green with
the others.

## 2. Run the server locally (development)

```sh
yarn workspace @mes-courses/server dev                       # http://127.0.0.1:3000, database in apps/server/.data/
yarn workspace @mes-courses/server create-admin:dev you@example.org   # asks for the password twice
```

Development needs no mail service: without `MES_COURSES_SMTP_URL`, the server uses a **console
mailer** that prints each email (with the temporary password) to its own log. It is selected only
when the variable is empty and `NODE_ENV` is not `production`; in production an empty variable makes
every invitation fail with `MailFailed` and a startup warning. A development build of the app
accepts `http://` as in 003.

## 3. Upgrade the Pi

Do these in order (research R15). Step 1 is the only rollback.

1. Stop the service and copy the database: `sudo systemctl stop mes-courses` then
   `sudo cp /var/lib/mes-courses/mes-courses.db /var/lib/mes-courses/mes-courses.db.before-004`.
2. In `/etc/mes-courses.env` add:
   - `MES_COURSES_SMTP_URL=smtp://USER:PASSWORD@smtp.example.org:587` (an SMTP relay of your
     choice; STARTTLS is required);
   - `MES_COURSES_MAIL_FROM="Mes courses <courses@example.org>"` (an address the relay allows);
   - `MES_COURSES_PUBLIC_URL=https://courses.example.org` (the domain Caddy serves; it goes in the
     emails).
3. Deploy the new build and `sudo systemctl start mes-courses`. Migration 2 runs. Check
   `curl https://courses.example.org/v1/health`.
4. Create the administrator, as `mes-courses`:
   `sudo -u mes-courses /opt/mes-courses/runtime/bin/node --conditions=production /opt/mes-courses/apps/server/dist/composition/create-admin.js you@example.org`.
5. Update the phone and the tablet to the new app. Between step 3 and this update, the old app
   (1.0.0) is refused with "mise à jour requise" (`minAppVersion` is now 1.1.0); it keeps its data
   and its credential. After the update they must **not** ask to sign in (SC-005): the status bar
   shows "Synchronisé" and the lists are the same.
6. In Sentry, check that `mes-courses-server` and `mes-courses-app` both have "Prevent storing of
   IP addresses" turned on (research R10). Once §4 passes, delete
   `/var/lib/mes-courses/mes-courses.db.before-004` (research R16).

If the administrator's password is lost and the relay is down, set a new one on the Pi (research
R17):
`sudo -u mes-courses /opt/mes-courses/runtime/bin/node --conditions=production /opt/mes-courses/apps/server/dist/composition/set-password.js you@example.org`.

## 4. Hands-on scenarios (two accounts, three devices)

Start from the state of §3 with the phone and the tablet on the administrator's account, and the
iOS simulator as a third, fresh device (003 quickstart §4 explains it). You need a second mailbox
you can read.

1. **Nothing lost** (SC-005, US3-5): on the phone, Réglages shows your address and "Administrateur"
   and the device list shows the phone and the tablet. Add an article on the phone; it reaches the
   tablet in under 10 s.
2. **Invite** (US1-1, SC-002): Réglages › Gérer les comptes › Inviter, enter the second mailbox.
   Time it: under 30 s. The email arrives in French with the server address, the address and a
   temporary password; the list shows "Invité, pas encore connecté".
3. **Invite refusals** (US1-2, US1-3): invite the same address again ("Cette adresse a déjà un
   compte."), then `abc` ("Saisissez une adresse e-mail valide."). No second email arrives.
4. **Mail failure** (US1-4): with the relay's password wrong in `/etc/mes-courses.env`, restart the
   service and invite a third address: "L'invitation n'a pas pu être envoyée. Réessayez." and the
   account is not in the list. Restore the password and restart.
5. **First sign-in** (US2-1 to US2-3, SC-001): on the simulator, Réglages › Se connecter with the
   server, the address and the temporary password. ChoosePassword appears. Try 6 characters, then
   two different entries, then the temporary password again: three different messages. Then a good
   password. Time from opening the email to the empty lists: under 3 minutes. The temporary
   password no longer works, the new one does (sign out and in again to see it). **Sign-in time**
   (plan, Performance Goals): on the Pi, time a sign-in with a wrong password, which runs the same
   scrypt verification as a right one and creates no device:
   `curl -s -o /dev/null -w '%{time_total}\n' -H 'content-type: application/json' -H 'x-app-version: 1.1.0' -d '{"email":"nobody@example.org","password":"wrong-password-1","deviceName":"timing"}' http://127.0.0.1:3000/v1/auth/sign-in`
   prints under 1 second. It counts one failure for that address.
6. **Wrong credentials** (US2-4): a wrong password and an unknown address give the same message.
   Five wrong passwords in a row, then a correct one: "Trop d'essais…", whichever password is right.
   Wait 10 minutes before step 7 or the account stays blocked.
7. **Isolation** (US3-1, US3-3, US3-4, SC-003): on the simulator (account B), add "Lait" and a list.
   On the phone (account A), none of it appears; A's lists are not on the simulator. Both have an
   article "Lait": rename A's, delete B's; the other is unchanged.
8. **Forgot password** (US4, SC-006, clarification B): on the simulator, sign out, then "Mot de
   passe oublié ?" with B's address: the generic message; an email arrives. **Sign in with the old
   password first: it still works** (and sign out again). Then sign in with the temporary password:
   ChoosePassword replaces both. Ask with an address that has no account: the same message, no
   email. Ask four times quickly: "Trop de demandes…" on the fourth. Time a whole recovery: under 3
   minutes.
9. **Expiry** (US2-5): the temporary password lasts 7 days; to see the message without waiting,
   edit the server's clock in a development run (the quickstart's step 2) or rely on the automated
   test.
10. **Suspend** (US5-2, US5-3, SC-004): on the phone, Gérer les comptes › Suspendre account B. On
    the simulator: with the network, the bar shows "Votre compte est suspendu…" at the next sync and
    the lists stay readable; with the network off, nothing changes. Réactiver: the simulator
    syncs again with no sign-in.
11. **Delete by the administrator** (US5-4, SC-007): delete account B. The simulator, at its next
    sync, shows "Compte supprimé"; after "Compris" its lists are gone and SignIn is shown. On the Pi:
    `sudo sqlite3 /var/lib/mes-courses/mes-courses.db "select count(*) from article"` no longer
    counts B's articles.
12. **Last administrator** (US5-5, US6-7): try to suspend and to delete your own account: both
    refused with the French message.
13. **Resend** (US5-6): invite a new address, do not sign in, "Renvoyer les identifiants": a new
    email; the first temporary password no longer works. Suspend that account: "Renvoyer les
    identifiants" is no longer offered; reactivate it: it is "Invité, pas encore connecté" again.
14. **Own account** (US6-1 to US6-6): as a user, change the password (other devices stay in), revoke
    another of your devices (its next sync shows "Appareil déconnecté", then it is cleared), sign
    out with a pending change (the warning), delete your account with your password.
15. **Wrong account on a device** (FR-017, edge case): on the simulator, sign in as B, then in the
    admin app revoke the simulator and, without dismissing the message, sign in as C from the same
    screen: B's lists are gone before C's sync starts.
16. **Offline** (FR-007, SC-004): switch the simulator to airplane mode: it opens straight to its
    lists, edits work, nothing asks to sign in.
17. **Recovery without mail** (research R17): stop the relay (wrong password in
    `/etc/mes-courses.env`, restart), run `set-password` for the second account on the Pi, sign in
    with it on the simulator. Restore the relay.

## 5. Error tracking (FR-018, SC-008)

- Trigger a mail failure (step 4). In Sentry (`mes-courses-server`) the event has the release and
  environment, and no address, no password and no relay URL.
- After the scenarios above, search the journal (`journalctl -u mes-courses`) for the two mailbox
  addresses and for the temporary passwords: no match.
- Wrong passwords, the rate limits and a suspended or deleted account create no event.
