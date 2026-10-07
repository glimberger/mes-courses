import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { closeOnFailure } from './close-on-failure';
import { prepareDatabase } from './prepare-database';
import { withStorageErrors } from './storage-error';

export const DATABASE_NAME = 'mes-courses.db';

/**
 * Opens the app's database and prepares it (`prepareDatabase`). On a failure the database is
 * closed before the error is rethrown, so a retry starts from scratch (research R18a), and data
 * from a newer version is left untouched (R18c).
 */
export const openDatabase = async (): Promise<SQLiteDatabase> => {
  const db = await withStorageErrors(() => openDatabaseAsync(DATABASE_NAME));
  await closeOnFailure(db, () => prepareDatabase(db));
  return db;
};
