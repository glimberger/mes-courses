import { DatabaseSync } from 'node:sqlite';

import { buildApp } from '../adapters/http/app';
import { MIGRATIONS, migrate } from '../adapters/sqlite/migrations';
import {
  NodeSqlDatabase,
  openDatabase,
} from '../adapters/sqlite/open-database';
import type { SqlDatabase } from '../adapters/sqlite/sql-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import type { Clock } from '../application/ports/clock';
import type {
  ErrorContext,
  ErrorReporter,
} from '../application/ports/error-reporter';
import type { MailMessage } from '../application/ports/mailer';
import { normalizeTemporaryPassword } from '@mes-courses/sync-core';
import { signIn } from '../application/use-cases/sign-in';
import { temporaryExpiresAt } from '../domain/account';
import type { AppDeps } from '../adapters/http/app';
import type { AccountRole } from '@mes-courses/sync-core';
import {
  createFakeMailer,
  type FakeMailer,
} from '../application/testing/fake-mailer';
import { createFakePasswordHasher } from '../application/testing/fake-password-hasher';
import { appDeps } from '../composition/wiring';

/** The password of an account made by `createAccount`. */
export const TEST_PASSWORD = 'a long enough password';

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
      passwordHash: await deps.hasher.hash(TEST_PASSWORD),
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

/** Adds a device to an account straight in the store; returns its id and its Bearer credential. */
export const addTestDevice = async (
  deps: AppDeps,
  accountId: string,
  name = 'Phone',
): Promise<{ deviceId: string; credential: string }> => {
  const deviceId = deps.ids.next();
  const credential = deps.crypto.generateCredential();
  await deps.store.run(({ devices }) =>
    devices.add({
      id: deviceId,
      accountId,
      name,
      credentialHash: deps.crypto.sha256Hex(credential),
      createdAt: new Date(deps.clock.nowMs()).toISOString(),
      lastSyncAt: null,
      revokedAt: null,
    }),
  );
  return { deviceId, credential };
};

/** What the test helpers hand back for an account that was invited. */
export type InvitedAccount = {
  accountId: string;
  email: string;
  temporaryPassword: string;
};

/** An error report the server made; the tests check what it holds and what it does not. */
export type RecordedReport = { error: unknown; context: ErrorContext };

/**
 * Creates an invited account with a known temporary password straight in the store (no mail), as
 * `inviteAccount` would have left it.
 */
const inviteTestAccount = async (
  deps: AppDeps,
  email: string,
): Promise<InvitedAccount> => {
  const accountId = deps.ids.next();
  const temporaryPassword = deps.crypto.generateTemporaryPassword();
  const nowMs = deps.clock.nowMs();
  await deps.store.run(async ({ accounts }) => {
    await accounts.add({
      id: accountId,
      email,
      role: 'user',
      passwordHash: null,
      temporaryPasswordHash: await deps.hasher.hash(
        normalizeTemporaryPassword(temporaryPassword),
      ),
      temporaryExpiresAt: temporaryExpiresAt(nowMs),
      suspendedAt: null,
      createdAt: new Date(nowMs).toISOString(),
    });
  });
  return { accountId, email, temporaryPassword };
};

/** Signs in through the use case, as a device of the test; throws if the server refuses. */
const signInTestDevice = async (
  deps: AppDeps,
  email: string,
  password: string,
  deviceName = 'Test phone',
): Promise<TestAccount> => {
  const outcome = await signIn(deps, {
    email,
    password,
    deviceName,
    clientAddress: '127.0.0.1',
  });
  if (outcome.kind !== 'signedIn') {
    throw new Error(`Sign-in refused: ${outcome.kind}`);
  }
  return {
    accountId: outcome.account.id,
    deviceCredential: outcome.credential,
  };
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
  /** What the server reported as errors, in order. */
  reports(): RecordedReport[];
  /** An invited account with a known temporary password; no email is sent. */
  invite(email: string): Promise<InvitedAccount>;
  /** Suspends an account straight in the store (the administrator routes come with US5). */
  suspend(accountId: string): Promise<void>;
  /** Signs a device in with the current password; throws if refused. */
  signIn(
    email: string,
    password: string,
    deviceName?: string,
  ): Promise<TestAccount>;
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
export const buildTestApp = ({
  clock,
  mailer = createFakeMailer(),
  database,
}: { clock?: Clock; mailer?: FakeMailer; database?: SqlDatabase } = {}) => {
  let db: SqlDatabase;
  if (database) {
    // A database left by an older version: the server migrates it as it does at start.
    db = database;
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db);
  } else {
    db = openDatabase(':memory:');
  }
  const store = new SqliteStore(db);
  const reports: RecordedReport[] = [];
  const errorReporter: ErrorReporter = {
    report: (error, context) => void reports.push({ error, context }),
  };
  const deps = appDeps({
    store,
    errorReporter,
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
    reports,
    invite: (email: string) => inviteTestAccount(deps, email),
    suspend: (accountId: string) =>
      store.run(async ({ accounts }) => {
        const record = await accounts.get(accountId);
        if (record === null) throw new Error('No such account');
        await accounts.update({
          ...record,
          suspendedAt: new Date(deps.clock.nowMs()).toISOString(),
        });
      }),
    signIn: (email: string, password: string, deviceName?: string) =>
      signInTestDevice(deps, email, password, deviceName),
    createAccount: (options?: { role?: AccountRole; email?: string }) =>
      createTestAccount(deps, options),
  };
};

/** A real server on a random local port over an in-memory database, for adapter tests. */
export const startTestServer = async ({
  clock,
  mailer,
  database,
  port: wantedPort = 0,
}: {
  clock?: Clock;
  mailer?: FakeMailer;
  /** A database an older version left (see `openDatabaseAtVersion1`); migrated on start. */
  database?: SqlDatabase;
  /** To come back at the address of a server just closed, with a database of its own. */
  port?: number;
} = {}): Promise<TestServer> => {
  const {
    app,
    deps,
    db,
    mailer: usedMailer,
    reports,
    invite,
    suspend,
    signIn: signInDevice,
    createAccount,
  } = buildTestApp({
    ...(clock ? { clock } : {}),
    ...(mailer ? { mailer } : {}),
    ...(database ? { database } : {}),
  });
  const listen = async (instance: typeof app, port: number) => {
    await instance.listen({ host: '127.0.0.1', port });
    const address = instance.server.address();
    return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  };
  const url = await listen(app, wantedPort);
  return {
    url,
    createAccount,
    mails: () => [...usedMailer.sent],
    reports: () => [...reports],
    invite,
    suspend,
    signIn: signInDevice,
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

/**
 * An empty in-memory database at the schema 003 shipped (migration 1 only), for the tests that
 * fill it as 003's code did and check what the migration to accounts makes of it (SC-005).
 */
export const openDatabaseAtVersion1 = (): SqlDatabase => {
  const db = new NodeSqlDatabase(new DatabaseSync(':memory:'));
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db, MIGRATIONS.slice(0, 1));
  return db;
};
