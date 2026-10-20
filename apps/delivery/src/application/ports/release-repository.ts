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
  /** Branch `chore/release-<version>`, bump commit, push; leaves the repository on `main`. */
  commitBump(version: string): Promise<void>;
  /** Creates the annotated tag `tag` on `sha`. */
  createTag(tag: string, sha: string): Promise<void>;
  pushTag(tag: string): Promise<void>;
  /** The newest commit of `origin/main` that set the app version to `version`, null when none did. */
  releaseCommit(version: string): Promise<string | null>;
}
