import type { FastifyInstance } from 'fastify';

import type { Clock } from '../../application/ports/clock';
import type { ErrorReporter } from '../../application/ports/error-reporter';
import { account, device } from '../../application/testing/contracts/entities';
import { InMemoryStore } from '../../application/testing/in-memory-store';
import { createFakePairingCrypto } from '../../application/testing/fake-pairing-crypto';
import { addTestDevice } from '../../testing/start-test-server';
import { buildApp, type AppDeps } from './app';

const START = Date.parse('2026-10-01T10:00:00.000Z');

class FakeClock implements Clock {
  ms = START;
  nowMs() {
    return this.ms;
  }
}

type Harness = {
  app: FastifyInstance;
  deps: AppDeps;
  clock: FakeClock;
  store: InMemoryStore;
  reporter: jest.Mocked<ErrorReporter>;
  /** Pairs a device and returns its credential. */
  pair: (name?: string) => Promise<{ deviceId: string; credential: string }>;
};

const harness = async (overrides: Partial<AppDeps> = {}): Promise<Harness> => {
  const store = new InMemoryStore();
  // The account the test devices belong to.
  await store.run(({ accounts }) =>
    accounts.add(account('acc-1', 'marie@example.org')),
  );
  const clock = new FakeClock();
  const reporter: jest.Mocked<ErrorReporter> = { report: jest.fn() };
  let id = 0;
  const deps: AppDeps = {
    store,
    clock,
    crypto: createFakePairingCrypto(),
    ids: { next: () => `device-${++id}` },
    errorReporter: reporter,
    minAppVersion: '1.2.0',
    ...overrides,
  };
  const app = buildApp(deps);
  const pair = (name = 'Phone') => addTestDevice(deps, 'acc-1', name);
  return { app, deps, clock, store, reporter, pair };
};

const bearer = (credential: string) => ({
  authorization: `Bearer ${credential}`,
});

describe('HTTP app', () => {
  describe('GET /v1/health', () => {
    it('needs no authorization and carries the server identity', async () => {
      const { app, store } = await harness();
      const serverId = await store.run(({ meta }) => meta.serverId());

      const response = await app.inject({ method: 'GET', url: '/v1/health' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        serverId,
        apiVersion: 1,
        minAppVersion: '1.2.0',
      });
    });
  });

  describe('app version', () => {
    it('refuses a version below minAppVersion with 426, before authorization', async () => {
      const { app } = await harness();

      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
        headers: { 'x-app-version': '1.1.9' },
      });

      expect(response.statusCode).toBe(426);
      expect(response.json()).toEqual(
        expect.objectContaining({
          error: 'UpdateRequired',
          apiVersion: 1,
          minAppVersion: '1.2.0',
        }),
      );
    });

    it('reads nothing when it refuses', async () => {
      const { app, store } = await harness();
      const run = jest.spyOn(store, 'run');
      // The identity lookup is the only read, and only for the body: the credential is not looked up.
      await app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: { 'x-app-version': '1.0.0', authorization: 'Bearer abc' },
      });
      expect(run).toHaveBeenCalledTimes(1);
    });

    it('accepts the minimum and anything above', async () => {
      const { app } = await harness();
      for (const version of ['1.2.0', '1.2.1', '2.0.0']) {
        const response = await app.inject({
          method: 'GET',
          url: '/v1/health',
          headers: { 'x-app-version': version },
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('authorization', () => {
    it.each([
      ['a missing credential', undefined],
      ['an unknown credential', 'Bearer nope'],
      ['another scheme', 'Basic abc'],
    ])('answers 401 for %s', async (_label, authorization) => {
      const { app } = await harness();

      const response = await app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: authorization ? { authorization } : {},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('DeviceNotAuthorized');
    });

    it('answers 401 for a revoked device', async () => {
      const { app, store, pair } = await harness();
      const { deviceId, credential } = await pair();
      await store.run(async ({ devices }) => {
        const device = await devices.get(deviceId);
        if (device === null) throw new Error('device missing');
        await devices.update({
          ...device,
          revokedAt: '2026-10-01T10:00:01.000Z',
        });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: bearer(credential),
      });

      expect(response.statusCode).toBe(401);
    });

    it('answers 401 before any read of the data', async () => {
      const { app, store } = await harness();
      const tables = jest.spyOn(store, 'run');
      await app.inject({
        method: 'GET',
        url: '/v1/devices',
      });
      // Only the identity lookup and the credential lookup ran.
      expect(tables.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('request limits', () => {
    it('answers 400 for a body over 1 MB', async () => {
      const { app } = await harness();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/sign-in',
        payload: {
          email: 'a@b.co',
          password: 'x',
          deviceName: 'x'.repeat(1024 * 1024 + 1),
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('BadRequest');
    });

    it('answers 400 for a body that breaks the schema', async () => {
      const { app } = await harness();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/sign-in',
        payload: { email: 42 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('BadRequest');
    });

    it('answers 404 for an unknown route', async () => {
      const { app, pair } = await harness();
      const { credential } = await pair();

      const response = await app.inject({
        method: 'GET',
        url: '/v1/nothing',
        headers: bearer(credential),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('NotFound');
    });
  });

  describe('unexpected errors', () => {
    it('answers 500 ServerError and reports only the operation and the route', async () => {
      const h = await harness();
      const { credential } = await h.pair();
      jest.spyOn(h.store, 'runForAccount').mockRejectedValue(new Error('boom'));

      const response = await h.app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: bearer(credential),
        payload: {
          lastSeq: 0,
          hlc: { wallMs: 1, counter: 0, deviceId: 'd' },
          changes: [],
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().error).toBe('ServerError');
      expect(h.reporter.report).toHaveBeenCalledWith(expect.any(Error), {
        operation: 'http',
        route: 'POST /v1/sync',
      });
    });
  });

  describe('004 account authorization (contracts/auth-api.md)', () => {
    /** A device of account `acc-2`, made directly in the store. */
    const otherAccountDevice = async (h: Harness) => {
      await h.store.run(async ({ accounts, devices }) => {
        await accounts.add(account('acc-2', 'paul@example.org'));
        await devices.add(
          device('d-other', h.deps.crypto.sha256Hex('credential-other'), {
            accountId: 'acc-2',
            name: 'Tablette de Paul',
          }),
        );
      });
      return 'credential-other';
    };

    it('004 US5-3 answers 403 AccountSuspended on sync and devices, keeping the data', async () => {
      const h = await harness();
      const { credential } = await h.pair();
      await h.store.run(({ accounts }) =>
        accounts.update(
          account('acc-1', 'marie@example.org', {
            suspendedAt: '2026-10-01T10:00:00.000Z',
          }),
        ),
      );

      for (const [method, url] of [
        ['POST', '/v1/sync'],
        ['GET', '/v1/devices'],
      ] as const) {
        const response = await h.app.inject({
          method,
          url,
          headers: bearer(credential),
          ...(method === 'POST'
            ? {
                payload: {
                  lastSeq: 0,
                  hlc: { wallMs: 1, counter: 0, deviceId: 'x' },
                  changes: [],
                },
              }
            : {}),
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error).toBe('AccountSuspended');
      }
    });

    it('004 US5-4 answers 401 AccountDeleted for a credential of a deleted account, and 401 DeviceNotAuthorized for an unknown one', async () => {
      const h = await harness();
      await h.store.run(({ endedCredentials }) =>
        endedCredentials.add(
          h.deps.crypto.sha256Hex('credential-gone'),
          'accountDeleted',
          '2026-10-01T10:00:00.000Z',
        ),
      );

      const deleted = await h.app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: bearer('credential-gone'),
      });
      const unknown = await h.app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: bearer('credential-never'),
      });

      expect(deleted.statusCode).toBe(401);
      expect(deleted.json().error).toBe('AccountDeleted');
      expect(unknown.statusCode).toBe(401);
      expect(unknown.json().error).toBe('DeviceNotAuthorized');
    });

    it('004 R9 adds the accountId to authenticated responses', async () => {
      const h = await harness();
      const { credential } = await h.pair();

      const response = await h.app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: bearer(credential),
      });

      expect(response.json().accountId).toBe('acc-1');
    });

    it('004 US3-3 lists only the caller devices and answers 404 for another account device', async () => {
      const h = await harness();
      const { credential } = await h.pair();
      await otherAccountDevice(h);

      const list = await h.app.inject({
        method: 'GET',
        url: '/v1/devices',
        headers: bearer(credential),
      });
      const rename = await h.app.inject({
        method: 'PATCH',
        url: '/v1/devices/d-other',
        headers: bearer(credential),
        payload: { name: 'Volé' },
      });
      const revoke = await h.app.inject({
        method: 'DELETE',
        url: '/v1/devices/d-other',
        headers: bearer(credential),
      });

      expect(
        list.json().devices.map((d: { id: string }) => d.id),
      ).not.toContain('d-other');
      expect(rename.statusCode).toBe(404);
      expect(revoke.statusCode).toBe(404);
      const untouched = await h.store.run(({ devices }) =>
        devices.get('d-other'),
      );
      expect(untouched?.name).toBe('Tablette de Paul');
      expect(untouched?.revokedAt).toBeNull();
    });
  });
});
