# Contract: the Pi's layout, units and agent configuration (FR-001, FR-002, FR-014)

The files under `deploy/` that the maintainer installs once, and the paths the agent owns. These
paths are part of the contract: the agent's adapters and the unit files must agree on them.

## Files in the repository

| File                                  | Installed as                                         | Replaces                    |
| ------------------------------------- | ---------------------------------------------------- | --------------------------- |
| `deploy/mes-courses@.service`         | `/etc/systemd/system/mes-courses@.service`           | `deploy/mes-courses.service` |
| `deploy/mes-courses.env.example`      | `/etc/mes-courses/<env>.env` (one per instance)      | `/etc/mes-courses.env`      |
| `deploy/mes-courses-agent.service`    | `/etc/systemd/system/mes-courses-agent.service`      | —                           |
| `deploy/mes-courses-agent.timer`      | `/etc/systemd/system/mes-courses-agent.timer`        | —                           |
| `deploy/agent.env.example`            | `/etc/mes-courses/agent.env` (600, root)             | —                           |
| `deploy/allowed_signers`              | `/etc/mes-courses/allowed_signers` (644, root)       | —                           |
| `deploy/Caddyfile`                    | `/etc/caddy/Caddyfile`                               | same file, two sites        |
| `deploy/fdroid/<variant>/…`           | not installed; read by CI (research R12)             | —                           |

## Paths on the Pi

```text
/etc/mes-courses/
├── production.env          # MES_COURSES_ENV=production, MES_COURSES_PORT=3000, mail, Sentry …
├── staging.env             # MES_COURSES_ENV=staging,    MES_COURSES_PORT=3001, …
├── agent.env               # GITHUB_REPOSITORY, GITHUB_TOKEN (read-only), SENTRY_DSN
└── allowed_signers
/opt/mes-courses/<env>/
├── releases/<sha>/         # unpacked server artifact
│   ├── apps/server/{dist,package.json,build-info.json}
│   ├── packages/sync-core/{dist,package.json}
│   ├── node_modules/
│   └── runtime -> /nix/store/…-nodejs-24…   # nix out-link, a GC root
└── current -> releases/<sha>
/opt/mes-courses/agent/
├── releases/<version>/     # the delivery bundle (dist + node_modules)
├── current -> releases/<version>
└── runtime -> /nix/store/…-nodejs-24…
/var/lib/mes-courses/<env>/
├── mes-courses.db          # owned by mes-courses-<env>, StateDirectory (0700)
└── backups/<UTC>-<sha>.db  # 5 most recent (research R9)
/var/lib/mes-courses-agent/<env>.json   # InstanceState (data-model)
/srv/fdroid/<env>/
├── <sha>/repo/             # unpacked repository, the current one and the previous one
└── current -> <sha>
```

## `mes-courses@.service` (changes from `mes-courses.service`)

```ini
User=mes-courses-%i
Group=mes-courses-%i
WorkingDirectory=/opt/mes-courses/%i/current/apps/server
EnvironmentFile=/etc/mes-courses/%i.env
ExecStartPre=/usr/bin/test -f /opt/mes-courses/%i/current/apps/server/dist/composition/main.js
ExecStart=/opt/mes-courses/%i/current/runtime/bin/node --conditions=production /opt/mes-courses/%i/current/apps/server/dist/composition/main.js
StateDirectory=mes-courses/%i
Environment=MES_COURSES_DB=/var/lib/mes-courses/%i/mes-courses.db
```

The mail check, `Restart=always` and the hardening lines are kept as they are.

## `mes-courses-agent.service` / `.timer`

- The service is `Type=oneshot`, runs `/opt/mes-courses/agent/runtime/bin/node
  /opt/mes-courses/agent/current/dist/main.js run`, and uses `EnvironmentFile=/etc/mes-courses/agent.env`
  and the sandbox of research R6.
- The timer uses `OnBootSec=2min`, `OnUnitActiveSec=2min` and `Persistent=true`.
- `systemctl start mes-courses-agent` runs one pass at once; it is the manual "deploy now".

## Agent command line

| Command                                        | Effect                                                      | Exit code              |
| ---------------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| `main.js run`                                  | One pass over staging, then production                      | 0 unless `broken`      |
| `main.js run --only <env>`                     | One pass over one environment                               | same                   |
| `main.js status`                               | Prints both `InstanceState`s and the health of each instance | 0                      |
| `main.js forget-failure <env> <sha>`           | Removes a commit from `failedCommits`, to retry it by hand  | 0, or 1 if unknown     |
| `main.js deploy-file <env> <server tarball>`   | Deploys a local server artifact through the same deployment and rollback path, without a manifest (no signature: only root can run it). For the rollback check (quickstart §10) and an emergency fix while GitHub is unreachable | 0 if `succeeded`, 1 otherwise |

CI-side commands of the same workspace, run with `yarn workspace @mes-courses/delivery …`:

| Command                                                         | Used by                         |
| --------------------------------------------------------------- | ------------------------------- |
| `write-manifest --env <env> --commit <sha> [--server <file>] [--fdroid <file>] [--version <v>]` | both delivery workflows |
| `release-gate --tag <vX.Y.Z> --commit <sha>`                    | `release.yml`'s `gate` job      |

## Caddy

```caddyfile
{$MES_COURSES_DOMAIN} {
	encode gzip
	handle_path /fdroid/* {
		root * /srv/fdroid/production/current
		file_server
	}
	reverse_proxy 127.0.0.1:3000
}

{$MES_COURSES_STAGING_DOMAIN} {
	encode gzip
	handle_path /fdroid/* {
		root * /srv/fdroid/staging/current
		file_server
	}
	reverse_proxy 127.0.0.1:3001
}
```

No new port: both sites share 80 and 443, which are already forwarded (003 quickstart §3).
