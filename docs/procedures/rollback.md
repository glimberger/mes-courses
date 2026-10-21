# Rollback and failed deployments

A deployment that fails after the instance was stopped is rolled back by the agent: the previous
release runs again on the copy of the database taken before the switch, the failure is reported
to Sentry with the commit, and that commit is marked failed so the next passes do not retry it.
If the previous version also fails, the instance is left up under systemd and a critical error is
reported ([ADR-0011](../adr/0011-stop-copy-validate-rollback.md)).

The agent is `/opt/mes-courses/agent/runtime/bin/node /opt/mes-courses/agent/current/apps/delivery/dist/composition/main.js`
(called `main.js` below), run as root:

| Command                              | What it does                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `main.js status`                     | Shows the commit each instance runs, the failed commits, the last run |
| `main.js forget-failure <env> <sha>` | Clears the failed mark of a commit so it can be delivered again       |
| `main.js deploy-file <env> <tar>`    | Deploys a server tarball from the disk, for the rollback tests        |

A failed commit is not retried: fix it forward with a new commit, or run `forget-failure` when the
cause was the Pi and not the code. The five latest database copies are in
`/var/lib/mes-courses/<env>/backups/`.
