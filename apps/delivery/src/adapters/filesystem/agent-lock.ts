import { open, readFile, rm } from 'node:fs/promises';

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

const heldByLiveProcess = async (file: string): Promise<boolean> => {
  try {
    const pid = Number.parseInt(await readFile(file, 'utf8'), 10);
    return Number.isInteger(pid) && pid > 0 && isAlive(pid);
  } catch {
    return false;
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
        if (await heldByLiveProcess(file)) return null;
        await rm(file, { force: true });
      }
    }
    return null;
  },
});
