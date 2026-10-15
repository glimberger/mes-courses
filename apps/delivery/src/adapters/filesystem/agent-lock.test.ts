import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createFileAgentLock } from './agent-lock';

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-lock-'));
  file = join(dir, 'agent.lock');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('file agent lock', () => {
  it('is held by one acquirer at a time', async () => {
    const lock = createFileAgentLock(file);

    const first = await lock.tryAcquire();
    const second = await lock.tryAcquire();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('can be taken again once released, and releasing twice is harmless', async () => {
    const lock = createFileAgentLock(file);
    const release = await lock.tryAcquire();

    await release?.();
    await release?.();

    expect(await lock.tryAcquire()).not.toBeNull();
  });

  it('takes over a lock left by a process that no longer exists', async () => {
    const dead = spawnSync(process.execPath, ['-e', '']);
    writeFileSync(file, String(dead.pid));

    expect(await createFileAgentLock(file).tryAcquire()).not.toBeNull();
  });

  it('lets only one of several contenders take over a stale lock', async () => {
    const dead = spawnSync(process.execPath, ['-e', '']);
    writeFileSync(file, String(dead.pid));
    const lock = createFileAgentLock(file);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => lock.tryAcquire()),
    );

    expect(results.filter((release) => release !== null)).toHaveLength(1);
  });

  it('keeps a lock held by a live process', async () => {
    writeFileSync(file, String(process.pid));

    expect(await createFileAgentLock(file).tryAcquire()).toBeNull();
  });

  it('treats an unreadable lock file as stale', async () => {
    writeFileSync(file, '');

    expect(await createFileAgentLock(file).tryAcquire()).not.toBeNull();
  });
});
