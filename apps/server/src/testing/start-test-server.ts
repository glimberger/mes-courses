import { buildApp } from '../adapters/http/app';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import { createPairingCode } from '../application/use-cases/create-pairing-code';
import type { Clock } from '../application/ports/clock';
import { appDeps } from '../composition/wiring';

export type TestServer = {
  url: string;
  /** A fresh code, as the Pi command would create one. */
  createPairingCode(): Promise<string>;
  /**
   * Answers at a second address over the same database, as a server whose domain name changed:
   * same identity, new URL. Closing the server leaves it open; close it apart.
   */
  listenAlso(): Promise<{ url: string; close(): Promise<void> }>;
  close(): Promise<void>;
};

/**
 * The HTTP app over a real SQLite store in memory, not listening: for tests that call it through
 * `inject`. The caller closes `db`.
 */
export const buildTestApp = ({ clock }: { clock?: Clock } = {}) => {
  const db = openDatabase(':memory:');
  const store = new SqliteStore(db);
  const deps = appDeps({
    store,
    errorReporter: { report: () => undefined },
    ...(clock ? { clock } : {}),
  });
  return { app: buildApp(deps), deps, store, db };
};

/** A real server on a random local port over an in-memory database, for adapter tests. */
export const startTestServer = async ({
  clock,
  port: wantedPort = 0,
}: {
  clock?: Clock;
  /** To come back at the address of a server just closed, with a database of its own. */
  port?: number;
} = {}): Promise<TestServer> => {
  const { app, deps, db } = buildTestApp(clock ? { clock } : {});
  const listen = async (instance: typeof app, port: number) => {
    await instance.listen({ host: '127.0.0.1', port });
    const address = instance.server.address();
    return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  };
  const url = await listen(app, wantedPort);
  return {
    url,
    createPairingCode: async () => (await createPairingCode(deps, null)).code,
    listenAlso: async () => {
      const other = buildApp(deps);
      return { url: await listen(other, 0), close: () => other.close() };
    },
    close: async () => {
      await app.close();
      db.close();
    },
  };
};
