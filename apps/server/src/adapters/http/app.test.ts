import type { FastifyInstance } from 'fastify';

import type { Clock } from '../../application/ports/clock';
import type { ErrorReporter } from '../../application/ports/error-reporter';
import { InMemoryStore } from '../../application/testing/in-memory-store';
import { createFakePairingCrypto } from '../../application/testing/fake-pairing-crypto';
import { createPairingCode } from '../../application/use-cases/create-pairing-code';
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

const harness = (overrides: Partial<AppDeps> = {}): Harness => {
  const store = new InMemoryStore();
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
  // The code comes from the Pi command, which has no creator.
  const pair = async (name = 'Phone') => {
    const { code } = await createPairingCode(deps, null);
    const claim = await app.inject({
      method: 'POST',
      url: '/v1/pairing/claim',
      payload: { code, deviceName: name },
    });
    return claim.json();
  };
  return { app, deps, clock, store, reporter, pair };
};

const bearer = (credential: string) => ({
  authorization: `Bearer ${credential}`,
});

describe('HTTP app', () => {
  describe('GET /v1/health', () => {
    it('needs no authorization and carries the server identity', async () => {
      const { app, store } = harness();
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
      const { app } = harness();

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
      const { app, store } = harness();
      const run = jest.spyOn(store, 'run');
      // The identity lookup is the only read, and only for the body: the credential is not looked up.
      await app.inject({
        method: 'POST',
        url: '/v1/pairing-codes',
        headers: { 'x-app-version': '1.0.0', authorization: 'Bearer abc' },
        payload: {},
      });
      expect(run).toHaveBeenCalledTimes(1);
    });

    it('accepts the minimum and anything above', async () => {
      const { app } = harness();
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
      const { app } = harness();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing-codes',
        headers: authorization ? { authorization } : {},
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('DeviceNotAuthorized');
    });

    it('answers 401 for a revoked device', async () => {
      const { app, store, pair } = harness();
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
        method: 'POST',
        url: '/v1/pairing-codes',
        headers: bearer(credential),
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it('answers 401 before any read of the data', async () => {
      const { app, store } = harness();
      const tables = jest.spyOn(store, 'run');
      await app.inject({
        method: 'POST',
        url: '/v1/pairing-codes',
        payload: {},
      });
      // Only the identity lookup and the credential lookup ran.
      expect(tables.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe('request limits', () => {
    it('answers 400 for a body over 1 MB', async () => {
      const { app } = harness();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing/claim',
        payload: { code: 'ABCD-EF23', deviceName: 'x'.repeat(1024 * 1024 + 1) },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('BadRequest');
    });

    it('answers 400 for a body that breaks the schema', async () => {
      const { app } = harness();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing/claim',
        payload: { code: 42 },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('BadRequest');
    });

    it('answers 404 for an unknown route', async () => {
      const { app, pair } = harness();
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

  describe('POST /v1/pairing/claim', () => {
    it('authorizes the device and returns its credential once', async () => {
      const { app, store, deps } = harness();
      const { code } = await createPairingCode(deps, null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing/claim',
        payload: { code: code.toLowerCase(), deviceName: ' Pixel ' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual({
        deviceId: 'device-1',
        credential: expect.stringMatching(/^credential-\d+$/),
        serverId: expect.any(String),
        apiVersion: 1,
        minAppVersion: '1.2.0',
      });
      await store.run(async ({ devices }) => {
        expect((await devices.get('device-1'))?.name).toBe('Pixel');
      });
    });

    it('answers 400 InvalidCode for an unknown code', async () => {
      const { app } = harness();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing/claim',
        payload: { code: 'ZZZZ-ZZZZ', deviceName: 'Phone' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('InvalidCode');
    });

    it('rejects a wrong type or an unknown property instead of coercing it', async () => {
      const { app } = harness();
      const claim = (payload: object) =>
        app.inject({ method: 'POST', url: '/v1/pairing/claim', payload });

      expect((await claim({ code: 42, deviceName: 'Phone' })).statusCode).toBe(
        400,
      );
      expect(
        (await claim({ code: 'ABCD-EFGH', deviceName: 123 })).statusCode,
      ).toBe(400);
      expect(
        (await claim({ code: 'ABCD-EFGH', deviceName: 'P', extra: 1 }))
          .statusCode,
      ).toBe(400);
    });

    it('keeps the error body when the identity lookup fails', async () => {
      const { app, store, reporter } = harness();
      jest.spyOn(store, 'run').mockRejectedValue(new Error('database locked'));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing/claim',
        headers: { 'x-app-version': '0.1.0' },
        payload: { code: 'ABCD-EFGH', deviceName: 'Phone' },
      });

      expect(response.statusCode).toBe(426);
      expect(response.json()).toEqual({ error: 'UpdateRequired' });
      expect(reporter.report).toHaveBeenCalled();
    });

    it('answers 400 for an empty device name', async () => {
      const { app } = harness();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing/claim',
        payload: { code: 'ABCD-EF23', deviceName: '  ' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('BadRequest');
    });

    it('answers 429 with Retry-After from the 6th failure', async () => {
      const { app, clock } = harness();
      const claim = () =>
        app.inject({
          method: 'POST',
          url: '/v1/pairing/claim',
          payload: { code: 'ZZZZ-ZZZZ', deviceName: 'Phone' },
        });
      for (let i = 0; i < 5; i++) {
        expect((await claim()).statusCode).toBe(400);
        clock.ms += 1000;
      }

      const response = await claim();

      expect(response.statusCode).toBe(429);
      expect(response.json().error).toBe('TooManyAttempts');
      expect(response.headers['retry-after']).toBe('595');
    });
  });

  describe('POST /v1/pairing-codes', () => {
    it('gives an authorized device a code valid for 10 minutes', async () => {
      const { app, store, pair, deps } = harness();
      const { deviceId, credential } = await pair();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing-codes',
        headers: bearer(credential),
      });

      expect(response.statusCode).toBe(200);
      const { code, expiresAt } = response.json();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(expiresAt).toBe('2026-10-01T10:10:00.000Z');
      await store.run(async ({ pairingCodes }) => {
        expect(
          (await pairingCodes.findByHash(deps.crypto.sha256Hex(code)))
            ?.createdBy,
        ).toBe(deviceId);
      });
    });
  });

  describe('unexpected errors', () => {
    it('answers 500 ServerError and reports only the operation and the route', async () => {
      const h = harness();
      const { credential } = await h.pair();
      const app = buildApp({
        ...h.deps,
        crypto: {
          ...h.deps.crypto,
          generateCode: () => {
            throw new Error('boom');
          },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/pairing-codes',
        headers: bearer(credential),
        payload: {},
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().error).toBe('ServerError');
      expect(h.reporter.report).toHaveBeenCalledWith(expect.any(Error), {
        operation: 'http',
        route: 'POST /v1/pairing-codes',
      });
    });
  });
});
