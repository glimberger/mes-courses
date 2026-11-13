# Updating the agent

The agent updates through the release, never by itself. Version 1.1.0 is required by every manifest
since [ADR-0015](../adr/0015-production-reuses-the-staging-server-artifact.md): the server archives
no longer hold `build-info.json`, the agent writes it. Download the asset
`delivery-<version>.tar.gz` of the release with the read-only token, unpack it into
`/opt/mes-courses/agent/releases/<version>/`, point `current` at it, rebuild the runtime with the
revision in the bundle's `nixpkgs-rev`, and check with `main.js status` ([005 quickstart](../../specs/005-continuous-delivery/quickstart.md) §7; `main.js` is the agent entry point run as root, see [Rollback](rollback.md)).

## One command

From the repository, on the maintainer's Mac:

```sh
pnpm agent:update --dry-run          # prints the plan, changes nothing
pnpm agent:update                    # installs the agent of the latest release
pnpm agent:update --version 2.3.0    # installs the agent of release v2.3.0
```

It drives the Pi over `ssh agent-pi` (`--host` or `AGENT_UPDATE_HOST` for another destination; the
steps run as root through `sudo` on the Pi). The release and its
`delivery-<agent version>.tar.gz` asset are found with your `gh` session. On the Pi, the bundle is
downloaded with the read-only token read from `/etc/mes-courses/agent.env`: the token never leaves
the Pi, is not printed and is not on any command line (the script travels on ssh's standard input
and curl reads its header from a pipe). Then, in this order:

1. unpack into `/opt/mes-courses/agent/releases/<agent version>/`;
2. build the Node runtime from the bundle's `nixpkgs-rev` into `releases/<agent version>/runtime`;
3. only then point `runtime` and `current` at that release (two atomic renames);
4. run `main.js status` and print it.

If the login needs a password for `sudo`, the command first checks with `sudo -n true`, then asks for
that password once, hidden, on your terminal. It is kept in memory only and travels on ssh's
standard input to `sudo -S`: it is never on a command line, in a log or in an error. A wrong
password stops the command before any change; without a terminal it fails instead of waiting. With
passwordless `sudo` nothing is asked. Run the command as your normal user, never with `sudo` (as
root, ssh uses root's keys and `known_hosts`): it refuses to start as root.

A failure before step 3 leaves `current` untouched, and a folder left half-unpacked by an earlier
run is not an install: it is unpacked again from scratch. Running it again with the installed
version does nothing (it only prints the status). Previous release folders are kept: to go back,
point `current` at the previous `releases/<version>/`. For a release installed by this command, also
point `runtime` at its `releases/<version>/runtime`. A release installed by hand before this command
has no runtime of its own: activation repointed `agent/runtime` (the hand-made `nix build --out-link`,
which was its GC root) at the new release, so the old Node store path is no longer kept alive. Point
back only `current` and keep the new `runtime`, which runs any release.

Then check on the Pi: `main.js status` shows the new version, and `journalctl -u mes-courses-agent -n 50`
shows a clean pass at the next timer run.

The manual steps below are what the command does, for a Pi that cannot be reached over ssh.

## Update the agent before raising `minAgentVersion`

A manifest carries `minAgentVersion`, and an agent that is older refuses the manifest and deploys
nothing. So the agent on the Pi must be updated **before** the change that raises that value
reaches a channel:

1. Release the agent version that the new requirement names, without raising the requirement in
   that same change.
2. Install that agent on the Pi with the steps above, and check with `main.js status`.
3. Only then merge or release the change that raises `minAgentVersion` (in
   `apps/delivery/src/composition/ci.ts`).

The agent bundle ships only attached to a release (`release.yml`, `pack-agent.sh`). A release
therefore cannot carry its own new agent and require it at once: the manifest it publishes would
be refused by the agent still installed, the Pi would stay on the previous server, and the first
sign would be a failed `wait-health`. Raise the requirement one release after the agent that
satisfies it. See [ADR-0015](../adr/0015-production-reuses-the-staging-server-artifact.md) for the
case that raised it to 1.1.0.

Symptoms of getting it wrong: Sentry reports "The `<env>` manifest needs agent X or newer; this is
Y", the monitor `mes-courses-agent` checks in `error` on every pass, and `wait-health` times out
naming the version the server still reports. The fix is to install the agent the message names.
