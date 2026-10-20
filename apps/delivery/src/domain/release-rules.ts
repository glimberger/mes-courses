import { compareSemver } from './semver';

/** The workflows that must have succeeded on a commit before it is released (research R15). */
export const REQUIRED_WORKFLOWS = ['CI', 'E2E Android', 'Deliver staging'];

/** The facts the gate reads from git, GitHub and the production channel. */
export type ReleaseFacts = {
  tag: string;
  /** The app version (`app.config.ts`) at the tagged commit. */
  appVersion: string;
  onMain: boolean;
  /** The workflows with a successful run on the tagged commit. */
  successfulWorkflows: string[];
  /** The version in the production manifest; null when there is no production release yet. */
  productionVersion: string | null;
};

const TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** The version a `vX.Y.Z` tag names, or null when the tag does not have that form. */
export const tagVersion = (tag: string): string | null => {
  const match = TAG.exec(tag);
  return match === null ? null : `${match[1]}.${match[2]}.${match[3]}`;
};

/** The failure when `version` is not above what production already runs, else null. */
export const checkAboveProduction = (
  version: string,
  productionVersion: string | null,
): string | null =>
  productionVersion !== null && compareSemver(version, productionVersion) <= 0
    ? `The version ${version} is not higher than ${productionVersion}, which production already runs: fixes go forward, tag a higher version`
    : null;

/** Every release rule that fails, not only the first, so one fix-up covers them all. */
export const evaluateRelease = (facts: ReleaseFacts): string[] => {
  const failures: string[] = [];
  const version = tagVersion(facts.tag);
  if (version === null) {
    failures.push(
      `The tag ${facts.tag} is not of the form vX.Y.Z (for example v1.2.0)`,
    );
  } else {
    if (version !== facts.appVersion) {
      failures.push(
        `The tag ${facts.tag} does not match the app version ${facts.appVersion} at this commit: expected tag v${facts.appVersion}, or set the version to ${version} in a pull request first`,
      );
    }
    const belowProduction = checkAboveProduction(
      version,
      facts.productionVersion,
    );
    if (belowProduction !== null) failures.push(belowProduction);
  }
  if (!facts.onMain) {
    failures.push('The tagged commit is not on main');
  }
  for (const workflow of REQUIRED_WORKFLOWS) {
    if (!facts.successfulWorkflows.includes(workflow)) {
      failures.push(
        `The workflow "${workflow}" has no successful run on the tagged commit`,
      );
    }
  }
  return failures;
};
