import { DataFromNewerVersion } from '../../application/ports/data-from-newer-version';
import type { SqlDatabase } from './sql-database';
import { withStorageErrors } from './storage-error';

/** Changes the schema from the previous version; it runs inside the transaction `migrate` opens. */
export type Migration = (db: SqlDatabase) => Promise<void>;

// The schema of the data model (data-model.md, "SQLite schema (migration 1)").
const migration1: Migration = (db) =>
  db.execAsync(`
    CREATE TABLE category (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
      normalized_name TEXT NOT NULL UNIQUE,
      position        INTEGER NOT NULL UNIQUE
    );

    CREATE TABLE article (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
      normalized_name TEXT NOT NULL UNIQUE,
      category_id     TEXT NOT NULL REFERENCES category(id)
    );

    CREATE TABLE shopping_list (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
      normalized_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE list_item (
      list_id         TEXT NOT NULL REFERENCES shopping_list(id),
      article_id      TEXT NOT NULL REFERENCES article(id),
      in_cart         INTEGER NOT NULL DEFAULT 0 CHECK (in_cart IN (0, 1)),
      quantity_amount REAL CHECK (quantity_amount IS NULL OR (quantity_amount > 0 AND quantity_amount <= 9999)),
      quantity_unit   TEXT CHECK (quantity_unit IS NULL OR length(quantity_unit) BETWEEN 1 AND 15),
      PRIMARY KEY (list_id, article_id),
      CHECK (quantity_unit IS NULL OR quantity_amount IS NOT NULL)
    );

    CREATE INDEX list_item_article ON list_item(article_id);

    CREATE TABLE app_state (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      current_list_id TEXT NOT NULL REFERENCES shopping_list(id)
    );
  `);

/** Migration `n` is at index `n - 1`; `PRAGMA user_version` holds the last one applied. */
export const MIGRATIONS: readonly Migration[] = [migration1];

/**
 * Brings the schema up to date, each migration in its own transaction, so a failure leaves the
 * previous schema and data as they were (FR-039). Data written by a newer version is refused
 * before any other statement (FR-040, research R18c). Foreign keys are off by default on each
 * connection, so it also turns them on: it runs at every opening. Any other failure is a
 * `StorageError` or `StorageFull`.
 */
export const migrate = (
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<void> => withStorageErrors(() => runMigrations(db, migrations));

const runMigrations = async (
  db: SqlDatabase,
  migrations: readonly Migration[],
): Promise<void> => {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
    [],
  );
  const version = row?.user_version ?? 0;
  if (version > migrations.length) throw new DataFromNewerVersion();

  // A no-op inside a transaction, so set before any.
  await db.execAsync('PRAGMA foreign_keys = ON');

  for (const [index, migration] of migrations.entries()) {
    const target = index + 1;
    if (target <= version) continue;
    await db.withTransactionAsync(async () => {
      await migration(db);
      // `target` is a number from this list, never user text.
      await db.execAsync(`PRAGMA user_version = ${target}`);
    });
  }
};
