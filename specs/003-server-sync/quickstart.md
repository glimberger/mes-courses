# Quickstart: Validate Server Synchronization

How to check this feature, from the automated suite to a real Pi behind the Freebox and two
devices. Behavior is in [spec.md](spec.md); the API in
[contracts/sync-api.md](contracts/sync-api.md); the screens in
[contracts/ui-screens.md](contracts/ui-screens.md). The app's own setup is
[001's quickstart](../001-shopping-lists/quickstart.md).

## 1. Automated checks (same as CI)

```sh
yarn install --immutable                     # from the repository root: every workspace
yarn typecheck          # root scripts run in every workspace (001 research R20)
yarn lint
yarn format:check
yarn test                   # sync-core, server, app, tests/sync (adapter and two-device scenarios)
yarn test:architecture  # app, server, sync-core and cross-workspace rules
yarn build              # app (expo export), server and sync-core (tsc)
sh .github/scripts/server-smoke.sh  # the compiled server answers /v1/health
```

Expected: everything is green. No test reaches the network beyond `127.0.0.1`, and none reaches
the Pi. Scenario tests are named after the spec ("003 US2-5 …").

Screens and journeys ([001 quickstart](../001-shopping-lists/quickstart.md) §2 and §3): the stories
listed in [contracts/ui-screens.md](contracts/ui-screens.md#stories-and-end-to-end-journeys) appear
in Storybook and meet the review checklist; `yarn test:e2e:android` runs `sync-unreachable` green
with the journeys of 001 and 002.

## 2. Run the server locally (development)

```sh
yarn workspace @mes-courses/server dev          # http://127.0.0.1:3000, database in apps/server/.data/
yarn workspace @mes-courses/server pairing-code:dev # prints a code valid 10 minutes
```

A development build of the app accepts `http://127.0.0.1:3000` (or the LAN address of the
machine) only when `EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL=1` is set in development. Release builds
refuse `http://` (FR-019).

## 3. Set up the Pi behind the Freebox (once)

1. **Pi**:
   - install Raspberry Pi OS Lite 64-bit and enable SSH;
   - optionally, put `/var/lib/mes-courses/` on a USB SSD ([research.md](research.md) R3).
2. **Freebox OS** (`mafreebox.freebox.fr`):
   - in *Paramètres de la Freebox › DHCP*, give the Pi a static lease;
   - in *Gestion des ports*, forward TCP 80 and TCP 443 to the Pi's address;
   - in *Accès à distance*, check that the Freebox's own remote access does not use port 80 or
     443.
3. **Public IPv4**: in the Free subscriber area, check the line has a **full-stack** IPv4
   address. If it is shared (a port range only), request a full-stack address; it is free and
   takes effect after the Freebox restarts ([research.md](research.md) R4).
4. **DNS**: create an A record `courses.<your domain>` pointing to the Freebox's public IPv4
   address. Check with `dig +short courses.<your domain>`.
5. **Software**: on the Pi, install Nix (multi-user, with flakes enabled) and Caddy (its Debian
   repository). Node and Yarn come from the project's flake ([research.md](research.md) R17).
   Create the system user the server runs as, with no shell and no home:
   `useradd --system --no-create-home --shell /usr/sbin/nologin mes-courses`. If the server is
   ever compromised, it holds only that user's rights over its own database, and nothing of the
   maintainer's account.
6. **Deploy** (as the maintainer's account, `sudo` where files go to `/etc`):
   - create `/opt/mes-courses`, owned by the maintainer's account (the service only reads it),
     and clone the repository there. A private repository needs a read-only deploy key for the
     Pi (`gh repo deploy-key add`);
   - run `nix develop --command sh -c 'yarn workspaces focus @mes-courses/server && yarn workspace @mes-courses/server build'`;
   - run `nix build .#node --out-link /opt/mes-courses/runtime` (see *Node on the Pi* below);
   - copy `deploy/mes-courses.service` to `/etc/systemd/system/` and `deploy/Caddyfile` to
     `/etc/caddy/Caddyfile`, with the domain filled in
     (`sed 's/{\$MES_COURSES_DOMAIN}/courses.<your domain>/' deploy/Caddyfile`);
   - create `/etc/mes-courses.env` from `deploy/mes-courses.env.example` (Sentry DSN), mode
     600, owned by `mes-courses`
     (`install -m 600 -o mes-courses -g mes-courses deploy/mes-courses.env.example /etc/mes-courses.env`);
   - run `systemctl daemon-reload`, `systemctl enable --now mes-courses` and
     `systemctl restart caddy`.

   **Node on the Pi.** `nix develop` puts Node on the `PATH` only for the command it runs, and
   systemd starts an executable directly, so the service needs a Node at a fixed path.
   `nix build .#node` builds (in practice, downloads from the cache) the flake's `node` package,
   the same `nodejs_24` as the dev shell, into `/nix/store/<hash>-nodejs-24…`, and
   `--out-link` makes `/opt/mes-courses/runtime` a symlink to it. `mes-courses.service` runs
   `/opt/mes-courses/runtime/bin/node --conditions=production`: the flag makes
   `@mes-courses/sync-core` resolve to its compiled `dist/` (built by the server's `build`)
   instead of its TypeScript source, which only tsx, Jest and Metro can load. This gives:
   - the exact Node of `flake.lock`, the one tests and CI use, not Debian's or the
     maintainer's profile's;
   - a Node that stays: the symlink is a garbage-collection root, so `nix-collect-garbage`
     keeps it;
   - simple upgrades: when the flake moves to another Node, rerun the same command and restart
     the service; the unit file does not change;
   - a Node `mes-courses` can run: the Nix store is world-readable, whereas a Node in a home
     directory would be hidden by `ProtectHome=true`.
7. **Checks**:
   - `curl https://courses.<your domain>/v1/health` from **mobile data** returns
     `{ serverId, apiVersion: 1, minAppVersion }` with a valid certificate (no `-k`);
   - the same command from the **home Wi-Fi** also works (NAT loopback, [research.md](research.md) R4);
   - `curl http://courses.<your domain>/v1/health` redirects to HTTPS.

## 4. Hands-on scenarios (phone and tablet)

Start with the phone holding data from 001 and 002 (several lists, ticked items), the tablet
freshly installed, and the server empty.

Without a tablet, an iOS simulator is the second device: install the Detox release build with
`xcrun simctl install <device> apps/mobile/ios/build/Build/Products/Release-iphonesimulator/Mescourses.app`
(built by `yarn test:e2e:ios`). Xcode 27 shows simulators in
`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`, not `Simulator.app`.

To put both devices offline at once (the simulator shares the Mac's network), make the server
unreachable: `systemctl stop caddy` on the Pi, then `systemctl start caddy`.

1. **First device on an empty server** (US4-2, US4-4, US1-6, FR-018):
   - on the Pi, run `sudo -u mes-courses /opt/mes-courses/runtime/bin/node --conditions=production /opt/mes-courses/apps/server/dist/composition/pairing-code.js`
     (as `mes-courses`: the database in `/var/lib/mes-courses/` is readable by that user only);
   - on the phone, open Réglages › Connecter à un serveur and enter the domain, the code and a
     name;
   - the status bar goes "Synchronisation…" then "Synchronisé";
   - query the server database: every list, item and tick is there. Time it: under 1 minute
     (SC-006).
2. **Wrong codes** (US4-5, US4-12): on the tablet, enter a wrong code: "Ce code n'est pas
   valide…". Reuse the phone's code: same message. Enter 3 more wrong codes: same message; the
   next attempt, the sixth, shows "Trop d'essais…" (at most 5 failures in 10 minutes, for the
   whole server). Wait 10 minutes after the first failure before step 3, or the right code is
   refused too.
3. **Second device** (US4-3, US1-5, FR-017, SC-005, SC-007): on the phone, "Ajouter un
   appareil" shows a code; enter it on the tablet. All data appears in under 30 seconds, with no
   duplicated category and no second "Ma liste".
4. **Live changes** (US2-1, SC-001): with both apps open, add "Pain" on the phone; the tablet
   shows it within 10 seconds.
5. **Offline in the store** (US1-2, US1-3, US3-2, SC-004): put the phone in airplane mode;
   tick, add, rename and delete. Everything is instant, and the bar shows "En attente de
   synchronisation (n)" with no error. Turn airplane mode off: "Synchronisé", and the tablet
   gets every change.
6. **Conflicts** (US2-2 to US2-8, SC-003): put both devices offline and run each US2 scenario
   (tick vs untick, rename vs quantity, same new article, delete vs tick, remove vs quantity,
   finish vs a later tick, two new categories). Reconnect both: they show identical data
   matching the expected result of each scenario.
   Run them in rounds, one sync between rounds, since several touch "Lait". "Terminer les
   courses" only shows when an item is ticked: tick some items, but not "Œufs", before the
   finish scenario.
7. **Undo never sent** (US1-7, FR-008): delete an article and tap "Annuler" while online; the
   server never shows it deleted (check its database).
8. **Killed app** (US1-4, FR-005): offline, make changes, kill the app, go online and reopen:
   the changes reach the tablet.
9. **Per-device current list** (US2-9, FR-015): choose "Pique-nique" on the tablet (not
   "Barbecue", which step 16 creates offline on both devices); the phone
   keeps "Ma liste".
10. **Revoke** (US4-8 to US4-10, SC-008, SC-009):
    - from the tablet, Réglages › Appareils › phone › "Révoquer";
    - on its next sync the phone shows "Cet appareil n'est plus connecté au serveur." and keeps
      its data;
    - reconnect it with a new code.
11. **Disconnect** (US4-11): "Déconnecter cet appareil" on the tablet. It keeps working
    locally, and the server data is untouched.
12. **Server down** (FR-003, edge cases): run `systemctl stop mes-courses`. Both apps work, and
    the bar shows "En attente…" with no error. Start it again: sync resumes.
13. **Failure status** (US3-4):
    - stop Caddy only (`systemctl stop caddy`) to get connection refusals, and check the bar
      stays "En attente…" for at least a minute;
    - make `/v1/sync` answer 500: back up `/etc/caddy/Caddyfile`, add `respond /v1/sync 500`
      after `encode gzip`, run `systemctl reload caddy`; after three failed cycles the bar shows
      "Échec de la synchronisation" and "Réessayer", and the app reports one Sentry event (a
      build with `EXPO_PUBLIC_SENTRY_DSN`, from EAS: a local `yarn android` build has none);
    - restore the Caddyfile, reload Caddy and tap "Réessayer": "Synchronisé".
14. **Reset server** (FR-018a):
    - stop the server, move its database away, start it again (new `serverId`);
    - both devices show "Cet appareil n'est plus connecté au serveur.";
    - reconnect the phone with a code from the Pi: the server is repopulated;
    - reconnect the tablet: its data merges, with no duplicates.
15. **Accessibility** (FR-023, US3-6, US3-7): with TalkBack/VoiceOver, let the app sync for
    a minute: nothing is read out. Make `/v1/sync` answer 500 as in step 13: "Échec de la
    synchronisation" is read once; restore it: "Synchronisé" is read once. Activate the row
    "Pain" (double tap: a row only moved to is left to the screen reader), then remove "Pain"
    on the tablet: focus moves to the next row, which the screen reader reads as it gets focus,
    and nothing is read for the change. Settings and ConnectServer can be used with the screen
    reader alone and at 200% text.
16. **Changes from the other device on open screens** (FR-020a, FR-008, US2-10):
    - open the quantity dialog of "Lait" on the phone and type "3"; change "Lait" to "2 L" on
      the tablet; after the next sync the phone still shows "3"; save: both devices end with
      "3" (the later change wins);
    - open the quantity dialog of "Pain" on the phone; delete the article "Pain" on the
      tablet: the dialog closes with "Cet article a été supprimé sur un autre appareil.";
    - remove "Œufs" on the phone and, while "Annuler" is offered, delete "Œufs" on the tablet:
      the snackbar disappears;
    - offline, create a list "Barbecue" on both devices and make it current on the phone; sync
      both: the phone shows one "Barbecue" holding the items of both, with no message.
17. **Restored phone** (FR-018b), once before the first release, on a test phone: back it up
    (Android: `adb shell bmgr backupnow <package>`; iOS: an encrypted Finder backup), restore
    it onto another phone or emulator: the app opens on the restored lists and shows "Cet
    appareil n'est plus connecté au serveur." Reconnect with a new code: changes made on the
    tablet since the backup win, and lists only on the restored phone are added.

## 5. Error tracking (FR-022, FR-022a)

- Force a server exception: on the Pi, stop the service, make the database read-only
  (`chmod 400 /var/lib/mes-courses/mes-courses.db`), start the service and make a change on a
  device. The failed writes appear in Sentry with the server release and environment, and no
  body, header, name or credential. Then `chmod 600` the database and restart the service.
- The server reports to its own Sentry project, `mes-courses-server` (platform Node.js, EU
  region like `mes-courses`, the app's): its DSN goes in `/etc/mes-courses.env`. Server and app
  issues, alerts and quotas stay apart.
- In both projects, turn on *Settings › Security & Privacy › Prevent Storing of IP Addresses*:
  Sentry otherwise derives the user's geography from the sender's address, the home's public
  IP for the server.
- Offline and unreachable-server periods create no event.
