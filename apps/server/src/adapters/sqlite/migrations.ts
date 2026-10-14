import { randomUUID } from 'node:crypto';

import { rollbackQuietly, type SqlDatabase } from './sql-database';

/** What a migration needs from outside: a fresh id and the current instant. */
export type MigrationEnv = { newId: () => string; now: () => string };

const defaultEnv: MigrationEnv = {
  newId: randomUUID,
  now: () => new Date().toISOString(),
};

/** Changes the schema from the previous version; it runs inside the transaction `migrate` opens. */
export type Migration = (db: SqlDatabase, env: MigrationEnv) => void;

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
    CREATE INDEX pairing_failure_at ON pairing_failure(at);
  `);
  db.run('INSERT INTO meta (id, server_id, seq) VALUES (1, ?, 0)', [
    randomUUID(),
  ]);
};

/**
 * Several accounts in one database (004 data-model.md, research R1, R2). Every data table and
 * `device` get `account_id` as the first key column, with composite foreign keys so a row can never
 * point at another account's row. Every existing row goes to one *setup account* (no email, no
 * password) that `create-admin` completes. The tables are rebuilt from copies: parents are created
 * first, `defer_foreign_keys` lets a self-reference (`merged_into`) be inserted in any order, and
 * the final `foreign_key_check` must return nothing.
 */
const migration2: Migration = (db, env) => {
  db.exec('PRAGMA defer_foreign_keys = ON');
  const setupAccountId = env.newId();

  for (const table of [
    'category',
    'article',
    'shopping_list',
    'list_item',
    'applied_change',
    'device',
  ]) {
    db.exec(`CREATE TEMP TABLE old_${table} AS SELECT * FROM ${table}`);
  }
  // Children first, so no drop meets a row that still references it.
  for (const table of [
    'pairing_code',
    'list_item',
    'article',
    'shopping_list',
    'category',
    'applied_change',
    'device',
  ]) {
    db.exec(`DROP TABLE ${table}`);
  }

  db.exec(`
    CREATE TABLE account (
      id                       TEXT PRIMARY KEY,
      email                    TEXT UNIQUE,
      role                     TEXT NOT NULL CHECK (role IN ('user', 'administrator')),
      password_hash            TEXT,
      temporary_password_hash  TEXT,
      temporary_expires_at     TEXT,
      suspended_at             TEXT,
      created_at               TEXT NOT NULL,
      CHECK (email IS NOT NULL OR (role = 'administrator' AND password_hash IS NULL)),
      CHECK ((temporary_password_hash IS NULL) = (temporary_expires_at IS NULL))
    );

    CREATE TABLE category (
      account_id      TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      id              TEXT NOT NULL,
      name            TEXT NOT NULL, name_hlc TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      position        INTEGER NOT NULL, position_hlc TEXT NOT NULL,
      created_hlc     TEXT NOT NULL,
      deleted_hlc     TEXT, merged_into TEXT,
      seq             INTEGER NOT NULL,
      PRIMARY KEY (account_id, id),
      FOREIGN KEY (account_id, merged_into) REFERENCES category(account_id, id)
    );
    CREATE UNIQUE INDEX category_live_name ON category(account_id, normalized_name) WHERE deleted_hlc IS NULL;
    CREATE INDEX category_seq ON category(account_id, seq);

    CREATE TABLE article (
      account_id      TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      id              TEXT NOT NULL,
      name            TEXT NOT NULL, name_hlc TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      category_id     TEXT NOT NULL, category_hlc TEXT NOT NULL,
      created_hlc     TEXT NOT NULL,
      deleted_hlc     TEXT, merged_into TEXT,
      seq             INTEGER NOT NULL,
      PRIMARY KEY (account_id, id),
      FOREIGN KEY (account_id, category_id) REFERENCES category(account_id, id),
      FOREIGN KEY (account_id, merged_into) REFERENCES article(account_id, id)
    );
    CREATE UNIQUE INDEX article_live_name ON article(account_id, normalized_name) WHERE deleted_hlc IS NULL;
    CREATE INDEX article_seq ON article(account_id, seq);

    CREATE TABLE shopping_list (
      account_id      TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      id              TEXT NOT NULL,
      name            TEXT NOT NULL, name_hlc TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_hlc     TEXT NOT NULL,
      deleted_hlc     TEXT, merged_into TEXT,
      seq             INTEGER NOT NULL,
      PRIMARY KEY (account_id, id),
      FOREIGN KEY (account_id, merged_into) REFERENCES shopping_list(account_id, id)
    );
    CREATE UNIQUE INDEX list_live_name ON shopping_list(account_id, normalized_name) WHERE deleted_hlc IS NULL;
    CREATE INDEX list_seq ON shopping_list(account_id, seq);

    CREATE TABLE list_item (
      account_id      TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      list_id         TEXT NOT NULL,
      article_id      TEXT NOT NULL,
      present         INTEGER NOT NULL, present_hlc TEXT NOT NULL,
      in_cart         INTEGER NOT NULL, in_cart_hlc TEXT NOT NULL,
      quantity_amount REAL, quantity_unit TEXT, quantity_hlc TEXT NOT NULL,
      seq             INTEGER NOT NULL,
      PRIMARY KEY (account_id, list_id, article_id),
      FOREIGN KEY (account_id, list_id) REFERENCES shopping_list(account_id, id),
      FOREIGN KEY (account_id, article_id) REFERENCES article(account_id, id)
    );
    CREATE INDEX list_item_seq ON list_item(account_id, seq);

    CREATE TABLE applied_change (
      account_id TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      change_id  TEXT NOT NULL,
      device_id  TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (account_id, change_id)
    );

    CREATE TABLE device (
      id              TEXT PRIMARY KEY,
      account_id      TEXT NOT NULL REFERENCES account(id) ON DELETE CASCADE,
      name            TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
      credential_hash TEXT NOT NULL UNIQUE,
      created_at      TEXT NOT NULL,
      last_sync_at    TEXT,
      revoked_at      TEXT
    );
    CREATE INDEX device_account ON device(account_id);

    CREATE TABLE ended_credential (
      credential_hash TEXT PRIMARY KEY,
      reason          TEXT NOT NULL CHECK (reason IN ('accountDeleted')),
      ended_at        TEXT NOT NULL
    );

    CREATE TABLE auth_attempt (
      kind     TEXT NOT NULL CHECK (kind IN ('signIn', 'passwordReset')),
      key_hash TEXT NOT NULL,
      at       TEXT NOT NULL
    );
    CREATE INDEX auth_attempt_key ON auth_attempt(kind, key_hash, at);
  `);

  db.run(
    `INSERT INTO account (id, email, role, created_at) VALUES (?, NULL, 'administrator', ?)`,
    [setupAccountId, env.now()],
  );

  const attach = (table: string, columns: string[], from = `old_${table}`) =>
    db.run(
      `INSERT INTO ${table} (account_id, ${columns.join(', ')})
       SELECT ?, ${columns.join(', ')} FROM ${from}`,
      [setupAccountId],
    );
  attach('category', [
    'id',
    'name',
    'name_hlc',
    'normalized_name',
    'position',
    'position_hlc',
    'created_hlc',
    'deleted_hlc',
    'merged_into',
    'seq',
  ]);
  attach('article', [
    'id',
    'name',
    'name_hlc',
    'normalized_name',
    'category_id',
    'category_hlc',
    'created_hlc',
    'deleted_hlc',
    'merged_into',
    'seq',
  ]);
  attach('shopping_list', [
    'id',
    'name',
    'name_hlc',
    'normalized_name',
    'created_hlc',
    'deleted_hlc',
    'merged_into',
    'seq',
  ]);
  attach('list_item', [
    'list_id',
    'article_id',
    'present',
    'present_hlc',
    'in_cart',
    'in_cart_hlc',
    'quantity_amount',
    'quantity_unit',
    'quantity_hlc',
    'seq',
  ]);
  attach('applied_change', ['change_id', 'device_id', 'applied_at']);
  attach('device', [
    'id',
    'name',
    'credential_hash',
    'created_at',
    'last_sync_at',
    'revoked_at',
  ]);
  // Pairing is gone (feature 004): its tables are dropped, their rows were short-lived.
  db.exec('DROP TABLE pairing_failure');

  for (const table of [
    'category',
    'article',
    'shopping_list',
    'list_item',
    'applied_change',
    'device',
  ]) {
    db.exec(`DROP TABLE temp.old_${table}`);
  }

  const violations = db.all('PRAGMA foreign_key_check');
  if (violations.length > 0) {
    throw new Error('Migration 2 left foreign key violations');
  }
};

/** Migration `n` is at index `n - 1`; `PRAGMA user_version` holds the last one applied. */
export const MIGRATIONS: readonly Migration[] = [migration1, migration2];

/**
 * Brings the schema up to date, each migration in its own transaction, so a failure leaves the
 * previous schema and data as they were. Data written by a newer version is refused before any
 * other statement.
 */
export const migrate = (
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
  env: MigrationEnv = defaultEnv,
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
      migrations[next]?.(db, env);
      // `user_version` takes no parameter; `next` is a number of ours.
      db.exec(`PRAGMA user_version = ${next + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      rollbackQuietly(db);
      throw error;
    }
  }
};
