import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openDatabase } from './open-database';

describe('openDatabase', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'mes-courses-db-'));
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('opens a migrated database in WAL mode with synchronous = FULL', () => {
    const db = openDatabase(join(directory, 'test.db'));

    expect(db.get('PRAGMA journal_mode')).toEqual({ journal_mode: 'wal' });
    // 2 = FULL
    expect(db.get('PRAGMA synchronous')).toEqual({ synchronous: 2 });
    expect(db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    expect(db.get('PRAGMA user_version')).toEqual({ user_version: 1 });
    db.close();
  });

  it('keeps the server id when the database is opened again', () => {
    const path = join(directory, 'test.db');
    const first = openDatabase(path);
    const serverId = first.get('SELECT server_id FROM meta');
    first.close();

    const second = openDatabase(path);

    expect(second.get('SELECT server_id FROM meta')).toEqual(serverId);
    second.close();
  });
});
