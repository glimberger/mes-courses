# Quickstart: validating `yarn release`

Prerequisites: Nix dev shell, `yarn install`, `gh auth status` OK, push rights.

1. Automated: `yarn workspace @mes-courses/delivery test`, `yarn typecheck`, `yarn lint`, `yarn format:check`, `yarn test:architecture`. All green, no network.
2. Refusals (no change): from a feature branch, with a dirty tree, and with `yarn release 0.0.1` -> each prints a reason and exits 1; `git status` and `git ls-remote --tags origin` unchanged.
3. Dry run: `yarn release patch --dry-run` on a clean up-to-date `main` -> prints `current -> next` and the planned steps; no new branch, PR or tag.
4. Decline: `yarn release minor`, answer `n` -> exits 0, nothing created.
5. Real release (maintainer, when one is due): `yarn release minor`, confirm. Observe the PR with auto-merge, the wait for `CI`, `E2E Android`, `Deliver staging`, then the tag and the `Release` run link.
6. Resume: interrupt (Ctrl-C) while waiting for the PR, run `yarn release <same version>` -> same PR reused, no second commit; once the tag exists it reports "already tagged".

Details: [contracts/cli.md](contracts/cli.md), [data-model.md](data-model.md).
