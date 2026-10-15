import type { AgentLock } from './ports/agent-lock';

export type Exclusive<T> = { busy: true } | { busy: false; value: T };

/**
 * Runs `work` while holding the agent lock. A timer pass and a manual `deploy-file` both leave a
 * deployment in flight, which the next pass would read as a crash and undo (R6): only one of them
 * may work on the instances at a time.
 */
export const runExclusively = async <T>(
  lock: AgentLock,
  work: () => Promise<T>,
): Promise<Exclusive<T>> => {
  const release = await lock.tryAcquire();
  if (release === null) return { busy: true };
  try {
    return { busy: false, value: await work() };
  } finally {
    await release();
  }
};
