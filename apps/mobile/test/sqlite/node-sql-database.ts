import { DatabaseSync } from 'node:sqlite';

import type {
  SqlDatabase,
  SqlValue,
} from '../../src/adapters/sqlite/sql-database';

/**
 * `SqlDatabase` on Node's built-in SQLite, the engine expo-sqlite embeds, for the adapter tests
 * (research R4). Tests using it run in the Jest `node` project.
 */
export class NodeSqlDatabase implements SqlDatabase {
  private readonly db: DatabaseSync;

  /**
   * An in-memory database, or the database file at `path`. Foreign keys start off, as in
   * expo-sqlite, so the tests prove the adapter turns them on.
   */
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  }

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(source: string, params: SqlValue[]): Promise<unknown> {
    return this.db.prepare(source).run(...params);
  }

  async getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]> {
    return this.db.prepare(source).all(...params) as T[];
  }

  async getFirstAsync<T>(
    source: string,
    params: SqlValue[],
  ): Promise<T | null> {
    return (this.db.prepare(source).get(...params) as T | undefined) ?? null;
  }

  // The same steps as expo-sqlite's `withTransactionAsync`, including the ROLLBACK after a BEGIN
  // that failed: the tests then see the error a device would.
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    try {
      await this.execAsync('BEGIN');
      await task();
      await this.execAsync('COMMIT');
    } catch (error) {
      await this.execAsync('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
