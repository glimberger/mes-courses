import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { DatabaseSnapshots } from '../../application/ports/database-snapshots';

const KEPT_COPIES = 5;
const SIDE_FILES = ['-wal', '-shm'];

const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');

/**
 * Copies of `<dataDirectory>/<env>/mes-courses.db` (and its `-wal` and `-shm` when present) into
 * `backups/<UTC timestamp>-<previous sha>.db`, taken with the service stopped (research R9).
 */
export const createSqliteFileSnapshots = (
  dataDirectory: string,
  now: () => Date = () => new Date(),
): DatabaseSnapshots => ({
  async take(environment, previousCommit) {
    const folder = join(dataDirectory, environment);
    const source = join(folder, 'mes-courses.db');
    const backups = join(folder, 'backups');
    try {
      await stat(source);
    } catch {
      // A fresh instance has not created its database yet: nothing to keep.
      return;
    }
    await mkdir(backups, { recursive: true });
    const target = join(
      backups,
      `${stamp(now())}-${previousCommit ?? 'none'}.db`,
    );
    await copyFile(source, target);
    for (const suffix of SIDE_FILES) {
      try {
        await stat(source + suffix);
      } catch {
        continue;
      }
      await copyFile(source + suffix, target + suffix);
    }
    const copies = (await readdir(backups))
      .filter((name) => name.endsWith('.db'))
      .sort()
      .reverse();
    for (const old of copies.slice(KEPT_COPIES)) {
      await rm(join(backups, old), { force: true });
      for (const suffix of SIDE_FILES) {
        await rm(join(backups, old + suffix), { force: true });
      }
    }
  },

  async restoreLatest() {
    throw new Error('Restoring a database copy comes with the rollback (US3)');
  },
});
