import type { SqlDatabase, SqlValue } from './sql-database';
import { withStorageErrors } from './storage-error';

/** The first row the query returns, mapped, or `null`. */
export const findFirst = <Row, T>(
  db: SqlDatabase,
  source: string,
  params: SqlValue[],
  map: (row: Row) => T,
): Promise<T | null> =>
  withStorageErrors(async () => {
    const row = await db.getFirstAsync<Row>(source, params);
    return row === null ? null : map(row);
  });

/** Every row the query returns, mapped. */
export const findAll = <Row, T>(
  db: SqlDatabase,
  source: string,
  params: SqlValue[],
  map: (row: Row) => T,
): Promise<T[]> =>
  withStorageErrors(async () =>
    (await db.getAllAsync<Row>(source, params)).map(map),
  );

/** Runs a write. */
export const write = (
  db: SqlDatabase,
  source: string,
  params: SqlValue[],
): Promise<void> =>
  withStorageErrors(async () => {
    await db.runAsync(source, params);
  });
