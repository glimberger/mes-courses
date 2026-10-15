# ADR-0008: Deliveries are proven by an SSH-signed manifest

- **Status**: Proposed
- **Date**: 2026-10-15
- **Decided by**: proposed by the agent, approved by the maintainer
- **Supersedes**: none
- **Related**: [005 research](../../specs/005-continuous-delivery/research.md) R5, R16;
  [ADR-0006](0006-pull-based-continuous-delivery.md)

## Context

The Pi downloads what CI built ([ADR-0006](0006-pull-based-continuous-delivery.md)) with a
read-only token. A token that can download is not proof that the content comes from CI: whoever
can write to the release assets would get code onto the Pi. The Pi needs a check that does not
depend on the download channel, and the repository is private.

## Decision

We sign each channel manifest in CI with an Ed25519 SSH key (`ssh-keygen -Y sign`, namespace
`mes-courses-deploy`). The Pi verifies the signature with `ssh-keygen -Y verify` against an
`allowed_signers` file, then checks the SHA-256 of every asset against the manifest. The private
key is the GitHub secret `DEPLOY_SIGNING_KEY`. The public key is committed in
`deploy/allowed_signers` and installed on the Pi.

## Consequences

- No new tool: OpenSSH is already on the runner and on the Pi.
- The signature proves the manifest comes from a holder of the CI secret. The manifest records
  the commit and the workflow run, so a delivery can be traced.
- Anyone who can run a workflow with this repository's secrets can still deliver code. This
  risk is accepted: delivered code runs only as the sandboxed user of its instance, never with
  the agent's privileges.
- Rotating the key means committing a new `allowed_signers` and updating the Pi by hand.

## Alternatives considered

- **GitHub artifact attestations**: the native answer, but they require GitHub Enterprise Cloud
  on a private repository.
- **minisign or cosign**: the same guarantee for one more tool on both sides.
- **Checksums without a signature**: they would trust whatever the token can download.
- **GPG**: a heavier key management story for no gain.
