# Quickstart: Continuous Delivery to Staging and Production

How to set up delivery once, and the scenarios that prove it works end to end. The automated
checks (§1) run in CI. The other sections are run once on the real Pi before the feature's pull
request is merged, and each result is recorded in its test plan (research R17). Paths, units and
commands are specified in [contracts/pi-layout.md](contracts/pi-layout.md). The workflows are in
[contracts/workflows.md](contracts/workflows.md).

## 1. Automated checks (same as CI)

```sh
yarn typecheck && yarn lint && yarn format:check
yarn test                 # includes apps/delivery, the server's /v1/health release, app variants
yarn test:architecture    # apps/delivery is hexagonal too
yarn test:scripts         # delivery-targets.sh
nix develop --command actionlint
```

Expected: everything green. `actionlint` reports no error on the five workflows.

## 2. Keys and secrets (once, on the maintainer's machine)

1. **APK upload key**: `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA
   -keysize 4096 -validity 10000`. Store the file and its passwords in the password manager,
   then set `ANDROID_KEYSTORE_BASE64` (`base64 -i upload.jks`), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` with `gh secret set`. Set the variable
   `ANDROID_CERT_SHA256` from `keytool -list -v`.
2. **F-Droid repository key**: the same command with alias `repo`, into `FDROID_*` (research
   R16).
3. **Manifest signing key**: `ssh-keygen -t ed25519 -N '' -C mes-courses-deploy -f deploy_signing`.
   Set `DEPLOY_SIGNING_KEY` from the private file, and commit the public key as
   `deploy/allowed_signers` (`mes-courses-deploy <type> <key>`). Then delete the private file
   from the disk; the password manager keeps a copy.
4. *(Dropped: iOS is out of scope, so there is no Expo robot and no `EXPO_TOKEN`.)*
5. **Variables**: `gh variable set` for `SENTRY_ORG`, `SENTRY_PROJECT`, `EXPO_PUBLIC_SENTRY_DSN`,
   `PRODUCTION_SERVER_URL` and `STAGING_SERVER_URL`.

**Check (SC-006)**: `gh secret list` shows only the names of research R16. None of them is an SSH
key, password or token for the Pi.

## 3. Set up the Pi for two instances (once)

The Pi is shared with other projects (freebox-partage, persona-bot, Ollama) and one Caddy. Before
anything, read the list of the Pi's ports and domains (`hosts/agent-pi/PORTS.md` in `nix-config`) and
look at the live state: `sudo ss -tlnp` and `/etc/caddy/Caddyfile`. Mes courses uses 3000
(production), 3002 (staging), 3100 and 3101 (validation); 3001 is freebox-partage's.

1. **DNS**: add an A record `staging.courses.<domain>` to the same address as `courses.<domain>`.
2. **Read-only token**: on GitHub, create a fine-grained personal access token. Give it access to
   this repository only, with *Contents: read* and nothing else, and an expiry of one year. Write
   the renewal date in the calendar.
3. **Users and folders**:
   `useradd --system --no-create-home --shell /usr/sbin/nologin mes-courses-production`, the
   same for `mes-courses-staging`, then `mkdir -p /etc/mes-courses /srv/fdroid`.
4. **Migrate production** (research R8):
   - `systemctl stop mes-courses` and `cp /var/lib/mes-courses/mes-courses.db ~/pre-005.db`
     (with `sqlite3`, `.backup` does the same without stopping, then `PRAGMA integrity_check`);
   - `mkdir /var/lib/mes-courses/production && mv /var/lib/mes-courses/mes-courses.db* /var/lib/mes-courses/production/`
     and `chown -R mes-courses-production: /var/lib/mes-courses/production`. Then
     `chmod 711 /var/lib/mes-courses`: the old folder belongs to the old user with mode 700, and
     the new instances could not even reach their own sub-folder (`EACCES` on `mkdir`). Keep
     the owner, so that the back-out below still works;
   - create `/etc/mes-courses/production.env` and `staging.env` from
     `deploy/mes-courses.env.example` (mode 600, owned by the instance's user): `MES_COURSES_ENV`,
     `MES_COURSES_PORT` (3000 and 3002), the Sentry DSN of the project `mes-courses-server`
     (not the app's), and the public URL of the instance. **The three mail variables are
     mandatory**: the unit refuses to start when `MES_COURSES_SMTP_URL`, `MES_COURSES_MAIL_FROM` or
     `MES_COURSES_PUBLIC_URL` is empty, and an old `/etc/mes-courses.env` does not have them.
     Staging uses the same relay (spec assumption). Write the relay's URL in the file yourself:
     it holds a password;
   - install `deploy/mes-courses@.service`, `deploy/mes-courses-agent.{service,timer}` and
     `deploy/allowed_signers`. **Caddy**: add the blocks of `deploy/Caddyfile` to the existing
     `/etc/caddy/Caddyfile`, with the two domains written in full, and **do not copy the file over
     it**: it also serves other projects (`partage…`). Keep a backup, then
     `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` and
     `systemctl reload caddy` (`reload` keeps the old configuration when the new one is refused);
   - create `/etc/mes-courses/agent.env` (mode 600, root) from `deploy/agent.env.example`, with
     the token and the server's Sentry DSN;
   - **give production its first release**. Its channel is empty until the first `v*` tag, so no
     agent pass can deploy it. Download the `server-staging` artifact of a green `Deliver staging`
     run (`gh run download <run> -n server-staging`), copy `server-<sha>.tar.gz` to the Pi, create
     `/var/lib/mes-courses-agent` (`mkdir -p -m 700`) and `/run/mes-courses`, and run
     `main.js deploy-file production server-<sha>.tar.gz` as root with the Nix `bin` folder in
     `PATH`. It stops nothing else, validates on 3100, then opens 3000. The version shows
     `…-staging.N` until the first real release.
5. **Install the agent** from the latest production release (§7). Before the first release
   there is none, and CI only builds the bundle on a tag (`release.yml`): build it on the
   maintainer's machine, in a throwaway copy of the repository, for the Pi's architecture. Add
   `supportedArchitectures: {os: [linux], cpu: [arm64], libc: [glibc]}` to that copy's
   `.yarnrc.yml`, then `yarn install --immutable`, `yarn workspace @mes-courses/delivery build`
   and `sh .github/scripts/pack-agent.sh <version of apps/delivery> <folder>`. Copy
   `delivery-<version>.tar.gz` to the Pi and continue as in §7 from the unpacking: the bundle
   holds `apps/delivery/dist/composition/main.js` and `node_modules` at its root, which is where
   the unit looks. The agent has the ports and the other constants **built in**: after a change
   of one of them, rebuild and reinstall it (new folder under `releases/`, then move `current`).
6. **Sentry alert** (research R10, once): add an issue alert rule on the tag
   `component:delivery-agent`, in every environment, for new issues and monitor issues, emailing
   the maintainer. Production errors keep the two existing rules.
7. `systemctl daemon-reload`, `systemctl enable mes-courses@production mes-courses@staging`,
   `systemctl enable --now mes-courses-agent.timer`, then `systemctl start mes-courses-agent`
   (the first pass deploys staging from its channel).
   **Back out** (FR-034). The old unit `mes-courses` and `~/pre-005.db` stay untouched until the
   cleanup below. Expected downtime: from the `systemctl stop` of step 4 to the first healthy
   answer of `mes-courses@production`, a few minutes (do it in a quiet hour). If the new instance
   does not answer: `systemctl stop mes-courses@production mes-courses-agent.timer`, move the
   database and the env file back to their old paths, `systemctl start mes-courses`, and check
   `https://courses.<domain>/v1/health`. Cleanup (step 8) only starts after the new instance has
   passed its health check and a phone has synced.
8. **Cleanup** once production answers: `systemctl disable mes-courses`, remove the old unit and
   `/etc/mes-courses.env`, remove the git checkout in `/opt/mes-courses` (keep the new folders),
   and delete the Pi's deploy key from the repository (`gh repo deploy-key list`, then
   `gh repo deploy-key delete <id>`).

**Checks**:

- `curl https://courses.<domain>/v1/health` returns the production `release`, and a phone keeps
  syncing with no new sign-in;
- `ss -tlnp` lists no new listening port reachable from outside: the servers listen on
  `127.0.0.1` only, and Caddy on 80 and 443 as before (SC-006);
- the Freebox forwards only TCP 80 and 443, as before.

## 4. Staging delivery (US1, SC-001, SC-002)

1. Merge a pull request that changes a server response and a visible label.
2. Expected: once `CI` is green, `Deliver staging` runs on the merge commit. Its summary lists
   `server` and `android` with their outcomes.
3. Within 15 minutes of CI turning green,
   `curl https://staging.courses.<domain>/v1/health` reports the commit (SC-001).
4. Within 30 minutes, the F-Droid client on the maintainer's Android phone (with the staging
   repository added from its QR code, §6) offers "Mes courses (test)" with the new label
   (SC-002).
5. Both "Mes courses" and "Mes courses (test)" are installed side by side, each with its own data
   (US1 scenario 6).
6. Merge a documentation-only pull request. `Deliver staging` runs, builds nothing and succeeds.
   Nothing changes on the Pi (US1 scenario 3).
7. Merge a server-only change. Only `server-artifact` and `publish` run (US1 scenario 4).

## 5. iOS (dropped)

iOS is out of scope (2026-10-15): the Apple Developer Program is paid. Nothing to set up here.

## 6. F-Droid repositories (US2 scenario 6, US4 scenario 2)

1. Print the address of each repository with its fingerprint:
   `https://courses.<domain>/fdroid/repo?fingerprint=<SHA-256 of the repo key>`, and the same
   with `staging.`. Then `qrencode -t ansiutf8 '<address>'`.
2. In F-Droid or Droid-ify: *Repositories › +*, scan the QR code. The client shows the repository
   name and accepts it only if the fingerprint matches.
3. Expected: the app is listed with its name, summary and icon. Installing it works, and
   *About* shows the delivered version.

## 7. Install or update the agent

Download the asset `delivery-<version>.tar.gz` of the release `vX.Y.Z` with the read-only token:

```sh
. /etc/mes-courses/agent.env
gh release download vX.Y.Z --repo "$GITHUB_REPOSITORY" --pattern 'delivery-*.tar.gz'   # GH_TOKEN="$GITHUB_TOKEN"
```

Unpack it into `/opt/mes-courses/agent/releases/<version>/`, point `current` at it, and build the
runtime: `nix build github:NixOS/nixpkgs/<rev>#nodejs_24 --out-link /opt/mes-courses/agent/runtime`
(the revision is in the bundle's `nixpkgs-rev`). Check with `…/main.js status`.

The maintainer's `~/.zshrc` on the Pi defines `agent` for `…/main.js`
(see [the agent's commands](../../docs/delivery-agent.md#commands)); the scenarios below write
`main.js`, which `agent` stands for.

## 8. Move an Android user from Google Play (US4, SC-007)

0. Order for the maintainer: first production F-Droid release, then the guide (in French, in the
   repository's documentation), then a direct message with the guide to every Android user. Google
   Play receives no build after that, and `minAppVersion` stays at or below the last Google Play
   build until everyone has migrated.
1. On the phone with the Google Play install: open *Réglages* and check that the synchronization
   status shows nothing pending, then sync once more.
   If synchronization cannot finish (server unreachable, errors), stop here: do not uninstall until
   it does, or the unsynchronized changes are lost.
2. Uninstall the Google Play app. This erases the local replica, and the data stays on the
   server.
3. Install F-Droid or Droid-ify, add the production repository from the link or QR code of §6
   (they carry the key fingerprint; never type the address alone), install the app and install "Mes courses".
4. Sign in. Expected: every list, article and category is back. Time the whole procedure: it
   must take under 10 minutes (SC-007).

## 9. Release to production (US2, SC-003)

1. Merge the pull request that sets `version` in `apps/mobile/app.config.ts` (README "Releases",
   with its manual checks).
2. Wait for `CI`, `E2E Android` and `Deliver staging` to be green on its squash commit, and try
   the change on staging.
3. `git tag v1.2.0 <sha> && git push origin v1.2.0`. This is the only action (SC-003).
4. Expected: `release.yml` passes `gate`, publishes `v1.2.0` and `channel-production`, and the
   production health reports the commit (`wait-production-health` turns green). Then the F-Droid
   client offers 1.2.0.
5. Production unavailability during the deployment, measured with
   `while true; do curl -so /dev/null -w '%{http_code} %{time_total}\n' https://courses.<domain>/v1/health; sleep 1; done`:
   under 30 seconds of failures (SC-005).

**Gate checks (US2 scenarios 3 to 5)**, each on a scratch tag, deleted afterwards:

- a tag whose version differs from `app.config.ts` fails, and the gate names the expected
  version;
- a tag on a commit whose `E2E Android` run is not green fails;
- a tag on a branch commit outside `main` fails;
- a tag equal to the production version fails.

**Partial release (edge case)**: on a scratch production setup, stop the agent timer before a
release so `wait-production-health` times out, then start it. Expected: the run is failed, the
Pi deploys and swaps the repository, and *Re-run failed jobs* on the same run makes the health
poll succeed on the tag's commit, with no new tag.


## 10. Failed deployment and rollback (US3, SC-004)

1. On a scratch branch, make the server exit at startup (for example a throw in `main.ts`), then
   `yarn build && sh .github/scripts/pack-server.sh` (the script CI uses, research R3). Copy the
   tarball to the Pi and run
   `main.js deploy-file staging server-<sha>.tar.gz`. A real delivery from a branch would give it a
   sequence above `main`'s, which would hide the next real deliveries (research R7), so this test
   does not go through GitHub. The script leaves only production dependencies in `node_modules`,
   so run `yarn install` afterwards.
2. Expected within 5 minutes: `mes-courses@staging` runs its previous release on the database
   copy (`…/main.js status` shows the failed commit), Sentry has an error event in `staging`
   naming the commit, and the next agent passes do not retry it (SC-004, US3 scenarios 1 to 3).
3. During the failed start, `curl https://staging.courses.<domain>/v1/health` gets no answer
   from the failed version (phones never reach it, FR-019a), and the validation port answers only
   on `127.0.0.1`.
4. The maintainer receives the failure email for **staging** (the alert rule on
   `component:delivery-agent`, FR-020).
5. Production's health and `journalctl -u mes-courses@production` show no restart during the
   test (US3 scenario 4).
6. `main.js forget-failure staging <sha>` clears the mark. Then deliver a fixed commit.
7. Degraded case (FR-019b): deliver a failing server with a database copy that the previous
   version also rejects, for example by corrupting the copy. Expected: `mes-courses@staging`
   stays up under systemd, a critical error is reported, and the instance is never left stopped
   on purpose.

## 11. Pi offline and race (spec edge cases)

1. `systemctl stop mes-courses-agent.timer`, merge two server changes, then start the timer
   again. Expected: one deployment, of the later commit.
2. Agent silence (FR-020a): `systemctl stop mes-courses-agent.timer`, then wait 30 minutes.
   Expected: the Sentry monitor `mes-courses-agent` reports a missed check-in and the maintainer
   receives an email. Start the timer again; the monitor recovers.
3. Revoke the token on GitHub, then wait for an hour. Expected: one Sentry error (`401`), and both
   instances keep running. Create a new token and put it in `agent.env`. The next pass succeeds.
