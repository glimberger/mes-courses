import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { migrate } from './migrations';
import type { SqlDatabase, SqlValue } from './sql-database';

/** `node:sqlite` behind `SqlDatabase`; `better-sqlite3` is the fallback if it is still flagged experimental (R3). */
export class NodeSqlDatabase implements SqlDatabase {
  constructor(private readonly db: DatabaseSync) {}

  exec(source: string): void {
    this.db.exec(source);
  }

  run(source: string, params: SqlValue[] = []): void {
    this.db.prepare(source).run(...(params as SQLInputValue[]));
  }

  all<T>(source: string, params: SqlValue[] = []): T[] {
    return this.db.prepare(source).all(...(params as SQLInputValue[])) as T[];
  }

  get<T>(source: string, params: SqlValue[] = []): T | undefined {
    return this.db.prepare(source).get(...(params as SQLInputValue[])) as
      T | undefined;
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Opens the server's database (`:memory:` for tests) and migrates it. WAL mode and
 * `synchronous = FULL` let a committed sync survive a power cut (FR-005, FR-006).
 */
export const openDatabase = (path: string): SqlDatabase => {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new NodeSqlDatabase(new DatabaseSync(path));
  try {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = FULL');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
};
