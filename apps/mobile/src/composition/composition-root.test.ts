/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Sentry from '@sentry/react-native';

import { RecordingErrorReporter } from '../application/testing/recording-error-reporter';
import * as initializeStoreModule from '../application/use-cases/initialize-store';
import { ConsoleErrorReporter } from '../adapters/error-reporting/console-error-reporter';
import * as appStoreModule from '../adapters/ui/state/app-store';
import * as syncSchedulerModule from '../adapters/ui/state/sync-scheduler';
import { NodeSqlDatabase } from '../../test/sqlite/node-sql-database';
import { composeApp, createErrorReporter } from './composition-root';

// expo-sqlite does not load in Node: each open gives a `node:sqlite` database on the test's file,
// and the real `openDatabase` prepares it as on a device.
const mockOpened: NodeSqlDatabase[] = [];
let mockFile = '';
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    const { NodeSqlDatabase: Database } = jest.requireActual<
      typeof import('../../test/sqlite/node-sql-database')
    >('../../test/sqlite/node-sql-database');
    const db = new Database(mockFile);
    mockOpened.push(db);
    return db;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));
jest.mock('expo-secure-store', () => ({}));
// The scheduler reads React Native's `AppState`, which does not load in this Node environment.
jest.mock('../adapters/ui/state/sync-scheduler', () => ({
  createSyncScheduler: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  captureException: jest.fn(),
  nativeCrash: jest.fn(),
}));

let folder: string;

/** The database the composition root opened at the given start, counted from 0. */
const opened = (start: number): NodeSqlDatabase => {
  const db = mockOpened[start];
  if (!db) throw new Error(`No database opened at start ${start}`);
  return db;
};

beforeEach(() => {
  jest.mocked(syncSchedulerModule.createSyncScheduler).mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    notifyWrite: jest.fn(),
  });
  folder = mkdtempSync(join(tmpdir(), 'mes-courses-'));
  mockFile = join(folder, 'mes-courses.db');
  mockOpened.length = 0;
});

afterEach(() => {
  for (const db of mockOpened) if (db.isOpen) db.close();
  rmSync(folder, { recursive: true, force: true });
});

/** What the database file holds, read on a connection of its own. */
const stored = async () => {
  const db = new NodeSqlDatabase(mockFile);
  try {
    return {
      categories: await db.getAllAsync<{ id: string; name: string }>(
        'SELECT id, name FROM category ORDER BY position',
        [],
      ),
      lists: await db.getAllAsync<{ id: string; name: string }>(
        'SELECT id, name FROM shopping_list',
        [],
      ),
      current: await db.getFirstAsync<{ current_list_id: string }>(
        'SELECT current_list_id FROM app_state',
        [],
      ),
    };
  } finally {
    db.close();
  }
};

describe('composeApp', () => {
  it('FR-020 FR-023 seeds the 11 default categories and "Ma liste" as current on a fresh start', async () => {
    const { store } = await composeApp(new RecordingErrorReporter());

    const data = await stored();
    expect(data.categories.map((category) => category.name)).toEqual([
      'Fruits et légumes',
      'Boucherie et poissonnerie',
      'Crèmerie',
      'Boulangerie',
      'Épicerie salée',
      'Épicerie sucrée',
      'Surgelés',
      'Boissons',
      'Hygiène et beauté',
      'Entretien',
      'Divers',
    ]);
    expect(data.lists.map((list) => list.name)).toEqual(['Ma liste']);
    expect(data.current?.current_list_id).toBe(data.lists[0]?.id);
    expect(store.getState().currentList).toEqual({ status: 'idle' });
  });

  it('FR-020 does not seed again on a second start', async () => {
    await (await composeApp(new RecordingErrorReporter())).close();
    const first = await stored();

    await composeApp(new RecordingErrorReporter());

    expect(await stored()).toEqual(first);
  });

  it('FR-028 prepares the database as openDatabase does on a device: WAL journal, full sync', async () => {
    await composeApp(new RecordingErrorReporter());

    const db = opened(0);
    expect(await db.getFirstAsync('PRAGMA journal_mode', [])).toEqual({
      journal_mode: 'wal',
    });
    expect(await db.getFirstAsync('PRAGMA synchronous', [])).toEqual({
      synchronous: 2,
    });
  });

  it('FR-039 closes the database and rethrows when initializeStore throws, and keeps the data for the next start', async () => {
    await (await composeApp(new RecordingErrorReporter())).close();
    const before = await stored();
    const failure = new Error('initializeStore failed');
    jest
      .spyOn(initializeStoreModule, 'createInitializeStore')
      .mockReturnValueOnce(() => Promise.reject(failure));

    await expect(composeApp(new RecordingErrorReporter())).rejects.toBe(
      failure,
    );
    expect(opened(1).isOpen).toBe(false);

    await composeApp(new RecordingErrorReporter());
    expect(await stored()).toEqual(before);
  });

  it('reports the store failures until the app is closed, and none after', async () => {
    const createAppStore = jest.spyOn(appStoreModule, 'createAppStore');
    const reporter = new RecordingErrorReporter();
    const composed = await composeApp(reporter);
    const storeReporter = createAppStore.mock.calls[0]?.[0].errorReporter;
    createAppStore.mockRestore();
    const before = new Error('write failed while open');

    storeReporter?.report(before, { operation: 'write' });
    await composed.close();
    storeReporter?.report(new Error('database closed'), { operation: 'write' });
    storeReporter?.setScreen('Lists');

    expect(reporter.reports).toEqual([
      { error: before, context: { operation: 'write' } },
    ]);
    expect(reporter.screens).toEqual(['Lists']);
  });

  it('US1 starts the sync scheduler on the store and stops it when the app is closed', async () => {
    const start = jest.fn();
    const stop = jest.fn();
    const notifyWrite = jest.fn();
    let runCycle: syncSchedulerModule.SyncSchedulerDeps['runCycle'] | undefined;
    jest
      .mocked(syncSchedulerModule.createSyncScheduler)
      .mockImplementation((deps) => {
        runCycle = deps.runCycle;
        return { start, stop, notifyWrite };
      });

    const composed = await composeApp(new RecordingErrorReporter());

    expect(start).toHaveBeenCalledTimes(1);
    // A device that was never connected has nothing to sync: the cycle succeeds.
    expect(await runCycle?.()).toEqual({ failed: false });
    await composed.store.getState().createList('Barbecue');
    expect(notifyWrite).toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    await composed.close();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('closes the database it opened when the app is closed', async () => {
    const composed = await composeApp(new RecordingErrorReporter());

    await composed.close();

    await expect(opened(0).getFirstAsync('SELECT 1', [])).rejects.toThrow();
  });
});

describe('createErrorReporter', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    jest.mocked(Sentry.init).mockClear();
  });

  it('FR-030 reports to Sentry, in the given environment, when a DSN is set', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@o1.ingest.de.sentry.io/1';
    process.env.EXPO_PUBLIC_APP_ENVIRONMENT = 'preview';

    const reporter = createErrorReporter();

    expect(reporter).not.toBeInstanceOf(ConsoleErrorReporter);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'preview' }),
    );
  });

  it('FR-030 prints to the console and sends nothing without a DSN', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    process.env.EXPO_PUBLIC_APP_ENVIRONMENT = 'production';

    expect(createErrorReporter()).toBeInstanceOf(ConsoleErrorReporter);
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});

describe('the measurement seed (research R11)', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  const articleCount = async () => {
    const db = new NodeSqlDatabase(mockFile);
    try {
      return (
        await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM article',
          [],
        )
      )?.count;
    } finally {
      db.close();
    }
  };

  it("fills the store to the spec's data size when EXPO_PUBLIC_SEED_ITEMS is set", async () => {
    process.env.EXPO_PUBLIC_SEED_ITEMS = '2';

    const composed = await composeApp(new RecordingErrorReporter());
    await composed.close();

    expect(await articleCount()).toBe(1000);
  }, 60_000);

  it('adds no article when EXPO_PUBLIC_SEED_ITEMS is unset', async () => {
    delete process.env.EXPO_PUBLIC_SEED_ITEMS;

    const composed = await composeApp(new RecordingErrorReporter());
    await composed.close();

    expect(await articleCount()).toBe(0);
  });
});

describe('the Sentry smoke test (quickstart §6 step 5)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    // Promises and the database run as usual; only the timers are under the test's control.
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...env };
  });

  it('with "1", reports one test error at startup, on CurrentList', async () => {
    process.env.EXPO_PUBLIC_SENTRY_SMOKE_TEST = '1';
    const reporter = new RecordingErrorReporter();

    const composed = await composeApp(reporter);
    jest.advanceTimersByTime(10_000);

    expect(reporter.reports).toEqual([
      {
        error: expect.any(Error),
        context: { operation: 'smokeTest', screen: 'CurrentList' },
      },
    ]);
    expect(reporter.nativeCrashes).toBe(0);
    await composed.close();
  });

  it('with "native", crashes in native code 10 seconds after startup, and not before', async () => {
    process.env.EXPO_PUBLIC_SENTRY_SMOKE_TEST = 'native';
    const reporter = new RecordingErrorReporter();

    const composed = await composeApp(reporter);
    jest.advanceTimersByTime(9_999);
    expect(reporter.nativeCrashes).toBe(0);
    jest.advanceTimersByTime(1);

    expect(reporter.nativeCrashes).toBe(1);
    expect(reporter.reports).toEqual([]);
    await composed.close();
  });

  it('with "native", crashes nothing once the app is closed before then', async () => {
    process.env.EXPO_PUBLIC_SENTRY_SMOKE_TEST = 'native';
    const reporter = new RecordingErrorReporter();

    const composed = await composeApp(reporter);
    await composed.close();
    jest.advanceTimersByTime(10_000);

    expect(reporter.nativeCrashes).toBe(0);
  });

  it.each([undefined, '', '0', 'true', 'NATIVE'])(
    'with %p, reports and crashes nothing',
    async (value) => {
      if (value === undefined) delete process.env.EXPO_PUBLIC_SENTRY_SMOKE_TEST;
      else process.env.EXPO_PUBLIC_SENTRY_SMOKE_TEST = value;
      const reporter = new RecordingErrorReporter();

      const composed = await composeApp(reporter);
      jest.advanceTimersByTime(10_000);

      expect(reporter.reports).toEqual([]);
      expect(reporter.nativeCrashes).toBe(0);
      await composed.close();
    },
  );
});
