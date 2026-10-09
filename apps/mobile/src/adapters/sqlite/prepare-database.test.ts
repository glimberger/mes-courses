/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DataFromNewerVersion } from '../../application/ports/data-from-newer-version';
import { NodeSqlDatabase } from '../../../test/sqlite/node-sql-database';
import { prepareDatabase } from './prepare-database';

describe('prepareDatabase', () => {
  let folder: string;
  let db: NodeSqlDatabase;

  beforeEach(() => {
    // A file, so the journal mode is the one stored in it.
    folder = mkdtempSync(join(tmpdir(), 'mes-courses-'));
    db = new NodeSqlDatabase(join(folder, 'mes-courses.db'));
  });

  afterEach(() => {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  });

  it('FR-028 makes a new database durable, migrated and with foreign constraints on', async () => {
    await prepareDatabase(db);

    expect(await db.getFirstAsync('PRAGMA journal_mode', [])).toEqual({
      journal_mode: 'wal',
    });
    expect(await db.getFirstAsync('PRAGMA user_version', [])).toEqual({
      user_version: 2,
    });
    expect(await db.getFirstAsync('PRAGMA foreign_keys', [])).toEqual({
      foreign_keys: 1,
    });
  });

  it('FR-040 refuses data from a newer version before changing its journal mode', async () => {
    await db.execAsync('PRAGMA user_version = 99');

    await expect(prepareDatabase(db)).rejects.toBeInstanceOf(
      DataFromNewerVersion,
    );

    expect(await db.getFirstAsync('PRAGMA journal_mode', [])).toEqual({
      journal_mode: 'delete',
    });
  });
});
