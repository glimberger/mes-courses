import { stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';

import type { DiskSpace } from '../../application/ports/disk-space';

const sizeOf = async (file: string) => {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
};

/** Free space of the volume holding `releasesRoot`; databases are `<dataDirectory>/<env>/`. */
export const createFileDiskSpace = (
  releasesRoot: string,
  dataDirectory: string,
): DiskSpace => ({
  async freeBytes() {
    const { bavail, bsize } = await statfs(releasesRoot);
    return Number(bavail) * Number(bsize);
  },
  async databaseBytes(environment) {
    const database = join(dataDirectory, environment, 'mes-courses.db');
    const sizes = await Promise.all(
      ['', '-wal', '-shm'].map((suffix) => sizeOf(database + suffix)),
    );
    return sizes.reduce((total, size) => total + size, 0);
  },
});
