import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The release Sentry reports: `mes-courses-server@<version>`, with the version read from the
 * server's `package.json`, two folders above both `src/composition` and `dist/composition`. It
 * does not come from `npm_package_version`, which only yarn sets and systemd does not (FR-022a).
 */
export const serverRelease = (
  packageJsonPath = join(__dirname, '..', '..', 'package.json'),
): string => {
  const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    version?: string;
  };
  return `mes-courses-server@${version ?? 'unknown'}`;
};
