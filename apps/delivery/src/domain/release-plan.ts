import { checkAboveProduction, REQUIRED_WORKFLOWS } from './release-rules';
import { compareSemver } from './semver';

export type Bump = 'major' | 'minor' | 'patch';

export type ReleaseTarget =
  | { kind: 'bump'; bump: Bump }
  | { kind: 'version'; version: string }
  | { kind: 'ask' };

const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** The version after `current` for a bump type; `current` must be `X.Y.Z`. */
export const nextVersion = (current: string, bump: Bump): string => {
  const match = RELEASE_VERSION.exec(current);
  if (match === null)
    throw new Error(`Not a release version: ${JSON.stringify(current)}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

/** What the command argument asks for; anything but a bump type is an explicit version to validate. */
export const parseTarget = (arg: string | undefined): ReleaseTarget => {
  if (arg === undefined) return { kind: 'ask' };
  if (arg === 'major' || arg === 'minor' || arg === 'patch')
    return { kind: 'bump', bump: arg };
  return { kind: 'version', version: arg };
};

/** Every reason an explicit version cannot be released on top of `current`. */
export const validateExplicitVersion = (
  version: string,
  current: string,
): string[] => {
  if (!RELEASE_VERSION.test(version)) {
    return [
      `The version ${version} is not of the form X.Y.Z (for example ${nextVersion(current, 'minor')})`,
    ];
  }
  if (compareSemver(version, current) <= 0) {
    return [
      `The version ${version} is not higher than the current version ${current}`,
    ];
  }
  return [];
};

const VERSION_LINE = /^(\s*version: ')(\d+\.\d+\.\d+)(',?)$/gm;

const singleVersionMatch = (source: string): RegExpMatchArray => {
  const matches = [...source.matchAll(VERSION_LINE)];
  if (matches.length === 0)
    throw new Error("Found no version: 'X.Y.Z' line in app.config.ts");
  const [match, ...others] = matches;
  if (match === undefined || others.length > 0)
    throw new Error(
      "Found several version: 'X.Y.Z' lines in app.config.ts, expected one",
    );
  return match;
};

/** The app version written in the text of `apps/mobile/app.config.ts`. */
export const readAppVersion = (source: string): string =>
  singleVersionMatch(source)[2] ?? '';

/** `source` with its single `version: 'X.Y.Z'` line set to `next`. */
export const setAppVersion = (source: string, next: string): string => {
  singleVersionMatch(source);
  return source.replace(VERSION_LINE, `$1${next}$3`);
};

export type RunOutcome = {
  workflow: string;
  state: 'success' | 'failed' | 'pending';
  url: string | null;
};

export type BumpPullRequest = {
  state: 'open' | 'merged' | 'closed';
  url: string;
  mergeCommit: string | null;
  checksFailed: boolean;
};

/** What the world looks like right now; observed on every run, never stored. */
export type ReleaseState = {
  /** The app version on `origin/main`. */
  mainVersion: string;
  /** The commit each tag `vX.Y.Z` points to, or null when it does not exist. */
  localTag: string | null;
  remoteTag: string | null;
  bumpPr: BumpPullRequest | null;
  /** The commit of `origin/main` that set the target version. */
  releaseCommit: string | null;
  /** One entry per required workflow on `releaseCommit`; a missing one counts as pending. */
  runs: RunOutcome[];
  productionVersion: string | null;
};

export type ReleaseStep =
  | { step: 'done' }
  | { step: 'tag' }
  | { step: 'wait-runs' }
  | { step: 'wait-merge' }
  | { step: 'open-bump' }
  | { step: 'stop-run-failed'; url: string | null }
  | { step: 'stop-pr-failed'; url: string }
  | { step: 'stop-pr-closed'; url: string }
  | { step: 'stop-tag-elsewhere'; tag: string; commit: string };

/** The next thing to do for `version`, derived only from what is observed (resumable by design). */
export const decideStep = (
  version: string,
  state: ReleaseState,
): ReleaseStep => {
  const tag = `v${version}`;
  const existing = state.remoteTag ?? state.localTag;
  if (existing !== null) {
    return existing === state.releaseCommit
      ? { step: 'done' }
      : { step: 'stop-tag-elsewhere', tag, commit: existing };
  }

  // The bump is on main once a commit of main set the version, even if main moved on since.
  if (state.releaseCommit !== null) {
    const failed = state.runs.find((run) => run.state === 'failed');
    if (failed !== undefined)
      return { step: 'stop-run-failed', url: failed.url };
    const succeeded = REQUIRED_WORKFLOWS.every((workflow) =>
      state.runs.some(
        (run) => run.workflow === workflow && run.state === 'success',
      ),
    );
    return { step: succeeded ? 'tag' : 'wait-runs' };
  }

  const pr = state.bumpPr;
  if (pr === null) return { step: 'open-bump' };
  if (pr.state === 'merged') return { step: 'wait-runs' };
  if (pr.state === 'closed') return { step: 'stop-pr-closed', url: pr.url };
  if (pr.checksFailed) return { step: 'stop-pr-failed', url: pr.url };
  return { step: 'wait-merge' };
};

/** Every reason the checkout cannot start a release, so one fix-up covers them all (FR-001). */
export const checkPrerequisites = (facts: {
  branch: string;
  clean: boolean;
  upToDate: boolean;
}): string[] => {
  const reasons: string[] = [];
  if (facts.branch !== 'main')
    reasons.push(`You are on ${facts.branch}: switch to main`);
  if (!facts.clean)
    reasons.push('There are uncommitted changes: commit or stash them');
  if (!facts.upToDate)
    reasons.push('main differs from origin/main: pull or push it first');
  return reasons;
};

/** Every reason a version cannot be started as a new release (FR-004, FR-006). */
export const checkNewVersion = (facts: {
  version: string;
  mainVersion: string;
  productionVersion: string | null;
  tagExists: boolean;
}): string[] => {
  const reasons: string[] = [];
  if (compareSemver(facts.version, facts.mainVersion) <= 0)
    reasons.push(
      `The version ${facts.version} is not higher than the current version ${facts.mainVersion}`,
    );
  if (facts.tagExists) reasons.push(`The tag v${facts.version} already exists`);
  const belowProduction = checkAboveProduction(
    facts.version,
    facts.productionVersion,
  );
  if (belowProduction !== null) reasons.push(belowProduction);
  return reasons;
};
