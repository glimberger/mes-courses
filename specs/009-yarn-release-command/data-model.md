# Data Model: One-Command Release

All types live in `apps/delivery/src/domain/release-plan.ts` unless noted. No persistence.

## ReleaseRequest
- `target`: `{ kind: 'bump'; bump: 'major' | 'minor' | 'patch' } | { kind: 'version'; version: string } | { kind: 'ask' }`
- `assumeYes: boolean`, `dryRun: boolean`
- Validation: an explicit version matches `^\d+\.\d+\.\d+$` (no `-staging.n`), parses with `parseSemver`, and `compareSemver(version, current) > 0`.
- `nextVersion(current, bump)`: major -> `M+1.0.0`, minor -> `M.m+1.0`, patch -> `M.m.p+1`.

## ReleaseState (observed, never stored)
- `mainVersion: string` (app version on `origin/main`)
- `localTag: string | null`, `remoteTag: string | null` (commit each points to)
- `bumpPr: { state: 'open' | 'merged' | 'closed'; url: string; mergeCommit: string | null; checksFailed: boolean } | null`
- `releaseCommit: string | null` (commit of `origin/main` that set the target version)
- `runs`: for each of `CI`, `E2E Android`, `Deliver staging` (`REQUIRED_WORKFLOWS`) on `releaseCommit`: `{ state: 'success' | 'failed' | 'pending'; url: string | null }`
- `productionVersion: string | null` (existing `ChannelSource` + `parseManifest`)

## ReleaseStep (result of `decideStep(version, state)`)
`done` (tag already on the right commit) | `tag` | `wait-runs` | `stop-run-failed {url}` | `wait-merge` | `stop-pr-failed {url}` | `stop-pr-closed {url}` | `open-bump`.
Transitions: `open-bump -> wait-merge -> wait-runs -> tag -> done`; any `stop-*` ends the run, a rerun re-derives the step.

## Rules
- `checkPrerequisites({branch, clean, upToDate})` -> refusal messages (FR-001).
- `checkNewVersion({version, mainVersion, productionVersion, tagExists})` -> refusal messages (FR-004, FR-006), built on `compareSemver` and `evaluateRelease`; the re-check before tagging is the full `evaluateRelease`.
- `readAppVersion(source)` / `setAppVersion(source, next)` on the text of `app.config.ts`.

## Ports (application/ports)
- `ReleaseRepository`: `currentBranch`, `isClean`, `fetch`, `isUpToDate`, `appVersionAt(ref)`, `tagCommit(tag)`, `commitBump(version)` (branch, commit, push), `createTag(tag, sha)`, `pushTag(tag)`, `releaseCommit(version)`.
- `ReleasePullRequests`: `findBump(branch)`, `open(branch, title)`, `enableAutoMerge(pr)`.
- `ReleaseRuns`: `requiredRuns(sha)`, `releaseRunUrl(sha)`.
- `Prompter`: `ask(question)`, `confirm(question)`.
- Reused: `CommandRunner`, `ChannelSource`.
