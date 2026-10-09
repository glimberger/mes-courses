import { buildApp } from '../adapters/http/app';
import { createSentryErrorReporter } from '../adapters/error-reporting/sentry-error-reporter';
import { ConsoleErrorReporter } from '../adapters/error-reporting/console-error-reporter';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import type { ErrorReporter } from '../application/ports/error-reporter';
import { databasePath, LISTEN_HOST, listenPort } from './config';
import { installCrashHandlers, type ProcessLike } from './crash-handlers';
import { appDeps } from './wiring';

type Env = Record<string, string | undefined>;

export type RunningServer = { url: string; close(): Promise<void> };

/**
 * Starts the server on 127.0.0.1 only (Caddy is the public entry, research R2). `proc` and `exit`
 * are injected so the crash handlers can be tested.
 */
export const main = async (
  env: Env,
  proc: ProcessLike,
  exit: (code: number) => void,
): Promise<RunningServer> => {
  const errorReporter: ErrorReporter = env.SENTRY_DSN
    ? createSentryErrorReporter({
        dsn: env.SENTRY_DSN,
        release: env.npm_package_version ?? 'unknown',
        environment: env.MES_COURSES_ENV ?? 'production',
      })
    : new ConsoleErrorReporter();
  installCrashHandlers(proc, errorReporter, exit);

  const db = openDatabase(databasePath(env));
  const app = buildApp(appDeps({ store: new SqliteStore(db), errorReporter }));
  try {
    await app.listen({ host: LISTEN_HOST, port: listenPort(env) });
  } catch (error) {
    db.close();
    throw error;
  }
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: `http://${LISTEN_HOST}:${port}`,
    close: async () => {
      await app.close();
      db.close();
    },
  };
};

if (require.main === module) {
  main(process.env, process, process.exit).catch((error: unknown) => {
    console.error('could not start', error);
    process.exit(1);
  });
}
