import type { BumpPullRequest } from '../../domain/release-plan';

export interface ReleasePullRequests {
  /** The open pull request of `branch`, else the merged one, else null. */
  findBump(branch: string): Promise<BumpPullRequest | null>;
  open(branch: string, title: string): Promise<BumpPullRequest>;
  /** Squash mode, branch deleted after the merge. */
  enableAutoMerge(pr: BumpPullRequest): Promise<void>;
}
