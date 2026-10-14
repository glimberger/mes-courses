# Contract: channel manifest (FR-017, FR-018, FR-030)

The only interface between GitHub and the Pi. CI writes it, and the agent reads it. Its fields
and validation rules are in [data-model.md](../data-model.md#channelmanifest).

## Location

Release assets of the rolling prerelease `channel-<environment>` on the repository:

| Asset                        | Content                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `manifest.json`              | The manifest, UTF-8 JSON                                        |
| `manifest.json.sig`          | `ssh-keygen -Y sign -n mes-courses-deploy` signature of it      |
| `server-<sha>.tar.gz`        | Server artifact (research R3), up to 3 commits kept             |
| `fdroid-<env>-<sha>.tar.gz`  | The generated `repo/` folder (research R12), up to 3 kept       |

The agent reads them through the REST API with its read-only token:

1. `GET /repos/{owner}/{repo}/releases/tags/channel-<environment>` → the asset list;
2. `GET /repos/{owner}/{repo}/releases/assets/{id}` with `Accept: application/octet-stream`.

## Example (staging, after an app-only change)

```json
{
  "schema": 1,
  "environment": "staging",
  "sequence": 412,
  "commit": "b7e0…40 hex",
  "version": "1.2.0-staging.412",
  "createdAt": "2026-10-20T08:14:03Z",
  "run": { "id": 18452231, "url": "https://github.com/glimberger/mes-courses/actions/runs/18452231" },
  "minAgentVersion": "1.0.0",
  "server": {
    "commit": "a51c…40 hex",
    "sequence": 409,
    "version": "1.2.0-staging.409",
    "asset": "server-a51c….tar.gz",
    "sha256": "9d4e…64 hex",
    "nixpkgsRev": "e3b7…40 hex"
  },
  "fdroid": {
    "commit": "b7e0…40 hex",
    "versionCode": 412,
    "asset": "fdroid-staging-b7e0….tar.gz",
    "sha256": "0c2f…64 hex"
  }
}
```

## Writing rules (CI, `apps/delivery`'s `write-manifest` command)

- It starts from the channel's current manifest, if any, and replaces only the entries of the
  targets this run built (research R2). With no current manifest and no server built, it fails:
  a channel's first manifest needs a server.
- In production, `version` is the tag's version, and `server.version` equals it.
- Upload order: the assets, then `manifest.json.sig`, then `manifest.json`. An agent that reads
  between the last two finds a signature that does not match, reports nothing (it retries on its
  next run) and deploys nothing. The agent reports a mismatch only after it has persisted for
  three runs.
- Then it prunes the assets no longer referenced by the last three manifests.

## Reading rules (agent)

In this order, stopping at the first failure:

1. verify the signature against `allowed_signers` with the `mes-courses-deploy` namespace;
2. parse and validate (data-model). `environment` must equal the channel;
3. refuse if `minAgentVersion` is above the agent's own version;
4. ignore if `sequence ≤ InstanceState.manifestSequence`;
5. download each needed asset, then check its SHA-256 before unpacking it. Unpack with
   `tar --no-same-owner --no-same-permissions` into a fresh folder, and refuse any member whose
   path is absolute or contains `..`.
