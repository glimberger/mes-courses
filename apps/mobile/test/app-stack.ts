import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { prepareDatabase } from '../src/adapters/sqlite/prepare-database';
import { SqliteUnitOfWork } from '../src/adapters/sqlite/unit-of-work';
import { createSyncServer } from '../src/adapters/sync-http/sync-server';
import { seed } from '../src/adapters/ui/seed';
import { createUseCases, type UseCases } from '../src/adapters/ui/use-cases';
import type { Clock } from '../src/application/ports/clock';
import type { CredentialStore } from '../src/application/ports/credential-store';
import type { UnitOfWork } from '../src/application/ports/unit-of-work';
import { InMemoryCredentialStore } from '../src/application/testing/in-memory-credential-store';
import { NodeSqlDatabase } from './sqlite/node-sql-database';

const folders: string[] = [];

/**
 * A database file of its own, removed when the process ends: `prepareDatabase` turns the WAL
 * journal on, which an in-memory database cannot do.
 */
const newDatabase = (): NodeSqlDatabase => {
  if (folders.length === 0) {
    process.once('exit', () => {
      for (const folder of folders)
        rmSync(folder, { recursive: true, force: true });
    });
  }
  const folder = mkdtempSync(join(tmpdir(), 'mes-courses-stack-'));
  folders.push(folder);
  return new NodeSqlDatabase(join(folder, 'mes-courses.db'));
};

export type TestAppStack = {
  useCases: UseCases;
  unitOfWork: UnitOfWork;
  credentials: CredentialStore;
  database: NodeSqlDatabase;
};

/**
 * One device's app, wired as the composition root wires it in production, minus the UI: SQLite
 * (`node:sqlite`), the real `SyncServer` adapter over `fetch` and the real use cases, with the
 * clock given. The store is seeded as at first launch.
 *
 * Pass the `database` and the `credentials` of a stack to build another on them, as a restarted
 * app would; the secure storage lives outside the database, so a restart keeps it too.
 */
export const buildTestAppStack = async ({
  serverUrl,
  clock,
  database = newDatabase(),
  credentials = new InMemoryCredentialStore(),
  fetch: fetchFn,
}: {
  serverUrl: string;
  clock: Clock;
  database?: NodeSqlDatabase;
  credentials?: CredentialStore;
  /** In place of the global `fetch`, to cut the network or watch the requests. */
  fetch?: typeof fetch;
}): Promise<TestAppStack> => {
  await prepareDatabase(database);
  const ids = { next: () => randomUUID() };
  const unitOfWork = new SqliteUnitOfWork(database, { clock, ids });
  const useCases = createUseCases({
    unitOfWork,
    ids,
    clock,
    syncServer: createSyncServer({
      appVersion: '1.0.0',
      ...(fetchFn ? { fetch: fetchFn } : {}),
    }),
    credentials,
    // The test server listens on 127.0.0.1 without TLS.
    allowInsecure: serverUrl.startsWith('http://'),
  });
  await useCases.initializeStore(seed);
  return { useCases, unitOfWork, credentials, database };
};
