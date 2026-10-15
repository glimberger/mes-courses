import type { Environment } from '../../domain/manifest';

/** Copies of the database taken with the service stopped. */
export interface DatabaseSnapshots {
  /** Returns the name of the copy, or `null` when there was no database to copy. */
  take(
    environment: Environment,
    previousCommit: string | null,
  ): Promise<string | null>;
  /**
   * Puts the copy back over the database, `-wal` and `-shm` included. The side files that the
   * copy did not have are removed, so a stale journal never replays over the restored file.
   */
  restore(environment: Environment, copy: string): Promise<void>;
}
