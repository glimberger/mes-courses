# Upgrading a Pi that ran 004

Before 005 the Pi ran `mes-courses` from a git checkout and deployed with `git pull`. That
workflow, and the Pi's deploy key, are gone. Migrate with [005 quickstart](../../specs/005-continuous-delivery/quickstart.md) §3 step 4, which moves the
database and the environment file under the `production` instance and has its own back-out:

- **Back-out**: the old unit `mes-courses` and a copy of the database (`~/pre-005.db`) stay untouched
  until the new instance has passed its health check and a phone has synced. If it does not answer,
  stop `mes-courses@production` and the agent timer, move the database and the environment file back,
  start `mes-courses` and check `/v1/health` (FR-034).
- **Cleanup**, only after that: disable the old unit, remove `/etc/mes-courses.env` and the git
  checkout, and delete the deploy key with `gh repo deploy-key delete`.
