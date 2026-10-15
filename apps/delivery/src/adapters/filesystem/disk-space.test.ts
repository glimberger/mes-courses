import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFileDiskSpace } from './disk-space';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-disk-'));
  mkdirSync(join(dir, 'data/staging'), { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('file disk space', () => {
  it('reports the free space of the volume as a positive number', async () => {
    const free = await createFileDiskSpace(dir, join(dir, 'data')).freeBytes();
    expect(free).toBeGreaterThan(0);
  });

  it('adds up the database and its side files', async () => {
    writeFileSync(join(dir, 'data/staging/mes-courses.db'), '12345');
    writeFileSync(join(dir, 'data/staging/mes-courses.db-wal'), '123');
    const disk = createFileDiskSpace(dir, join(dir, 'data'));
    await expect(disk.databaseBytes('staging')).resolves.toBe(8);
  });

  it('counts 0 for an instance without a database', async () => {
    const disk = createFileDiskSpace(dir, join(dir, 'data'));
    await expect(disk.databaseBytes('production')).resolves.toBe(0);
  });
});
