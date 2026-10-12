import { buildApp } from '../adapters/http/app';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import { createPairingCode } from '../application/use-cases/create-pairing-code';
import type { Clock } from '../application/ports/clock';
import type { MailMessage } from '../application/ports/mailer';
import type { AppDeps } from '../adapters/http/app';
import type { AccountRole } from '@mes-courses/sync-core';
import { createFakeMailer } from '../application/testing/fake-mailer';
import { createFakePasswordHasher } from '../application/testing/fake-password-hasher';
import { appDeps } from '../composition/wiring';

export type TestAccount = { accountId: string; deviceCredential: string };

/**
 * Creates an active account with one device straight in the store, as the Pi commands and a
 * sign-in would have: the credential is what the device sends as its Bearer token.
 */
const createTestAccount = async (
  deps: AppDeps,
  { role = 'user', email }: { role?: AccountRole; email?: string } = {},
): Promise<TestAccount> => {
  const accountId = deps.ids.next();
  const deviceCredential = deps.crypto.generateCredential();
  const now = new Date(deps.clock.nowMs()).toISOString();
  await deps.store.run(async ({ accounts, devices }) => {
    await accounts.add({
      id: accountId,
      email: email ?? `${accountId}@example.org`,
      role,
      passwordHash: await deps.hasher.hash('a long enough password'),
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
      suspendedAt: null,
      createdAt: now,
    });
    await devices.add({
      id: deps.ids.next(),
      accountId,
      name: 'Test phone',
      credentialHash: deps.crypto.sha256Hex(deviceCredential),
      createdAt: now,
      lastSyncAt: null,
      revokedAt: null,
    });
  });
  return { accountId, deviceCredential };
};

export type TestServer = {
  url: string;
  /** An active account with a device, created directly in the store. */
  createAccount(options?: {
    role?: AccountRole;
    email?: string;
  }): Promise<TestAccount>;
  /** The emails the server sent, in order. */
  mails(): MailMessage[];
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
  const mailer = createFakeMailer();
  const deps = appDeps({
    store,
    errorReporter: { report: () => undefined },
    mailer,
    publicUrl: 'https://courses.test',
    hasher: createFakePasswordHasher(),
    ...(clock ? { clock } : {}),
  });
  return {
    app: buildApp(deps),
    deps,
    store,
    db,
    mailer,
    createAccount: (options?: { role?: AccountRole; email?: string }) =>
      createTestAccount(deps, options),
  };
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
  const { app, deps, db, mailer, createAccount } = buildTestApp(
    clock ? { clock } : {},
  );
  const listen = async (instance: typeof app, port: number) => {
    await instance.listen({ host: '127.0.0.1', port });
    const address = instance.server.address();
    return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  };
  const url = await listen(app, wantedPort);
  return {
    url,
    createAccount,
    mails: () => [...mailer.sent],
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
