import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

// `PRAGMA synchronous` reads back as a number: 2 is FULL.
const SYNCHRONOUS_FULL = 2;

/**
 * Makes every commit survive a power cut (FR-028, research R4): a WAL journal, synced to storage
 * at each commit. Throws when either setting does not read back.
 */
export const configureDatabase = (db: SqlDatabase): Promise<void> =>
  withStorageErrors(async () => {
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA synchronous = FULL');
    const journal = await db.getFirstAsync<{ journal_mode: string }>(
      'PRAGMA journal_mode',
      [],
    );
    const synchronous = await db.getFirstAsync<{ synchronous: number }>(
      'PRAGMA synchronous',
      [],
    );
    if (journal?.journal_mode !== 'wal') {
      throw new Error('The WAL journal mode did not take');
    }
    if (synchronous?.synchronous !== SYNCHRONOUS_FULL) {
      throw new Error('The FULL synchronous level did not take');
    }
  });
