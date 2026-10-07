import type { ErrorReporter } from '../application/ports/error-reporter';
import { ConsoleErrorReporter } from '../adapters/error-reporting/console-error-reporter';
import { createSentryErrorReporter } from '../adapters/error-reporting/sentry-error-reporter';
import { CryptoIdGenerator } from '../adapters/id/crypto-id-generator';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteUnitOfWork } from '../adapters/sqlite/unit-of-work';
import { seed } from '../adapters/ui/seed';
import { createAppStore, type AppStore } from '../adapters/ui/state/app-store';
import { createUseCases } from '../adapters/ui/use-cases';

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

/** The app once started: its store, and how to close the database under it. */
export type ComposedApp = {
  store: AppStore;
  close: () => Promise<void>;
};

/**
 * Starts the app (research R18a): opens and prepares the database, builds the use cases on it,
 * seeds a store with no list, then builds the store. When a step after the opening throws, the
 * database is closed and the error rethrown, so a retry starts from scratch. Nothing here
 * deletes, recreates or overwrites the database file. This is the only module that knows every
 * adapter.
 */
export const composeApp = async (
  errorReporter: ErrorReporter,
): Promise<ComposedApp> => {
  const db = await openDatabase();
  try {
    const useCases = createUseCases({
      unitOfWork: new SqliteUnitOfWork(db),
      ids: new CryptoIdGenerator(),
    });
    await useCases.initializeStore(seed);
    return {
      store: createAppStore({ useCases, errorReporter }),
      close: () => db.closeAsync(),
    };
  } catch (error) {
    // The failure to report is the first one, not a failure to close.
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
};
