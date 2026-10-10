import Constants from 'expo-constants';

import type { ErrorReporter } from '../application/ports/error-reporter';
import { ConsoleErrorReporter } from '../adapters/error-reporting/console-error-reporter';
import { createSentryErrorReporter } from '../adapters/error-reporting/sentry-error-reporter';
import { CryptoIdGenerator } from '../adapters/id/crypto-id-generator';
import { closeOnFailure } from '../adapters/sqlite/close-on-failure';
import { SecureStoreCredentialStore } from '../adapters/secure-store/credential-store';
import { createSyncServer } from '../adapters/sync-http/sync-server';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SystemClock } from '../adapters/clock/system-clock';
import { SqliteUnitOfWork } from '../adapters/sqlite/unit-of-work';
import { seed } from '../adapters/ui/seed';
import { createAppStore, type AppStore } from '../adapters/ui/state/app-store';
import { createSyncScheduler } from '../adapters/ui/state/sync-scheduler';
import { createUseCases } from '../adapters/ui/use-cases';
import { seedForMeasurement } from './measurement-seed';

/**
 * The error reporter of this opening of the app: Sentry when a DSN is set, in the environment of
 * the build (research R13), the console otherwise. `App.tsx` builds it first, so a storage
 * failure at startup can be reported.
 */
export const createErrorReporter = (): ErrorReporter => {
  // Expo inlines `EXPO_PUBLIC_` variables only when read as written here.
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return dsn
    ? createSentryErrorReporter({
        dsn,
        environment: process.env.EXPO_PUBLIC_APP_ENVIRONMENT,
      })
    : new ConsoleErrorReporter();
};

/** How long after startup the native smoke test crashes, so the app is seen running first. */
const NATIVE_CRASH_DELAY_MS = 10_000;

/**
 * The build-time Sentry smoke test (quickstart §6 step 5), off in builds for users: with
 * `EXPO_PUBLIC_SENTRY_SMOKE_TEST=1`, one test error is reported at startup; with `native`, the
 * app crashes in native code 10 seconds after startup. Returns how to cancel a crash not yet due.
 */
const startSentrySmokeTest = (reporter: ErrorReporter): (() => void) => {
  // Expo inlines `EXPO_PUBLIC_` variables only when read as written here.
  const mode = process.env.EXPO_PUBLIC_SENTRY_SMOKE_TEST;
  if (mode === '1') {
    reporter.report(new Error('Sentry smoke test'), {
      operation: 'smokeTest',
      screen: 'CurrentList',
    });
  }
  if (mode !== 'native') return () => undefined;
  const timer = setTimeout(
    () => reporter.crashNatively(),
    NATIVE_CRASH_DELAY_MS,
  );
  return () => clearTimeout(timer);
};

/** The app once started: its store, and how to close the database under it. */
export type ComposedApp = {
  store: AppStore;
  /** Closes the database; what the store still had running then is no longer reported. */
  close: () => Promise<void>;
};

/** `reporter` until `mute` is called, then a reporter that drops reports. */
const mutable = (reporter: ErrorReporter) => {
  let muted = false;
  const muting: ErrorReporter = {
    report: (error, context) => {
      if (!muted) reporter.report(error, context);
    },
    setScreen: (screen) => reporter.setScreen(screen),
    clearScreen: () => reporter.clearScreen(),
    crashNatively: () => reporter.crashNatively(),
  };
  return {
    reporter: muting,
    mute: () => {
      muted = true;
    },
  };
};

/**
 * Starts the app (research R18a): opens and prepares the database, builds the use cases on it,
 * seeds a store with no list, fills it for measurement if the build asks for it (research R11),
 * then builds the store and starts the Sentry smoke test if the build asks for it. When a step
 * after the opening throws, the database is closed and the error rethrown, so a retry starts from
 * scratch. Once the app is closed, the failures of the writes and
 * loads its store still had running (they fail on the closed database) are not reported, and a
 * native smoke test crash not yet due is cancelled. Nothing here deletes, recreates or overwrites
 * the database file. This is the only module that knows every adapter.
 */
export const composeApp = async (
  errorReporter: ErrorReporter,
): Promise<ComposedApp> => {
  const db = await openDatabase();
  const ids = new CryptoIdGenerator();
  const clock = new SystemClock();
  return closeOnFailure(db, async () => {
    const useCases = createUseCases({
      unitOfWork: new SqliteUnitOfWork(db, { clock, ids }),
      ids,
      clock,
      syncServer: createSyncServer({
        appVersion: Constants.expoConfig?.version ?? '0.0.0',
      }),
      credentials: new SecureStoreCredentialStore(),
      // Expo inlines `EXPO_PUBLIC_` variables only when read as written here.
      allowInsecure:
        __DEV__ && process.env.EXPO_PUBLIC_ALLOW_INSECURE_SYNC_URL === '1',
    });
    await useCases.initializeStore(seed);
    // Expo inlines `EXPO_PUBLIC_` variables only when read as written here.
    await seedForMeasurement(useCases, process.env.EXPO_PUBLIC_SEED_ITEMS);
    const reporting = mutable(errorReporter);
    const stopSmokeTest = startSentrySmokeTest(errorReporter);
    // The store and the scheduler need each other: a write wakes the scheduler, a cycle runs
    // through the store.
    const scheduler = createSyncScheduler({
      runCycle: () => store.getState().syncNow(),
    });
    const store = createAppStore({
      useCases,
      errorReporter: reporting.reporter,
      onLocalWrite: scheduler.notifyWrite,
    });
    scheduler.start();
    return {
      store,
      close: () => {
        scheduler.stop();
        stopSmokeTest();
        reporting.mute();
        return db.closeAsync();
      },
    };
  });
};
