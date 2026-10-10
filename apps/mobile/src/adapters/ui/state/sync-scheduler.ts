import { AppState, type AppStateStatus } from 'react-native';

export type SyncSchedulerDeps = {
  /** Runs one cycle; `failed` makes the next delay grow (research R9, R14). */
  runCycle: () => Promise<{ failed: boolean }>;
};

export type SyncScheduler = {
  /** Runs a cycle now and keeps running them while the app is in the foreground. */
  start: () => void;
  stop: () => void;
  /** A local write was saved: a cycle runs 1 s later, restarting the delay on each write. */
  notifyWrite: () => void;
};

const WRITE_DELAY_MS = 1_000;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60_000;

/** 5 s, then 10 s, 20 s, … up to 5 min after each failed cycle in a row. */
const delayAfter = (failures: number): number =>
  Math.min(BASE_DELAY_MS * 2 ** failures, MAX_DELAY_MS);

export const createSyncScheduler = ({
  runCycle,
}: SyncSchedulerDeps): SyncScheduler => {
  let started = false;
  let background = false;
  let running = false;
  let queued = false;
  let failures = 0;
  let cycleTimer: ReturnType<typeof setTimeout> | undefined;
  let writeTimer: ReturnType<typeof setTimeout> | undefined;
  let subscription: { remove: () => void } | undefined;

  const clearTimers = () => {
    clearTimeout(cycleTimer);
    clearTimeout(writeTimer);
    cycleTimer = undefined;
    writeTimer = undefined;
  };

  const scheduleNext = () => {
    clearTimeout(cycleTimer);
    cycleTimer = setTimeout(request, delayAfter(failures));
  };

  const run = async () => {
    running = true;
    clearTimers();
    let failed: boolean;
    try {
      ({ failed } = await runCycle());
    } catch {
      // The store reports its own failures; a cycle that throws counts as failed.
      failed = true;
    }
    running = false;
    failures = failed ? failures + 1 : 0;
    if (!started || background) {
      queued = false;
      return;
    }
    if (queued) {
      queued = false;
      await run();
      return;
    }
    scheduleNext();
  };

  /** Never two cycles at once: a request during a cycle runs once it ends. */
  function request() {
    if (!started || background) return;
    if (running) {
      queued = true;
      return;
    }
    void run();
  }

  const onAppStateChange = (status: AppStateStatus) => {
    if (status === 'background') {
      background = true;
      clearTimers();
      return;
    }
    // `inactive` pauses the foreground (iOS sheets); only a return from the background syncs.
    if (status === 'active' && background) {
      background = false;
      request();
    }
  };

  return {
    start: () => {
      if (started) return;
      started = true;
      background = AppState.currentState === 'background';
      subscription = AppState.addEventListener('change', onAppStateChange);
      request();
    },
    stop: () => {
      started = false;
      queued = false;
      clearTimers();
      subscription?.remove();
      subscription = undefined;
    },
    notifyWrite: () => {
      if (!started || background) return;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(request, WRITE_DELAY_MS);
    },
  };
};
