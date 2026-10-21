# On the Pi

The Pi runs two instances of one systemd template unit, `mes-courses@staging` and
`mes-courses@production`, behind Caddy, plus a delivery agent that deploys what GitHub Actions
built ([ADR-0006](../adr/0006-pull-based-continuous-delivery.md),
[ADR-0010](../adr/0010-two-instances-on-one-pi.md)). Nothing is pushed to the Pi and no
secret of the Pi lives in GitHub. The paths, units and ports are in
[the Pi layout](../../specs/005-continuous-delivery/contracts/pi-layout.md). How the agent works,
step by step, is in [the delivery agent](../delivery-agent.md).

## One-time set-up

The full steps, with their checks, are in [005 quickstart](../../specs/005-continuous-delivery/quickstart.md).

1. **Keys and secrets** (quickstart §2): the APK upload key, the F-Droid repository key and the
   manifest signing key, each stored in the password manager and set with `gh secret set`
   (`ANDROID_KEYSTORE_*`, `FDROID_KEYSTORE_*`, `DEPLOY_SIGNING_KEY`). The public part of the
   signing key is committed as `deploy/allowed_signers`. The variables `SENTRY_ORG`,
   `SENTRY_PROJECT`, `EXPO_PUBLIC_SENTRY_DSN`, `ANDROID_CERT_SHA256`, `PRODUCTION_SERVER_URL` and
   `STAGING_SERVER_URL` are set with `gh variable set`.
2. **DNS**: `staging.courses.<domain>` points to the same address as `courses.<domain>`.
3. **Read-only token**: a fine-grained personal access token on this repository only, with
   _Contents: read_ and nothing else, expiring after one year. It goes in
   `/etc/mes-courses/agent.env`. **Renew it every year**: when it expires the agent gets a `401`,
   reports it to Sentry, and both instances keep running on their current release.
4. **The Pi** (quickstart §3): one system user per instance, `/etc/mes-courses/<env>.env`
   (from `deploy/mes-courses.env.example`, mode 600), `deploy/mes-courses@.service`,
   `deploy/mes-courses-agent.{service,timer}` and `deploy/allowed_signers`; the blocks of
   `deploy/Caddyfile` are added to the existing Caddyfile, not copied over it.
   An existing single-instance Pi is migrated by the steps of §3, which include the back-out.
5. **Sentry**: the alert rule on the tag `component:delivery-agent` (see [Sentry alerts](sentry-alerts.md)).
6. **The agent** is installed from a release (§7 of the quickstart, and [Updating the agent](updating-the-agent.md)
   below).
