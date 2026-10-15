# ADR-0006: Continuous delivery is built in GitHub Actions and pulled by the Pi

- **Status**: Accepted
- **Date**: 2026-10-14
- **Decided by**: maintainer (constraints), proposed by the agent (design)
- **Supersedes**: none
- **Related**: [005 research](../../specs/005-continuous-delivery/research.md) R1 to R10, R15,
  R16; constitution Principles I, VI, VII, VIII and XI, Quality Gates;
  [ADR-0007](0007-android-fdroid-distribution.md)

## Context

Every delivery was manual: `eas build` and `eas submit` from the maintainer's machine, and on the
Pi `git pull`, a build and a restart. There was one server instance, used by real people, so a
change could not be tried on a server before it reached them. The maintainer set the constraints:
a staging server as a second instance on the same Pi, deliveries the Pi fetches itself, no new
inbound port, and no credential in GitHub that can reach the Pi.

## Decision

We deliver in two **channels**, staging and production. Every green CI run on `main` delivers
to staging, and a `vX.Y.Z` tag delivers to production after a gate. The gate requires CI, the
Android device suite and the staging delivery to be green on that commit.

GitHub Actions **builds** everything: an architecture-independent server tarball, and the
Android APK and F-Droid repository ([ADR-0007](0007-android-fdroid-distribution.md)). It
publishes them as assets of a rolling GitHub release per channel, next to a **manifest signed
with an SSH key** that the Pi trusts.

On the Pi, a **deployment agent** fetches the manifests over outbound HTTPS with a read-only,
single-repository token. The agent is a TypeScript workspace, `apps/delivery`, run by a systemd
timer. It verifies the signature and checksums, installs each server release next to the
previous one, copies the database with the service stopped, switches, checks health, and rolls
back on failure. The two instances run from one systemd template unit, with separate users,
data and ports, behind the existing Caddy.

## Consequences

- No one logs in to the Pi to deploy. The Pi no longer needs a checkout of the repository, Yarn
  or a deploy key, only Nix (for Node), Caddy and the agent.
- Anyone who can run a workflow with this repository's secrets can deliver code to the Pi. That
  code runs only as its instance's sandboxed user, never with the agent's privileges.
- Deployment logic is code with tests, covered by the constitution's gates, rather than
  workflow YAML.
- The read-only token expires at most after a year and must be renewed. The agent reports
  failures through Sentry.
- The server must stay free of native modules, so that a build from x86_64 runs on the Pi.
  A CI check enforces this.
- The agent is updated by hand, which rarely happens.

## Alternatives considered

- **Push over SSH from GitHub**: excluded by the constraints. GitHub would hold a key to the Pi.
- **A self-hosted runner on the Pi**: GitHub could run arbitrary jobs there. That is the same
  exposure.
- **Containers (GHCR, Watchtower)**: a container runtime on the Pi to run one Node process that
  systemd already sandboxes.
- **Building on the Pi from `git pull`**: what was done before. It needs a credential that can
  read all of the repository, and the code that runs is not CI's build.
- **GitHub artifact attestations** instead of an SSH signature: they require GitHub Enterprise
  Cloud on a private repository.
