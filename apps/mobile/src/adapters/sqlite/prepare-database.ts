import { configureDatabase } from './configure-database';
import { checkedVersion, migrate } from './migrations';
import type { SqlDatabase } from './sql-database';

/**
 * Makes an opened database ready for the repositories. Data from a newer version is refused
 * first, before the journal mode is written to the file (FR-040, research R18c); then commits
 * are made durable (FR-028, R4), and the schema is brought up to date with the foreign
 * constraints on.
 */
export const prepareDatabase = async (db: SqlDatabase): Promise<void> => {
  await checkedVersion(db);
  await configureDatabase(db);
  await migrate(db);
};
