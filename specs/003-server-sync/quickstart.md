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
yarn build              # app (expo export) and server (tsc)
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
yarn workspace @mes-courses/server pairing-code # prints a code valid 10 minutes
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
6. **Deploy**:
   - clone the repository into `/opt/mes-courses`;
   - run `nix develop --command sh -c 'yarn workspaces focus @mes-courses/server && yarn workspace @mes-courses/server build'`;
   - run `nix build .#node --out-link /opt/mes-courses/runtime` (the Node the service runs);
   - copy `deploy/mes-courses.service` to `/etc/systemd/system/` and `deploy/Caddyfile` to
     `/etc/caddy/Caddyfile`, with the domain filled in;
   - create `/etc/mes-courses.env` from `deploy/mes-courses.env.example` (Sentry DSN), mode
     600, owned by `mes-courses`;
   - run `systemctl enable --now mes-courses caddy`.
7. **Checks**:
   - `curl https://courses.<your domain>/v1/health` from **mobile data** returns
     `{ serverId, apiVersion: 1, minAppVersion }` with a valid certificate (no `-k`);
   - the same command from the **home Wi-Fi** also works (NAT loopback, [research.md](research.md) R4);
   - `curl http://courses.<your domain>/v1/health` redirects to HTTPS.

## 4. Hands-on scenarios (phone and tablet)

Start with the phone holding data from 001 and 002 (several lists, ticked items), the tablet
freshly installed, and the server empty.

1. **First device on an empty server** (US4-2, US4-4, US1-6, FR-018):
   - on the Pi, in `/opt/mes-courses`, run `nix develop --command yarn workspace @mes-courses/server pairing-code`;
   - on the phone, open Réglages › Connecter à un serveur and enter the domain, the code and a
     name;
   - the status bar goes "Synchronisation…" then "Synchronisé";
   - query the server database: every list, item and tick is there. Time it: under 1 minute
     (SC-006).
2. **Wrong codes** (US4-5, US4-12): on the tablet, enter a wrong code: "Ce code n'est pas
   valide…". Reuse the phone's code: same message. Enter 5 more wrong codes: "Trop d'essais…".
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
7. **Undo never sent** (US1-7, FR-008): delete an article and tap "Annuler" while online; the
   server never shows it deleted (check its database).
8. **Killed app** (US1-4, FR-005): offline, make changes, kill the app, go online and reopen:
   the changes reach the tablet.
9. **Per-device current list** (US2-9, FR-015): choose "Barbecue" on the tablet; the phone
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
13. **Failure status** (US3-4): stop Caddy only (`systemctl stop caddy`) to get connection
    refusals, and check the bar stays "En attente…". Then make the server return 500s with
    `MES_COURSES_FAIL_SYNC=1` (development builds only) to see "Échec de la synchronisation",
    "Réessayer" and one Sentry event.
14. **Reset server** (FR-018a):
    - stop the server, move its database away, start it again (new `serverId`);
    - both devices show "Cet appareil n'est plus connecté au serveur.";
    - reconnect the phone with a code from the Pi: the server is repopulated;
    - reconnect the tablet: its data merges, with no duplicates.
15. **Accessibility** (FR-023): with TalkBack/VoiceOver, status changes are announced, and
    Settings and ConnectServer can be used with the screen reader alone and at 200% text.

## 5. Error tracking (FR-022, FR-022a)

- Force a server exception in development (`MES_COURSES_FAIL_SYNC=1` on a build with
  `SENTRY_DSN`): the event appears in Sentry with the server release and environment, and no
  body, header, name or credential.
- Offline and unreachable-server periods create no event.
