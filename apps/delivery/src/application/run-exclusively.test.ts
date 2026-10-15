import type { AgentLock } from './ports/agent-lock';
import { runExclusively } from './run-exclusively';

const lockHeld = (held: boolean) => {
  const events: string[] = [];
  const lock: AgentLock = {
    tryAcquire: async () => {
      if (held) return null;
      events.push('acquired');
      return async () => {
        events.push('released');
      };
    },
  };
  return { lock, events };
};

describe('runExclusively', () => {
  it('runs the work between acquiring and releasing the lock', async () => {
    const { lock, events } = lockHeld(false);

    const result = await runExclusively(lock, async () => {
      events.push('work');
      return 7;
    });

    expect(result).toEqual({ busy: false, value: 7 });
    expect(events).toEqual(['acquired', 'work', 'released']);
  });

  it('releases the lock when the work throws', async () => {
    const { lock, events } = lockHeld(false);

    await expect(
      runExclusively(lock, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(events).toEqual(['acquired', 'released']);
  });

  it('does not run the work while another process holds the lock', async () => {
    const { lock } = lockHeld(true);
    const work = jest.fn();

    const result = await runExclusively(lock, work);

    expect(result).toEqual({ busy: true });
    expect(work).not.toHaveBeenCalled();
  });
});
