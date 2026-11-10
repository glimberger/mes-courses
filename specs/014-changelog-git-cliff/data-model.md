# Data Model: Changelog

Types of `apps/delivery/src/domain/changelog.ts` (pure, no I/O).

## ChangelogEntry

| Field | Type | Rule |
| --- | --- | --- |
| `text` | string | commit subject as written, without the `type(scope):` prefix and without the trailing `(#N)` |
| `pr` | number or null | the `N` of a trailing `(#N)`, else `null` |

## ChangelogSection

| Field | Type | Rule |
| --- | --- | --- |
| `version` | string | `X.Y.Z`, no `v` |
| `date` | string | `YYYY-MM-DD`, the bump day from the clock |
| `features` | ChangelogEntry[] | group `features` ("Nouveautés") |
| `fixes` | ChangelogEntry[] | group `fixes` ("Corrections") |
| `performances` | ChangelogEntry[] | group `performances` ("Performances") |
| `breaking` | ChangelogEntry[] | group `breaking` ("Changements incompatibles"); a breaking commit is only here, not duplicated in its type group |

Empty groups are `[]`. A section whose four groups are empty renders the single line `No user-facing changes.` in the markdown; the data keeps the four empty arrays.

## Changelog data (`changelog.json`)

`ChangelogSection[]`, newest first, one section per version (unique `version`).

## Changelog document (`CHANGELOG.md`)

```text
# Changelog

## [X.Y.Z] - YYYY-MM-DD

### Changements incompatibles
- text ([#N](<repository>/pull/N))

### Nouveautés
...
```

Group order: breaking, features, fixes, performances; empty groups omitted. Link base (settled at the first Red step): the constant `REPOSITORY_URL` (`https://github.com/glimberger/mes-courses`) of `domain/changelog.ts`. git-cliff 2.13's context has `remote: null` unless a `[remote.github]` is configured, and the `origin` URL is an SSH URL on the maintainer's machine; the repository is a single, fixed one (see [contracts/changelog-data.md](contracts/changelog-data.md)).

Markdown escaping: in an entry, `\ * _ [ ] < >` are backslash-escaped outside code spans; code spans (backticks) are kept as written. `changelog.json` keeps the text as written.

## Operations (domain functions)

- `parseContext(json)` -> `ChangelogSection` (given version and date): maps cliff groups to the four arrays, extracts `(#N)`.
- `renderMarkdownSection(section)` -> string; `renderDocument(sections)` -> string.
- `upsertSection(sections, section)` -> sections: replaces the same version, else puts it first.
- `upsertMarkdown(document, section)`: replaces the `## [X.Y.Z]` block or inserts after the title; creates the document when empty.
- `serializeData(sections)` -> string (2-space JSON, final newline).

## Port

`ChangelogGenerator.generate(version: string, date: string): Promise<ChangelogSection>`; throws with a reason when the tool is missing or the config is bad. `ReleaseRepository.commitBump(version, branch, section)` gains the section.
