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

Group order: breaking, features, fixes, performances; empty groups omitted. Link base: the repository URL read from git-cliff's context (`remote`) or the `origin` URL, to settle in the first Red step (see [contracts/changelog-data.md](contracts/changelog-data.md)).

## Operations (domain functions)

- `parseContext(json)` -> `ChangelogSection` (given version and date): maps cliff groups to the four arrays, extracts `(#N)`.
- `renderMarkdownSection(section)` -> string; `renderDocument(sections)` -> string.
- `upsertSection(sections, section)` -> sections: replaces the same version, else puts it first.
- `upsertMarkdown(document, section)`: replaces the `## [X.Y.Z]` block or inserts after the title; creates the document when empty.
- `serializeData(sections)` -> string (2-space JSON, final newline).

## Port

`ChangelogGenerator.generate(version: string, date: string): Promise<ChangelogSection>`; throws with a reason when the tool is missing or the config is bad. `ReleaseRepository.commitBump(version, branch, section)` gains the section.
