# Sentry alerts (FR-030c)

Set once in the Sentry project, and checked once by [001 quickstart](../../specs/001-shopping-lists/quickstart.md) §6 step 7:

- two issue alert rules, both filtered on the `production` environment and emailing the
  maintainer: "A new issue is created" and "The issue changes state from resolved to
  unresolved";
- the default alert rule Sentry created with the project, deleted;
- the maintainer's personal workflow notifications, turned off, so no other email arrives.

`staging` builds match no rule.

A third rule covers the delivery agent ([005 quickstart](../../specs/005-continuous-delivery/quickstart.md) §3 step 6): an issue alert on the tag
`component:delivery-agent`, in every environment, for new issues and monitor issues, emailing the
maintainer. It is how a failed staging deployment, a degraded instance, a revoked token and a
silent agent (the missed check-in of the monitor `mes-courses-agent`) reach the maintainer.

A manifest the agent refuses (invalid, for the wrong channel, or needing a newer agent than the
installed one, `minAgentVersion`) makes that pass check in `error` to the monitor
`mes-courses-agent`, on top of the one grouped issue it reports. The grouped issue alerts once;
the failing monitor keeps the problem visible for as long as the refusal lasts. Early signature
mismatches (fewer than three passes) still check in `ok`.

Manual check, once, in the Sentry UI: open the monitor `mes-courses-agent` and look at its failure
tolerance (the number of consecutive failed check-ins before it raises an issue). The agent runs
every 2 minutes, so a tolerance of 1 to 3 means an email within minutes; a higher value delays
the alert accordingly. Confirm the alert rule above covers monitor issues.
