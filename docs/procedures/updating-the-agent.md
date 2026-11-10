# Updating the agent

The agent updates through the release, never by itself. Version 1.1.0 is required by every manifest
since [ADR-0015](../adr/0015-production-reuses-the-staging-server-artifact.md): the server archives
no longer hold `build-info.json`, the agent writes it. Download the asset
`delivery-<version>.tar.gz` of the release with the read-only token, unpack it into
`/opt/mes-courses/agent/releases/<version>/`, point `current` at it, rebuild the runtime with the
revision in the bundle's `nixpkgs-rev`, and check with `main.js status` ([005 quickstart](../../specs/005-continuous-delivery/quickstart.md) §7; `main.js` is the agent entry point run as root, see [Rollback](rollback.md)).
