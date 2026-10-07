import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs `step` on the open `db`. When it throws, closes `db` and rethrows the step's error, so a
 * retry starts from scratch (research R18a); the failure to report is the first one, not a
 * failure to close.
 */
export const closeOnFailure = async <T>(
  db: SQLiteDatabase,
  step: () => Promise<T>,
): Promise<T> => {
  try {
    return await step();
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
};
