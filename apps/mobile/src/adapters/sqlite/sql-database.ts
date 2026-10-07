/** A value bound to a `?` parameter. User text only ever reaches SQL this way (research R25). */
export type SqlValue = string | number | null;

/**
 * The part of expo-sqlite's async API the adapter uses, so its tests can run the same SQL on
 * `node:sqlite` (research R4). An expo-sqlite database is one as it is.
 */
export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  /** Commits when the task resolves, rolls back and rethrows when it throws. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
