import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Recorder } from '../../application/testing/recorder';
import { ScriptedCommandRunner } from '../../application/testing/in-memory-doubles';
import { createFileReleaseStore } from './release-store';
import { writeArchive } from './tar-fixture';

let dir: string;
let root: string;
let recorder: Recorder;
const store = () => {
  recorder = new Recorder();
  return createFileReleaseStore(root, new ScriptedCommandRunner(recorder));
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-release-'));
  root = join(dir, 'opt');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const good = [
  { name: 'apps/server/dist/main.js', content: 'console.log(1)' },
  { name: 'node_modules/.bin/tool', link: '../pkg/bin/tool.js' },
];

describe('file release store', () => {
  it('unpacks a good archive into releases/<commit>', async () => {
    const archive = join(dir, 'a.tar.gz');
    const sha = writeArchive(archive, good);

    const folder = await store().install('staging', 'abc', archive, sha);

    expect(folder).toBe(join(root, 'staging/releases/abc'));
    expect(readFileSync(join(folder, 'apps/server/dist/main.js'), 'utf8')).toBe(
      'console.log(1)',
    );
    expect(readlinkSync(join(folder, 'node_modules/.bin/tool'))).toBe(
      '../pkg/bin/tool.js',
    );
  });

  it('unpacks nothing when the checksum is wrong', async () => {
    const archive = join(dir, 'a.tar.gz');
    writeArchive(archive, good);
    await expect(
      store().install('staging', 'abc', archive, '0'.repeat(64)),
    ).rejects.toThrow(/checksum/i);
    expect(existsSync(join(root, 'staging/releases/abc'))).toBe(false);
  });

  it.each([
    ['a ../ member', [{ name: '../evil.txt', content: 'x' }]],
    ['a nested ../ member', [{ name: 'a/../../evil.txt', content: 'x' }]],
    ['an absolute member', [{ name: '/tmp/evil.txt', content: 'x' }]],
    [
      'a link leaving the release',
      [{ name: 'node_modules/x', link: '../../../etc/passwd' }],
    ],
    ['an absolute link', [{ name: 'x', link: '/etc/passwd' }]],
  ])('refuses %s and leaves nothing behind', async (_name, members) => {
    const archive = join(dir, 'a.tar.gz');
    const sha = writeArchive(archive, members);
    await expect(
      store().install('staging', 'abc', archive, sha),
    ).rejects.toThrow(/unsafe/i);
    expect(existsSync(join(root, 'staging/releases/abc'))).toBe(false);
    expect(existsSync(join(dir, 'evil.txt'))).toBe(false);
  });

  it('switches current atomically to a release', async () => {
    const s = store();
    mkdirSync(join(root, 'staging/releases/abc'), { recursive: true });
    mkdirSync(join(root, 'staging/releases/def'), { recursive: true });
    await s.activate('staging', 'abc');
    expect(readlinkSync(join(root, 'staging/current'))).toBe('releases/abc');
    await s.activate('staging', 'def');
    expect(readlinkSync(join(root, 'staging/current'))).toBe('releases/def');
    expect(readdirSync(join(root, 'staging')).sort()).toEqual([
      'current',
      'releases',
    ]);
  });

  it('keeps the current release and the two newest others', async () => {
    const s = store();
    const releases = join(root, 'staging/releases');
    ['r1', 'r2', 'r3', 'r4', 'r5'].forEach((name, index) => {
      mkdirSync(join(releases, name), { recursive: true });
      const time = new Date(2026, 9, 1 + index);
      utimesSync(join(releases, name), time, time);
    });
    await s.activate('staging', 'r2');

    await s.prune('staging');

    expect(readdirSync(releases).sort()).toEqual(['r2', 'r4', 'r5']);
  });

  it('builds the runtime into the release folder', async () => {
    await store().buildRuntime('production', 'abc', 'e'.repeat(40));
    expect(recorder.calls[0]).toContain(
      `--out-link ${join(root, 'production/releases/abc/runtime')}`,
    );
  });
});
