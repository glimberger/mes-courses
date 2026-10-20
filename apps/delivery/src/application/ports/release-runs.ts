import type { RunOutcome } from '../../domain/release-plan';

export interface ReleaseRuns {
  /** One outcome per workflow of `REQUIRED_WORKFLOWS` on `sha`; a workflow without a run is pending. */
  requiredRuns(sha: string): Promise<RunOutcome[]>;
  /** The link of the `Release` run the tag started, or of the Actions page when it is not found. */
  releaseRunUrl(sha: string): Promise<string>;
}
