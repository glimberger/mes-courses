import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readBuildInfo, serverRelease } from './release';

describe('serverRelease', () => {
  it('FR-022a reads the version of the server package, with no environment variable', () => {
    delete process.env.npm_package_version;

    expect(serverRelease()).toMatch(/^mes-courses-server@\d+\.\d+\.\d+/);
    expect(serverRelease()).not.toContain('unknown');
  });
});

describe('readBuildInfo', () => {
  const inTempDir = (run: (dir: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), 'mes-courses-'));
    try {
      run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('reads the version, the commit and the sequence of the file', () => {
    inTempDir((dir) => {
      const path = join(dir, 'build-info.json');
      writeFileSync(
        path,
        JSON.stringify({
          version: '1.2.0-staging.412',
          commit: 'a'.repeat(40),
          sequence: 412,
        }),
      );

      expect(readBuildInfo(path)).toEqual({
        version: '1.2.0-staging.412',
        commit: 'a'.repeat(40),
        sequence: 412,
      });
    });
  });

  it('falls back to the package version and "dev" without the file', () => {
    inTempDir((dir) => {
      const info = readBuildInfo(join(dir, 'missing.json'));

      expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(info.commit).toBe('dev');
      expect(info).not.toHaveProperty('sequence');
    });
  });

  it('falls back as without the file when the file is malformed', () => {
    inTempDir((dir) => {
      const path = join(dir, 'build-info.json');
      writeFileSync(path, '{ not json');
      const fallback = readBuildInfo(join(dir, 'missing.json'));

      expect(readBuildInfo(path)).toEqual(fallback);
      writeFileSync(path, JSON.stringify({ version: 3 }));
      expect(readBuildInfo(path)).toEqual(fallback);
    });
  });

  it('makes serverRelease use the build info version', () => {
    inTempDir((dir) => {
      const path = join(dir, 'build-info.json');
      writeFileSync(
        path,
        JSON.stringify({ version: '2.0.0', commit: 'b'.repeat(40) }),
      );

      expect(serverRelease(path)).toBe('mes-courses-server@2.0.0');
    });
  });
});
