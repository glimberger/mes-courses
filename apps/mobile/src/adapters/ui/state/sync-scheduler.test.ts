import { AppState, type AppStateStatus } from 'react-native';

import type { SyncResult } from '../../../application/use-cases/synchronize';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { fixture } from '../testing/fixtures';
import { buildStoryStore } from '../testing/story-store';
import type { UseCases } from '../use-cases';
import { createAppStore } from './app-store';
import { createSyncScheduler, type SyncScheduler } from './sync-scheduler';

const SECOND = 1_000;

describe('sync scheduler', () => {
  let handler: ((status: AppStateStatus) => void) | undefined;
  let removed: jest.Mock;
  let currentState: AppStateStatus;
  let cycles: number;
  let active: number;
  let maxActive: number;
  let outcomes: { failed: boolean }[];
  let release: (() => void) | undefined;
  let hold: boolean;
  let scheduler: SyncScheduler;

  const runCycle = async () => {
    cycles += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (hold) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    active -= 1;
    return outcomes.shift() ?? { failed: false };
  };
  const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);
  const changeAppState = async (status: AppStateStatus) => {
    currentState = status;
    handler?.(status);
    await advance(0);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    cycles = 0;
    active = 0;
    maxActive = 0;
    outcomes = [];
    hold = false;
    release = undefined;
    handler = undefined;
    removed = jest.fn();
    currentState = 'active';
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      get: () => currentState,
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      listener: (status: AppStateStatus) => void,
    ) => {
      handler = listener;
      return { remove: removed };
    }) as typeof AppState.addEventListener);
    scheduler = createSyncScheduler({ runCycle });
  });

  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs a cycle at start', async () => {
    scheduler.start();
    await advance(0);

    expect(cycles).toBe(1);
  });

  it('runs a cycle every 5 s in the foreground', async () => {
    scheduler.start();
    await advance(0);

    await advance(5 * SECOND);
    expect(cycles).toBe(2);
    await advance(4 * SECOND);
    expect(cycles).toBe(2);
    await advance(1 * SECOND);
    expect(cycles).toBe(3);
  });

  it('runs none in the background', async () => {
    scheduler.start();
    await advance(0);

    await changeAppState('background');
    await advance(60 * SECOND);

    expect(cycles).toBe(1);
  });

  it('runs a cycle on coming back to the foreground, then every 5 s again', async () => {
    scheduler.start();
    await advance(0);
    await changeAppState('background');
    await advance(60 * SECOND);

    await changeAppState('active');
    expect(cycles).toBe(2);

    await advance(5 * SECOND);
    expect(cycles).toBe(3);
  });

  it('does not run a cycle when the app only becomes inactive', async () => {
    scheduler.start();
    await advance(0);

    await changeAppState('inactive');
    await changeAppState('active');

    // `inactive` is a pause of the foreground (iOS sheets), not a stay in the background.
    expect(cycles).toBe(1);
  });

  it('runs a cycle 1 s after a write', async () => {
    scheduler.start();
    await advance(0);

    scheduler.notifyWrite();
    await advance(900);
    expect(cycles).toBe(1);
    await advance(100);
    expect(cycles).toBe(2);
  });

  it('debounces writes: each one restarts the 1 s', async () => {
    scheduler.start();
    await advance(0);

    scheduler.notifyWrite();
    await advance(500);
    scheduler.notifyWrite();
    await advance(500);
    scheduler.notifyWrite();
    await advance(900);
    expect(cycles).toBe(1);
    await advance(100);
    expect(cycles).toBe(2);
  });

  it('restarts the 5 s after a write-triggered cycle', async () => {
    scheduler.start();
    await advance(0);
    await advance(3 * SECOND);

    scheduler.notifyWrite();
    await advance(1 * SECOND);
    expect(cycles).toBe(2);

    // 5 s after that cycle, not 5 s after the previous one.
    await advance(4 * SECOND);
    expect(cycles).toBe(2);
    await advance(1 * SECOND);
    expect(cycles).toBe(3);
  });

  it('never runs two cycles at once', async () => {
    hold = true;
    scheduler.start();
    await advance(0);

    scheduler.notifyWrite();
    await advance(10 * SECOND);
    await changeAppState('background');
    await changeAppState('active');
    expect(cycles).toBe(1);

    hold = false;
    release?.();
    await advance(0);

    expect(maxActive).toBe(1);
    // What was requested during the cycle runs once it ends.
    expect(cycles).toBeGreaterThanOrEqual(2);
  });

  it('backs off after failures: 10 s, 20 s, 40 s, up to 5 min', async () => {
    outcomes = Array.from({ length: 10 }, () => ({ failed: true }));
    scheduler.start();
    await advance(0);

    const gaps: number[] = [];
    for (let previous = cycles; gaps.length < 8;) {
      let waited = 0;
      while (cycles === previous) {
        await advance(SECOND);
        waited += SECOND;
      }
      gaps.push(waited / SECOND);
      previous = cycles;
    }

    expect(gaps).toEqual([10, 20, 40, 80, 160, 300, 300, 300]);
  });

  it('resets the delay to 5 s after a success', async () => {
    outcomes = [{ failed: true }, { failed: true }, { failed: false }];
    scheduler.start();
    await advance(0);
    await advance(10 * SECOND);
    await advance(20 * SECOND);
    expect(cycles).toBe(3);

    await advance(5 * SECOND);

    expect(cycles).toBe(4);
  });

  it('stops: no more cycles, and the app state listener is removed', async () => {
    scheduler.start();
    await advance(0);

    scheduler.stop();
    scheduler.notifyWrite();
    await advance(60 * SECOND);

    expect(cycles).toBe(1);
    expect(removed).toHaveBeenCalledTimes(1);
  });
});

describe('the store after a cycle', () => {
  const NO_EFFECTS = { deletedArticles: [], removedItems: [], merges: [] };
  let result: SyncResult;

  const buildStore = async () => {
    const built = await buildStoryStore({ seed: fixture });
    const getCurrentList = jest.fn(built.useCases.getCurrentList);
    const synchronize = jest.fn(async () => result);
    const useCases: UseCases = {
      ...built.useCases,
      getCurrentList,
      synchronize,
    };
    const store = createAppStore({
      useCases,
      errorReporter: new RecordingErrorReporter(),
    });
    await store.getState().loadCurrentList();
    getCurrentList.mockClear();
    return { store, getCurrentList, synchronize };
  };

  beforeEach(() => {
    result = {
      outcome: { type: 'saved' },
      effects: NO_EFFECTS,
      pulledRows: 0,
    };
  });

  it('runs refresh() after a cycle that pulled rows', async () => {
    const { store, getCurrentList } = await buildStore();
    result = { ...result, pulledRows: 3 };

    await store.getState().syncNow();

    expect(getCurrentList).toHaveBeenCalledTimes(1);
  });

  it('does not refresh after a cycle that pulled nothing', async () => {
    const { store, getCurrentList } = await buildStore();

    await store.getState().syncNow();

    expect(getCurrentList).not.toHaveBeenCalled();
  });

  it('reports the cycle as failed when it ended waiting or failed', async () => {
    const { store } = await buildStore();

    result = { ...result, outcome: { type: 'saved' } };
    expect(await store.getState().syncNow()).toEqual({ failed: false });
    result = { ...result, outcome: { type: 'waiting' } };
    expect(await store.getState().syncNow()).toEqual({ failed: true });
    result = {
      ...result,
      outcome: { type: 'failed', reason: 'ServerError' },
    };
    expect(await store.getState().syncNow()).toEqual({ failed: true });
  });

  it('shows "sending" during the cycle, then "saved"', async () => {
    const { store, synchronize } = await buildStore();
    let finish!: (value: SyncResult) => void;
    synchronize.mockImplementationOnce(
      () => new Promise<SyncResult>((resolve) => (finish = resolve)),
    );

    const cycle = store.getState().syncNow();
    await Promise.resolve();
    expect(store.getState().sync.status).toBe('sending');
    finish(result);
    await cycle;

    expect(store.getState().sync.status).toBe('saved');
  });

  it('shows "waiting" when the server cannot be reached, without a notice', async () => {
    const { store } = await buildStore();
    result = { ...result, outcome: { type: 'waiting' } };

    await store.getState().syncNow();

    expect(store.getState().sync.status).toBe('waiting');
    expect(store.getState().notice).toBeNull();
  });
});
