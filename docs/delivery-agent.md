# The delivery agent

How the program that deploys the server on the Pi works. The decisions behind it are in
[ADR-0006](adr/0006-pull-based-continuous-delivery.md),
[ADR-0008](adr/0008-signed-delivery-manifests.md),
[ADR-0010](adr/0010-two-instances-on-one-pi.md) and
[ADR-0011](adr/0011-stop-copy-validate-rollback.md); the paths and units are in
[the Pi layout](../specs/005-continuous-delivery/contracts/pi-layout.md), and the set-up steps in
the [README](../README.md#on-the-pi).

## In one paragraph

Nothing is pushed to the Pi. CI publishes a signed manifest and its assets as a GitHub release
(one channel per environment). A timer starts the agent every two minutes; it reads the channels
with a read-only token, verifies the signature, and brings each instance to what the manifest
says. A new server version is only opened to the phones once it has answered its health check
on a private port. If anything fails after the service was stopped, the previous release and the
database copy taken before the switch are put back.

## When it runs

`mes-courses-agent.timer` starts `mes-courses-agent.service` two minutes after boot, then every
two minutes. The service is a `oneshot` run as root: it does one pass over the environments and
exits. It is not a long-running process.

One pass handles **staging first, then production**. A problem in one never stops the other.

## One pass over an environment

1. **Recover.** If the state file is unreadable, it is moved aside (`<env>.json.corrupt`) and
   rebuilt from the installed release. If the state says a deployment was in flight (the agent or
   the Pi died in the middle of one), the previous release and database copy are put back first.
2. **Read the channel.** With `GITHUB_TOKEN`, it fetches the latest manifest and its signature
   from the environment's release. A failure is reported (a `401` or `403` says to check the
   token) and the pass for that environment ends.
3. **Verify the signature** against `/etc/mes-courses/allowed_signers`. A manifest that does not
   verify is refused. After three passes in a row, the failure is reported to Sentry.
4. **Check the manifest.** It must parse, be for this environment, not need a newer agent
   (`minAgentVersion`), and be newer than the last one handled (`sequence`). Otherwise the pass
   is `refused` or `unchanged`.
5. **Deploy the server** (see below), then **publish the F-Droid repository** if the manifest
   carries a new one.
6. **Remember the result.** The manifest counts as handled only if nothing failed. A failed
   commit is never retried.
7. **Check in to Sentry** (monitor `mes-courses-agent`): `ok`, or `error` if an instance was left
   degraded. A missing check-in is how a stopped timer or a dead Pi is noticed.

## Deploying a server release

A deployment skips a commit that already failed here, or whose sequence is not newer than the
one in service.

1. **Install** (the service is untouched): check the free disk space, download the asset, verify
   its SHA-256, unpack it into `/opt/mes-courses/<env>/releases/<commit>/`, and build the Node
   runtime with Nix. A failure here counts as a failed version: it is reported and not retried.
2. **Switch.** Record the deployment as in flight, stop the service, copy the database into
   `/var/lib/mes-courses/<env>/backups/` (the five latest copies are kept), point `current` at
   the new release, and start it on the **validation port** (3100 for production, 3101 for
   staging), reachable only on `127.0.0.1`.
3. **Validate.** `/v1/health` must report the expected commit within 60 seconds.
4. **Open.** Switch to the public port (3000 or 3001), restart, and check the health again for
   60 seconds. The phones never reach a version that has not passed step 3.
5. **Finish.** Save the new release in the state, clear the in-flight record, and prune old
   releases.

## When a deployment fails after the stop

The agent rolls back: it stops the service, restores the database copy, activates the previous
release on the public port and starts it, then waits for it to report its commit again.

- **Rolled back**: the failure is reported to Sentry (an error naming the commit), and the
  commit is marked failed.
- **Degraded**: the previous version fails too. The service is left up under systemd
  (`Restart=always`), a critical error is reported, and the agent exits with an error. An
  instance is never left stopped on purpose.

A fresh instance with no previous release has nothing to go back to: it is reported degraded.

## What it writes

| Path                                    | What                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `/var/lib/mes-courses-agent/<env>.json` | The state: commit in service, failed commits, last manifest, in-flight record |
| `/run/mes-courses/<env>.env`            | The validation port, for the length of a validation only                      |
| `/opt/mes-courses/<env>/`               | `releases/<commit>/` and the `current` link                                   |
| `/srv/fdroid/<env>/`                    | The F-Droid repository, served by Caddy                                       |

## Commands

The agent is run as root with the Node runtime it ships with (`main.js` below stands for
`/opt/mes-courses/agent/runtime/bin/node /opt/mes-courses/agent/current/apps/delivery/dist/composition/main.js`).

On the Pi, `~/.zshrc` of the maintainer defines a function so that `main.js` is typed as `agent`
(`agent status`, `agent deploy-file staging server-<sha>.tar.gz`). It must be a function, not a
variable: zsh does not word-split a variable holding a command. It loads `/etc/mes-courses/agent.env`
first, as the systemd unit does: without it the agent has no `SENTRY_DSN`, falls back to the
console reporter, and a failed `deploy-file` is printed in the terminal but never reaches Sentry
(so no failure e-mail). Nix is put on the `PATH` because `sudo` resets it, and `HOME` is set to
root's for the Nix tools.

```sh
agent() {
  sudo sh -c 'set -a; . /etc/mes-courses/agent.env; set +a
    exec env PATH="/nix/var/nix/profiles/default/bin:$PATH" HOME=/root \
      /opt/mes-courses/agent/runtime/bin/node \
      /opt/mes-courses/agent/current/apps/delivery/dist/composition/main.js "$@"' agent "$@"
}
```

| Command                               | What it does                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `main.js run [--only <env>]`          | One pass, as the timer does                                                                |
| `main.js status`                      | The commit each instance runs, the failed commits, the last pass                           |
| `main.js forget-failure <env> <sha>`  | Clears the failed mark of a commit, so it can be delivered again                           |
| `main.js deploy-file <env> <tarball>` | Deploys `server-<sha>.tar.gz` from the disk, with no manifest and no signature (see below) |

`deploy-file` is the one documented exception to the signature check, usable only by root on the
Pi. It follows the same install, validation and rollback path. Use it for the first production
release (the channel is empty until the first tag) and for the rollback tests. It records the
sequence in service plus one so the deployment counts as newer, then puts the old sequence back,
so the next real delivery is not skipped.

## Updating the agent

The agent never updates itself. The bundle `delivery-<version>.tar.gz` is attached to each release
(`release.yml`). Download it with the read-only token, unpack it into
`/opt/mes-courses/agent/releases/<version>/`, point `current` at it, rebuild the runtime with the
revision in the bundle's `nixpkgs-rev`, and check with `main.js status`
([quickstart §7](../specs/005-continuous-delivery/quickstart.md)).

## Where to look when something is wrong

- `journalctl -u mes-courses-agent -n 100`: the agent's own output.
- `journalctl -u mes-courses@<env> -n 100`: the server of one instance.
- `main.js status`: what is running, what failed, and when the channel was last read.
- Sentry, tag `component:delivery-agent`: every error the agent reports, and the monitor.
