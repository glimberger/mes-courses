# Contract: `changelog.json` and `CHANGELOG.md`

Consumed by #203 and #204 (app screens). Covered by a domain test; a change here is a change for those features.

## `apps/mobile/src/changelog/changelog.json`

```json
[
  {
    "version": "2.1.0",
    "date": "2026-11-02",
    "features": [{ "text": "add dark mode to settings", "pr": 190 }],
    "fixes": [{ "text": "keep the quantity on sync", "pr": null }],
    "performances": [],
    "breaking": []
  }
]
```

- Array, newest first; `version` unique, `X.Y.Z`.
- Four arrays always present; entries `{ text: string, pr: number | null }`.
- The file is generated; never edited by hand. Written with 2-space indentation and a final newline.

## `CHANGELOG.md`

- Title `# Changelog`, then sections newest first.
- Heading `## [X.Y.Z] - YYYY-MM-DD`; group headings `### Changements incompatibles`, `### Nouveautés`, `### Corrections`, `### Performances` (this order, empty groups omitted).
- Entry: `- text ([#N](<url>/pull/N))`, or `- text` without a number.
- A section with no entry holds `No user-facing changes.`
- The notes script matches on `## [X.Y.Z]` up to the next `## [`.
