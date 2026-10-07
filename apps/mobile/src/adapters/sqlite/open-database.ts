import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { configureDatabase } from './configure-database';
import { migrate } from './migrations';
import { withStorageErrors } from './storage-error';

export const DATABASE_NAME = 'mes-courses.db';

/**
 * Opens the app's database, ready for the repositories: durable commits, then the schema up to
 * date. `migrate` turns the foreign constraints on, as it does at every opening. On a failure the
 * database is closed before the error is rethrown, so a retry starts from scratch (research
 * R18a); `DataFromNewerVersion` leaves it untouched (R18c).
 */
export const openDatabase = async (): Promise<SQLiteDatabase> => {
  const db = await withStorageErrors(() => openDatabaseAsync(DATABASE_NAME));
  try {
    await configureDatabase(db);
    await migrate(db);
    return db;
  } catch (error) {
    // The failure to report is the first one, not a failure to close.
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
};
