/** @jest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as Sentry from '@sentry/react-native';

import { RecordingErrorReporter } from '../application/testing/recording-error-reporter';
import * as initializeStoreModule from '../application/use-cases/initialize-store';
import { ConsoleErrorReporter } from '../adapters/error-reporting/console-error-reporter';
import * as appStoreModule from '../adapters/ui/state/app-store';
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
