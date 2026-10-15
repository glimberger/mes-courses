import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFileFdroidSite } from './fdroid-site';
import { writeArchive } from './tar-fixture';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-fdroid-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const publish = async (commit: string, content = commit) => {
  const archive = join(dir, `${commit}.tar.gz`);
  const sha = writeArchive(archive, [{ name: 'repo/index-v2.json', content }]);
  await createFileFdroidSite(join(dir, 'srv')).publish(
    'staging',
    commit,
    archive,
    sha,
  );
};

describe('file F-Droid site', () => {
  it('unpacks the repository and points current at it', async () => {
    await publish('aaa');
    expect(readlinkSync(join(dir, 'srv/staging/current'))).toBe('aaa');
    expect(
      readFileSync(join(dir, 'srv/staging/current/repo/index-v2.json'), 'utf8'),
    ).toBe('aaa');
  });

  it('keeps the current and the previous folder only', async () => {
    await publish('aaa');
    await publish('bbb');
    await publish('ccc');
    expect(readdirSync(join(dir, 'srv/staging')).sort()).toEqual([
      'bbb',
      'ccc',
      'current',
    ]);
  });

  it('refuses a wrong checksum and keeps serving the old repository', async () => {
    await publish('aaa');
    const archive = join(dir, 'x.tar.gz');
    writeArchive(archive, [{ name: 'repo/a', content: 'x' }]);
    await expect(
      createFileFdroidSite(join(dir, 'srv')).publish(
        'staging',
        'bbb',
        archive,
        '0'.repeat(64),
      ),
    ).rejects.toThrow();
    expect(readlinkSync(join(dir, 'srv/staging/current'))).toBe('aaa');
    expect(existsSync(join(dir, 'srv/staging/bbb'))).toBe(false);
  });

  it('refuses an unsafe member', async () => {
    const archive = join(dir, 'x.tar.gz');
    const sha = writeArchive(archive, [{ name: '../evil', content: 'x' }]);
    await expect(
      createFileFdroidSite(join(dir, 'srv')).publish(
        'staging',
        'bbb',
        archive,
        sha,
      ),
    ).rejects.toThrow(/unsafe/i);
  });
});
