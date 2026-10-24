# Architecture Decision Records

An ADR records one decision that shapes the whole repository, why it was made, and what else was
considered. It is short and stable: once accepted, an ADR is not rewritten. A later change of mind
is a new ADR that supersedes the old one.

## Where a decision goes

| It is…                                                        | It goes in…                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A rule every change must follow (a principle or quality gate) | [`constitution.md`](../../.specify/memory/constitution.md), by amendment |
| A choice that outlives one feature (stack, layout, tooling)   | An ADR in this folder                                                    |
| A choice that only matters inside one feature                 | The feature's `research.md` (`specs/NNN-…/research.md`), as an `R` entry |
| A deviation from the constitution, justified for one plan     | The plan's Complexity Tracking table                                     |

An ADR explains why; the constitution says what is required. When an ADR needs a rule to be
enforced, the rule goes into the constitution too, and the ADR links to the principle.

`research.md` keeps the operational detail (versions, commands, upgrade notes, CI settings). An
ADR keeps the decision and its reasons, and the `R` entry links to it.

## Writing one

1. Copy [`0000-template.md`](0000-template.md) to `NNNN-short-title.md`, with the next free number.
2. Fill it in English. Keep it to one page: context, decision, consequences, alternatives.
3. Set the status to `Proposed`, open a pull request, and set it to `Accepted` when the
   maintainer approves it.
4. To change an accepted decision, write a new ADR. Set the old one to
   `Superseded by [ADR-NNNN](NNNN-…)`, and give the new one `Supersedes`.

The plan template (`/speckit-plan`) has an Architecture Decisions section that lists the ADRs a
plan creates, supersedes or relies on.

## Index

| ADR                                            | Title                                            | Status             |
| ---------------------------------------------- | ------------------------------------------------ | ------------------ |
| [0001](0001-react-native-expo.md)              | React Native with Expo                           | Accepted           |
| [0002](0002-yarn-workspaces-monorepo.md)       | Yarn workspaces monorepo                         | Superseded by 0013 |
| [0013](0013-pnpm-workspaces-monorepo.md)       | pnpm workspaces monorepo                         | Accepted           |
| [0003](0003-storybook-on-device.md)            | Screen validation with on-device Storybook       | Accepted           |
| [0004](0004-detox-end-to-end-tests.md)         | End-to-end tests with Detox                      | Accepted           |
| [0005](0005-accounts-and-authentication.md)    | Accounts in one database; scrypt passwords       | Accepted           |
| [0006](0006-pull-based-continuous-delivery.md) | Delivery built in Actions, pulled by the Pi      | Accepted           |
| [0007](0007-android-fdroid-distribution.md)    | Android through a self-hosted F-Droid repository | Accepted           |
| [0008](0008-signed-delivery-manifests.md)      | Deliveries proven by an SSH-signed manifest      | Accepted           |
| [0009](0009-version-identity-from-git.md)      | Version identity is the commit count on `main`   | Accepted           |
| [0010](0010-two-instances-on-one-pi.md)        | Two instances of one systemd template unit       | Accepted           |
| [0011](0011-stop-copy-validate-rollback.md)    | Stop, copy, validate, then open; rollback        | Accepted           |
| [0012](0012-material-symbols-icons.md)         | Material Symbols Rounded as the icon set         | Accepted           |
