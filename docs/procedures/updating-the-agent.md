# Updating the agent

The agent updates through the release, never by itself. Version 1.1.0 is required by every manifest
since [ADR-0015](../adr/0015-production-reuses-the-staging-server-artifact.md): the server archives
no longer hold `build-info.json`, the agent writes it. Download the asset
`delivery-<version>.tar.gz` of the release with the read-only token, unpack it into
`/opt/mes-courses/agent/releases/<version>/`, point `current` at it, rebuild the runtime with the
revision in the bundle's `nixpkgs-rev`, and check with `main.js status` ([005 quickstart](../../specs/005-continuous-delivery/quickstart.md) §7; `main.js` is the agent entry point run as root, see [Rollback](rollback.md)).

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
