import { readdir, readlink, rename, rm, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { FdroidSite } from '../../application/ports/fdroid-site';
import { verifyAndUnpack } from './archive';

/** `<root>/<env>/<commit>/repo` and the `current` link; keeps the current and the previous one. */
export const createFileFdroidSite = (root: string): FdroidSite => ({
  async publish(environment, commit, archive, sha256) {
    const base = join(root, environment);
    await verifyAndUnpack(archive, sha256, join(base, commit));
    const current = join(base, 'current');
    let previous: string | null = null;
    try {
      previous = await readlink(current);
    } catch {
      // First publication.
    }
    const next = `${current}.next`;
    await rm(next, { force: true });
    await symlink(commit, next);
    await rename(next, current);

    const keep = new Set([commit, ...(previous ? [previous] : [])]);
    for (const name of await readdir(base)) {
      const path = join(base, name);
      if (name === 'current' || name.includes('.')) continue;
      if (!keep.has(name) && (await stat(path)).isDirectory()) {
        await rm(path, { recursive: true, force: true });
      }
    }
  },
});
