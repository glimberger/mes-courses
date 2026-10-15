import type { Environment } from '../../domain/manifest';

/** Copies of the database taken with the service stopped. */
export interface DatabaseSnapshots {
  take(environment: Environment, previousCommit: string | null): Promise<void>;
  /** Puts the most recent copy back. */
  restoreLatest(environment: Environment): Promise<void>;
}
