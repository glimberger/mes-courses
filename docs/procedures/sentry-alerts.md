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
