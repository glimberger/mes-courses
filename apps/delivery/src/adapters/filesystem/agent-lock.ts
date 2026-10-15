import { open, readFile, rm, stat } from 'node:fs/promises';

import type { AgentLock } from '../../application/ports/agent-lock';

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but is not ours to signal.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

const readOwner = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
};

const isLive = (content: string): boolean => {
  const pid = Number.parseInt(content, 10);
  return Number.isInteger(pid) && pid > 0 && isAlive(pid);
};

const GUARD_STALE_MS = 30_000;

/**
 * Removes the lock `file` if it is still stale, under a short-lived guard file. Without the
 * guard, two contenders that both saw the same dead owner could each remove the lock, the second
 * one deleting the fresh lock the first had just taken. Returns false when another contender
 * holds the guard: the lock is then busy for this attempt.
 */
const removeIfStale = async (file: string): Promise<boolean> => {
  const guard = `${file}.takeover`;
  try {
    await (await open(guard, 'wx')).close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    // A guard left by a crash: clear it so that the next attempt can go through.
    const age = await stat(guard).then(
      (info) => Date.now() - info.mtimeMs,
      () => 0,
    );
    if (age > GUARD_STALE_MS) await rm(guard, { force: true });
    return false;
  }
  try {
    const owner = await readOwner(file);
    if (owner !== null && isLive(owner)) return false;
    await rm(file, { force: true });
    return true;
  } finally {
    await rm(guard, { force: true });
  }
};

/**
 * A file created exclusively, holding the PID of its owner. A file whose owner is gone (a crash,
 * a power cut) is stale and taken over.
 */
export const createFileAgentLock = (file: string): AgentLock => ({
  async tryAcquire() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const handle = await open(file, 'wx');
        await handle.writeFile(String(process.pid));
        await handle.close();
        let released = false;
        return async () => {
          if (released) return;
          released = true;
          await rm(file, { force: true });
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const owner = await readOwner(file);
        if (owner !== null) {
          if (isLive(owner)) return null;
          if (!(await removeIfStale(file))) return null;
        }
      }
    }
    return null;
  },
});
