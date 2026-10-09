import { randomUUID } from 'node:crypto';

import type { SqlDatabase } from './sql-database';

/** Changes the schema from the previous version; it runs inside the transaction `migrate` opens. */
export type Migration = (db: SqlDatabase) => void;

// The schema of the data model (data-model.md, "Server database").
const migration1: Migration = (db) => {
  db.exec(`
    CREATE TABLE meta (
      id        INTEGER PRIMARY KEY CHECK (id = 1),
      server_id TEXT NOT NULL,
      seq       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE category (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL, name_hlc TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      position        INTEGER NOT NULL, position_hlc TEXT NOT NULL,
      created_hlc     TEXT NOT NULL,
      deleted_hlc     TEXT, merged_into TEXT REFERENCES category(id),
      seq             INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX category_live_name ON category(normalized_name) WHERE deleted_hlc IS NULL;

    CREATE TABLE article (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL, name_hlc TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      category_id     TEXT NOT NULL REFERENCES category(id), category_hlc TEXT NOT NULL,
      created_hlc     TEXT NOT NULL,
      deleted_hlc     TEXT, merged_into TEXT REFERENCES article(id),
      seq             INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX article_live_name ON article(normalized_name) WHERE deleted_hlc IS NULL;

    CREATE TABLE shopping_list (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL, name_hlc TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_hlc     TEXT NOT NULL,
      deleted_hlc     TEXT, merged_into TEXT REFERENCES shopping_list(id),
      seq             INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX list_live_name ON shopping_list(normalized_name) WHERE deleted_hlc IS NULL;

    CREATE TABLE list_item (
      list_id         TEXT NOT NULL REFERENCES shopping_list(id),
      article_id      TEXT NOT NULL REFERENCES article(id),
      present         INTEGER NOT NULL, present_hlc TEXT NOT NULL,
      in_cart         INTEGER NOT NULL, in_cart_hlc TEXT NOT NULL,
      quantity_amount REAL, quantity_unit TEXT, quantity_hlc TEXT NOT NULL,
      seq             INTEGER NOT NULL,
      PRIMARY KEY (list_id, article_id)
    );

    CREATE INDEX category_seq  ON category(seq);
    CREATE INDEX article_seq   ON article(seq);
    CREATE INDEX list_seq      ON shopping_list(seq);
    CREATE INDEX list_item_seq ON list_item(seq);

    CREATE TABLE applied_change (
      change_id  TEXT PRIMARY KEY,
      device_id  TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE device (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
      credential_hash TEXT NOT NULL UNIQUE,
      created_at      TEXT NOT NULL,
      last_sync_at    TEXT,
      revoked_at      TEXT
    );

    CREATE TABLE pairing_code (
      code_hash  TEXT PRIMARY KEY,
      created_by TEXT REFERENCES device(id),
      expires_at TEXT NOT NULL,
      used_at    TEXT
    );

    CREATE TABLE pairing_failure (
      at TEXT NOT NULL
    );
  `);
  db.run('INSERT INTO meta (id, server_id, seq) VALUES (1, ?, 0)', [
    randomUUID(),
  ]);
};

/** Migration `n` is at index `n - 1`; `PRAGMA user_version` holds the last one applied. */
export const MIGRATIONS: readonly Migration[] = [migration1];

/**
 * Brings the schema up to date, each migration in its own transaction, so a failure leaves the
 * previous schema and data as they were. Data written by a newer version is refused before any
 * other statement.
 */
export const migrate = (
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): void => {
  const version =
    db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version > migrations.length) {
    throw new Error(
      `The database is at version ${version}, newer than this server's ${migrations.length}`,
    );
  }
  for (let next = version; next < migrations.length; next++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      migrations[next]?.(db);
      // `user_version` takes no parameter; `next` is a number of ours.
      db.exec(`PRAGMA user_version = ${next + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
};
