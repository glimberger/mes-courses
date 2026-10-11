import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { serverRelease } from './release';

describe('serverRelease', () => {
  it('FR-022a reads the version of the server package, with no environment variable', () => {
    delete process.env.npm_package_version;

    expect(serverRelease()).toMatch(/^mes-courses-server@\d+\.\d+\.\d+/);
    expect(serverRelease()).not.toContain('unknown');
  });

  it('reads the version of the package.json it is given', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mes-courses-'));
    try {
      const path = join(dir, 'package.json');
      writeFileSync(path, JSON.stringify({ version: '2.3.4' }));

      expect(serverRelease(path)).toBe('mes-courses-server@2.3.4');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
