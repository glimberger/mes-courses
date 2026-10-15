# Contract: `GET /v1/health` reports the release (FR-029)

The endpoint of 003 stays public and unauthenticated. Its body gains one field, `release`. Every
other response keeps the identity of 003 and 004 unchanged: `release` is added to the health body
only, not to the identity hook.

## Response `200`

```json
{
  "serverId": "6f1c…",
  "apiVersion": 1,
  "minAppVersion": "1.1.0",
  "release": {
    "version": "1.2.0",
    "commit": "3f9a2c1e0b…"
  }
}
```

| Field             | Type   | Value                                                                                   |
| ----------------- | ------ | --------------------------------------------------------------------------------------- |
| `release.version` | string | `build-info.json`'s `version`: `X.Y.Z` in production, `X.Y.Z-staging.<sequence>` in staging; `package.json`'s version without the file |
| `release.commit`  | string | `build-info.json`'s `commit` (40 hex characters); `"dev"` without the file              |

`release` holds nothing else: no environment name, no host, no path, no dependency versions
(spec FR-029, "without revealing anything else").

## Consumers

- The Pi agent's health probe: a deployment succeeds when `release.commit` equals the commit it
  installed (data-model "Deployment").
- `release.yml`'s `wait-production-health` job, through the public address (research R15).
- The maintainer, for US5: `curl https://courses.<domain>/v1/health`.
- The app ignores unknown fields (003 R12), so older apps are unaffected.

## Tests (written first)

- with a `build-info.json`, the body's `release` equals its `version` and `commit`;
- without the file, `release` is `{ version: <package.json version>, commit: "dev" }`;
- another route's body has no `release` field;
- `serverRelease()` (Sentry) uses the same version.
