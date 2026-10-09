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
  close(): Promise<void>;
};

/** A real server on a random local port over an in-memory database, for adapter tests. */
export const startTestServer = async ({
  clock,
}: { clock?: Clock } = {}): Promise<TestServer> => {
  const db = openDatabase(':memory:');
  const deps = appDeps({
    store: new SqliteStore(db),
    errorReporter: { report: () => undefined },
    ...(clock ? { clock } : {}),
  });
  const app = buildApp(deps);
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    createPairingCode: async () => (await createPairingCode(deps, null)).code,
    close: async () => {
      await app.close();
      db.close();
    },
  };
};
