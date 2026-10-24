import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What CI wrote into `build-info.json`: the release this artifact is (data-model "BuildInfo"). */
export type BuildInfo = { version: string; commit: string; sequence?: number };

const SERVER_ROOT = join(__dirname, '..', '..');

const packageVersion = (): string => {
  const { version } = JSON.parse(
    readFileSync(join(SERVER_ROOT, 'package.json'), 'utf8'),
  ) as { version?: string };
  return version ?? 'unknown';
};

/**
 * Reads `build-info.json`, two folders above both `src/composition` and `dist/composition`. Without
 * the file, or when it is malformed, the server is a development build: `package.json`'s version
 * and the commit `"dev"`.
 */
export const readBuildInfo = (
  path = join(SERVER_ROOT, 'build-info.json'),
): BuildInfo => {
  try {
    const info = JSON.parse(readFileSync(path, 'utf8')) as Partial<BuildInfo>;
    if (typeof info.version === 'string' && typeof info.commit === 'string') {
      return {
        version: info.version,
        commit: info.commit,
        ...(Number.isInteger(info.sequence)
          ? { sequence: info.sequence as number }
          : {}),
      };
    }
  } catch {
    // No file, or not JSON: a development build.
  }
  return { version: packageVersion(), commit: 'dev' };
};

/**
 * The release Sentry reports: `mes-courses-server@<version>`. The version comes from the build
 * info, not from `npm_package_version`, which only pnpm sets and systemd does not (FR-022a).
 */
export const serverRelease = (buildInfoPath?: string): string =>
  `mes-courses-server@${readBuildInfo(buildInfoPath).version}`;
