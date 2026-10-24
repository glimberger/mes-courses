# Contract: `yarn release` (two halves)

The command line contract is kept in one place, [009's contract](../../009-yarn-release-command/contracts/cli.md), which describes both commands:

```text
yarn release [major|minor|patch|X.Y.Z] [--yes|-y] [--dry-run]   deliver to staging
yarn release promote [--yes|-y] [--dry-run]                     send staging to production
```

Delta of this feature over 009:

| Case | Output | Exit |
| --- | --- | --- |
| Staging half done | `X.Y.Z is on staging (<sha>)` and how to promote; no tag | 0 |
| Staging half, dry run | `would stop with X.Y.Z on staging, for \`yarn release promote\`` | 0 |
| Promote, version not on staging | `X.Y.Z is not delivered to staging yet` | 1 |
| Promote, a required run not green | the failing rules | 1 |
| Promote, staging runs a later commit | `staging now runs <b>, not <a>: production gets <a>` then the confirmation | 0 / 1 |
| Promote, confirmed | `tagged vX.Y.Z on <sha>` and `Release run: <url>` | 0 |
| Promote with a bump or a version | usage error | 2 |

Confirmation texts: `Deliver X.Y.Z to staging?` and `Promote X.Y.Z (<sha>) to production?`.
