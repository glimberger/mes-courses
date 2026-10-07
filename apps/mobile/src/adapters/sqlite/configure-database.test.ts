/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NodeSqlDatabase } from '../../../test/sqlite/node-sql-database';
import { configureDatabase } from './configure-database';
import type { SqlDatabase } from './sql-database';
import { StorageError } from './storage-error';

describe('configureDatabase', () => {
  let folder: string;
  let db: NodeSqlDatabase;

  beforeEach(() => {
    // A file: an in-memory database always reports the journal mode `memory`.
    folder = mkdtempSync(join(tmpdir(), 'mes-courses-'));
    db = new NodeSqlDatabase(join(folder, 'mes-courses.db'));
  });

  afterEach(() => {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  });

  it('FR-028 sets the WAL journal and a full sync at every commit', async () => {
    await configureDatabase(db);

    expect(await db.getFirstAsync('PRAGMA journal_mode', [])).toEqual({
      journal_mode: 'wal',
    });
    expect(await db.getFirstAsync('PRAGMA synchronous', [])).toEqual({
      synchronous: 2,
    });
  });

  it('FR-028 throws a StorageError when the journal mode does not take', async () => {
    const answers: Record<string, object> = {
      'PRAGMA journal_mode': { journal_mode: 'memory' },
      'PRAGMA synchronous': { synchronous: 2 },
    };
    const ignoringWal: SqlDatabase = {
      execAsync: async () => undefined,
      runAsync: async () => undefined,
      getAllAsync: async () => [],
      getFirstAsync: async <T>(source: string) =>
        (answers[source] as T | undefined) ?? null,
      withTransactionAsync: (task) => task(),
    };

    await expect(configureDatabase(ignoringWal)).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it('FR-028 throws a StorageError when the sync level does not take', async () => {
    const answers: Record<string, object> = {
      'PRAGMA journal_mode': { journal_mode: 'wal' },
      'PRAGMA synchronous': { synchronous: 1 },
    };
    const ignoringFull: SqlDatabase = {
      execAsync: async () => undefined,
      runAsync: async () => undefined,
      getAllAsync: async () => [],
      getFirstAsync: async <T>(source: string) =>
        (answers[source] as T | undefined) ?? null,
      withTransactionAsync: (task) => task(),
    };

    await expect(configureDatabase(ignoringFull)).rejects.toBeInstanceOf(
      StorageError,
    );
  });
});
