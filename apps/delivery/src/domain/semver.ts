export type Semver = {
  major: number;
  minor: number;
  patch: number;
  /** The `<n>` of `-staging.<n>`; null for a release. */
  staging: number | null;
};

const PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-staging\.(0|[1-9]\d*))?$/;

/** Parses `X.Y.Z` and `X.Y.Z-staging.<n>`; anything else throws. */
export const parseSemver = (input: string): Semver => {
  const match = PATTERN.exec(input);
  if (match === null)
    throw new Error(`Not a semver version: ${JSON.stringify(input)}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    staging: match[4] === undefined ? null : Number(match[4]),
  };
};

/** Negative when `a` is lower than `b`, positive when higher. A prerelease is below its release. */
export const compareSemver = (a: string, b: string): number => {
  const left = parseSemver(a);
  const right = parseSemver(b);
  const core =
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch;
  if (core !== 0) return core;
  if (left.staging === right.staging) return 0;
  if (left.staging === null) return 1;
  if (right.staging === null) return -1;
  return left.staging - right.staging;
};
