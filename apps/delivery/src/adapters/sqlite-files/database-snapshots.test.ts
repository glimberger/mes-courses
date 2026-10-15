import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSqliteFileSnapshots } from './database-snapshots';

let dir: string;
let folder: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-db-'));
  folder = join(dir, 'staging');
  mkdirSync(folder);
  writeFileSync(join(folder, 'mes-courses.db'), 'DB');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const at = (iso: string) => () => new Date(iso);

describe('sqlite file snapshots', () => {
  it('copies the database to backups, named after the time and the previous commit', async () => {
    await createSqliteFileSnapshots(dir, at('2026-10-20T08:14:03.123Z')).take(
      'staging',
      'abc',
    );
    expect(readdirSync(join(folder, 'backups'))).toEqual([
      '20261020T081403Z-abc.db',
    ]);
    expect(
      readFileSync(join(folder, 'backups/20261020T081403Z-abc.db'), 'utf8'),
    ).toBe('DB');
  });

  it('copies the -wal and -shm files when present', async () => {
    writeFileSync(join(folder, 'mes-courses.db-wal'), 'WAL');
    writeFileSync(join(folder, 'mes-courses.db-shm'), 'SHM');
    await createSqliteFileSnapshots(dir, at('2026-10-20T08:00:00Z')).take(
      'staging',
      'abc',
    );
    expect(readdirSync(join(folder, 'backups')).sort()).toEqual([
      '20261020T080000Z-abc.db',
      '20261020T080000Z-abc.db-shm',
      '20261020T080000Z-abc.db-wal',
    ]);
  });

  it('names a first deployment, with no previous commit, "none"', async () => {
    await createSqliteFileSnapshots(dir, at('2026-10-20T08:00:00Z')).take(
      'staging',
      null,
    );
    expect(readdirSync(join(folder, 'backups'))).toEqual([
      '20261020T080000Z-none.db',
    ]);
  });

  it('keeps the 5 most recent copies', async () => {
    for (let day = 10; day <= 17; day++) {
      await createSqliteFileSnapshots(dir, at(`2026-10-${day}T08:00:00Z`)).take(
        'staging',
        `c${day}`,
      );
    }
    expect(readdirSync(join(folder, 'backups')).sort()).toEqual(
      [13, 14, 15, 16, 17].map((day) => `202610${day}T080000Z-c${day}.db`),
    );
  });

  it('keeps the mode of the database', async () => {
    chmodSync(join(folder, 'mes-courses.db'), 0o600);
    await createSqliteFileSnapshots(dir, at('2026-10-20T08:00:00Z')).take(
      'staging',
      'abc',
    );
    expect(
      statSync(join(folder, 'backups/20261020T080000Z-abc.db')).mode & 0o777,
    ).toBe(0o600);
  });

  it('copies nothing for a fresh instance that has no database yet', async () => {
    rmSync(join(folder, 'mes-courses.db'));
    await createSqliteFileSnapshots(dir).take('staging', 'abc');
    expect(existsSync(join(folder, 'backups'))).toBe(false);
  });
});
