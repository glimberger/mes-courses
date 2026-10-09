/** A value bound to a `?` parameter. Request content only ever reaches SQL this way. */
export type SqlValue = string | number | null;

/**
 * The part of a synchronous SQLite driver the adapter uses, so `node:sqlite` can be swapped for
 * `better-sqlite3` without touching the rest (research R3).
 */
export interface SqlDatabase {
  exec(source: string): void;
  run(source: string, params?: SqlValue[]): void;
  all<T>(source: string, params?: SqlValue[]): T[];
  get<T>(source: string, params?: SqlValue[]): T | undefined;
  close(): void;
}
