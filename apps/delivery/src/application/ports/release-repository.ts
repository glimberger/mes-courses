import type { ChangelogSection } from '../../domain/changelog';

export interface ReleaseRepository {
  currentBranch(): Promise<string>;
  /** True when there is no uncommitted change. */
  isClean(): Promise<boolean>;
  /** Updates the remote-tracking refs, nothing else. */
  fetch(): Promise<void>;
  /** True when the local `main` is the same commit as `origin/main`. */
  isUpToDate(): Promise<boolean>;
  /** The app version written in `apps/mobile/app.config.ts` at `ref` (for example `origin/main`). */
  appVersionAt(ref: string): Promise<string>;
  /** True when `origin` has the branch `branch`. */
  remoteBranchExists(branch: string): Promise<boolean>;
  /** The commit each side's tag points to, null when absent. */
  tagCommit(
    tag: string,
  ): Promise<{ local: string | null; remote: string | null }>;
  /**
   * Branch `branch` from `origin/main`, one commit that bumps the app version to `version` and
   * writes `section` into `CHANGELOG.md` and `changelog.json` (replacing a section of the same
   * version), push; leaves the repository on `main`. Does nothing when the branch is on the remote.
   */
  commitBump(
    version: string,
    branch: string,
    section: ChangelogSection,
  ): Promise<void>;
  /** Creates the annotated tag `tag` on `sha`. */
  createTag(tag: string, sha: string): Promise<void>;
  pushTag(tag: string): Promise<void>;
  /** The newest commit of `origin/main` that set the app version to `version`, null when none did. */
  releaseCommit(version: string): Promise<string | null>;
}
