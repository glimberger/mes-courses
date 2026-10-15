import {
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
} from 'node:fs/promises';
import { join } from 'node:path';

import type { CommandRunner } from '../../application/ports/command-runner';
import type { ReleaseStore } from '../../application/ports/release-store';
import { buildRuntime } from '../nix/runtime';
import { verifyAndUnpack } from './archive';

const KEPT_RELEASES = 3;

/** `<root>/<env>/releases/<commit>` and the `current` link (contracts/pi-layout.md). */
export const createFileReleaseStore = (
  root: string,
  runner: CommandRunner,
): ReleaseStore => {
  const base = (environment: string) => join(root, environment);
  const releasePath = (environment: string, commit: string) =>
    join(base(environment), 'releases', commit);

  return {
    async install(environment, commit, archive, sha256) {
      const folder = releasePath(environment, commit);
      await verifyAndUnpack(archive, sha256, folder);
      return folder;
    },

    path: releasePath,

    async activate(environment, commit) {
      const current = join(base(environment), 'current');
      const next = `${current}.next`;
      await rm(next, { force: true });
      await symlink(join('releases', commit), next);
      await rename(next, current);
    },

    async currentRelease(environment) {
      let commit: string | undefined;
      try {
        commit = (await readlink(join(base(environment), 'current')))
          .split('/')
          .pop();
      } catch {
        return null;
      }
      if (!commit) return null;
      try {
        const info = JSON.parse(
          await readFile(
            join(
              releasePath(environment, commit),
              'apps/server/build-info.json',
            ),
            'utf8',
          ),
        ) as { sequence?: unknown };
        return {
          commit,
          sequence: Number.isInteger(info.sequence)
            ? (info.sequence as number)
            : null,
        };
      } catch {
        return { commit, sequence: null };
      }
    },

    async prune(environment) {
      const releases = join(base(environment), 'releases');
      let active: string | null = null;
      try {
        active =
          (await readlink(join(base(environment), 'current')))
            .split('/')
            .pop() ?? null;
      } catch {
        // No current release yet.
      }
      const entries = await Promise.all(
        (await readdir(releases)).map(async (name) => ({
          name,
          modified: (await stat(join(releases, name))).mtimeMs,
        })),
      );
      const keep = new Set<string>(active ? [active] : []);
      for (const { name } of entries.sort((a, b) => b.modified - a.modified)) {
        if (keep.size >= KEPT_RELEASES) break;
        keep.add(name);
      }
      for (const { name } of entries) {
        if (!keep.has(name)) {
          await rm(join(releases, name), { recursive: true, force: true });
        }
      }
    },

    buildRuntime: (environment, commit, nixpkgsRev) =>
      buildRuntime(
        runner,
        nixpkgsRev,
        join(releasePath(environment, commit), 'runtime'),
      ),
  };
};
