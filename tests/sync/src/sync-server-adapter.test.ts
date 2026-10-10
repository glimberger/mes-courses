import { createSyncServer } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const APP_VERSION = '1.0.0';

type FetchFn = typeof fetch;

/** A `fetch` that records the requests it forwards to the real one. */
const recording = () => {
  const requests: { url: string; headers: Headers }[] = [];
  const fetchFn: FetchFn = (input, init) => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
    });
    return fetch(input, init);
  };
  return { requests, fetchFn };
};

describe('SyncServer HTTP adapter', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    jest.useRealTimers();
    await server.close();
  });

  describe('health', () => {
    it('returns the HealthInfo of the server', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.health(server.url);

      expect(result).toEqual({
        ok: true,
        value: {
          serverId: expect.any(String),
          apiVersion: 1,
          minAppVersion: expect.any(String),
        },
      });
    });

    it('sends X-App-Version and no Authorization', async () => {
      const { requests, fetchFn } = recording();
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: fetchFn,
      });

      await syncServer.health(server.url);

      expect(requests).toHaveLength(1);
      expect(requests[0]?.url).toBe(`${server.url}/v1/health`);
      expect(requests[0]?.headers.get('X-App-Version')).toBe(APP_VERSION);
      expect(requests[0]?.headers.has('Authorization')).toBe(false);
    });

    it.each([['Wed, 21 Oct 2026 07:28:00 GMT'], [null]])(
      'waits 1 minute when Retry-After is %s',
      async (header) => {
        const limited: FetchFn = async () =>
          new Response('{}', {
            status: 429,
            headers: header === null ? {} : { 'Retry-After': header },
          });
        const syncServer = createSyncServer({
          appVersion: APP_VERSION,
          fetch: limited,
        });

        const result = await syncServer.claim(server.url, 'ABCD-EF23', 'A');

        expect(result).toEqual({
          ok: false,
          error: { type: 'TooManyAttempts', minutesToWait: 1 },
        });
      },
    );

    it('rejects a health answer that is not the server identity', async () => {
      const portal: FetchFn = async () =>
        new Response('<html>login</html>', { status: 200 });
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: portal,
      });

      expect(await syncServer.health(server.url)).toEqual({
        ok: false,
        error: { type: 'ServerUnreachable' },
      });
    });

    it('returns an error, not a rejection, for methods not implemented yet', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.listDevices({
        url: server.url,
        deviceId: 'd',
        credential: 'c',
      });

      expect(result).toEqual({ ok: false, error: { type: 'ServerError' } });
    });

    it('reports ServerUnreachable when the connection is refused', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.health('http://127.0.0.1:9');

      expect(result).toEqual({
        ok: false,
        error: { type: 'ServerUnreachable' },
      });
    });

    it('reports ServerUnreachable after a timeout of 10 s', async () => {
      jest.useFakeTimers();
      const hanging: FetchFn = (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        });
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: hanging,
      });

      const pending = syncServer.health(server.url);
      await jest.advanceTimersByTimeAsync(9_999);
      let settled = false;
      void pending.then(() => (settled = true));
      await jest.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);

      expect(await pending).toEqual({
        ok: false,
        error: { type: 'ServerUnreachable' },
      });
    });

    it.each([
      'SSL error: certificate verify failed',
      'java.security.cert.CertPathValidatorException: Trust anchor for certification path not found.',
      'The certificate for this server is invalid.',
      'self-signed certificate',
    ])(
      'reports UntrustedServer on a TLS error (%s), without retrying over http',
      async (message) => {
        const calls: string[] = [];
        const failing: FetchFn = async (input) => {
          calls.push(String(input));
          throw new TypeError(message);
        };
        const syncServer = createSyncServer({
          appVersion: APP_VERSION,
          fetch: failing,
        });

        const result = await syncServer.health('https://courses.example.fr');

        expect(result).toEqual({
          ok: false,
          error: { type: 'UntrustedServer' },
        });
        expect(calls).toEqual(['https://courses.example.fr/v1/health']);
      },
    );

    it('reports ServerUnreachable on a 5xx', async () => {
      const failing: FetchFn = async () => new Response('', { status: 503 });
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: failing,
      });

      const result = await syncServer.health(server.url);

      expect(result).toEqual({
        ok: false,
        error: { type: 'ServerUnreachable' },
      });
    });
  });

  describe('claim', () => {
    it('returns the Pairing for a valid code', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });
      const code = await server.createPairingCode();

      const result = await syncServer.claim(server.url, code, 'Pixel de Léa');

      expect(result).toEqual({
        ok: true,
        value: {
          serverId: expect.any(String),
          apiVersion: 1,
          minAppVersion: expect.any(String),
          deviceId: expect.any(String),
          credential: expect.any(String),
        },
      });
    });

    it('sends X-App-Version and no Authorization', async () => {
      const { requests, fetchFn } = recording();
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: fetchFn,
      });

      await syncServer.claim(server.url, await server.createPairingCode(), 'A');

      expect(requests[0]?.headers.get('X-App-Version')).toBe(APP_VERSION);
      expect(requests[0]?.headers.has('Authorization')).toBe(false);
    });

    it('maps 400 to InvalidCode', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.claim(server.url, 'ABCD-EF23', 'A');

      expect(result).toEqual({ ok: false, error: { type: 'InvalidCode' } });
    });

    it('maps 429 to TooManyAttempts with the minutes to wait', async () => {
      const limited: FetchFn = async () =>
        new Response(JSON.stringify({ error: 'TooManyAttempts' }), {
          status: 429,
          headers: { 'Retry-After': '600' },
        });
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: limited,
      });

      const result = await syncServer.claim(server.url, 'ABCD-EF23', 'A');

      expect(result).toEqual({
        ok: false,
        error: { type: 'TooManyAttempts', minutesToWait: 10 },
      });
    });

    it('rounds the minutes to wait up', async () => {
      const limited: FetchFn = async () =>
        new Response('{}', { status: 429, headers: { 'Retry-After': '61' } });
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: limited,
      });

      const result = await syncServer.claim(server.url, 'ABCD-EF23', 'A');

      expect(result).toEqual({
        ok: false,
        error: { type: 'TooManyAttempts', minutesToWait: 2 },
      });
    });

    it('reports ServerUnreachable when the connection is refused', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.claim(
        'http://127.0.0.1:9',
        'ABCD-EF23',
        'A',
      );

      expect(result).toEqual({
        ok: false,
        error: { type: 'ServerUnreachable' },
      });
    });

    it('reports UntrustedServer on a TLS error, never retrying over http', async () => {
      const calls: string[] = [];
      const failing: FetchFn = async (input) => {
        calls.push(String(input));
        throw new TypeError('SSL error: certificate verify failed');
      };
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: failing,
      });

      const result = await syncServer.claim(
        'https://courses.example.fr',
        'ABCD-EF23',
        'A',
      );

      expect(result).toEqual({ ok: false, error: { type: 'UntrustedServer' } });
      expect(calls).toEqual(['https://courses.example.fr/v1/pairing/claim']);
    });
  });

  describe('authenticated requests', () => {
    const conn = {
      url: 'https://courses.example.fr',
      deviceId: 'd1',
      credential: 'secret-credential',
    };

    it('sends X-App-Version and Authorization: Bearer, and returns the code', async () => {
      const plain = createSyncServer({ appVersion: APP_VERSION });
      const pairing = await plain.claim(
        server.url,
        await server.createPairingCode(),
        'A',
      );
      if (!pairing.ok) throw new Error('claim failed');
      const { requests, fetchFn } = recording();
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: fetchFn,
      });

      const result = await syncServer.createPairingCode({
        url: server.url,
        deviceId: pairing.value.deviceId,
        credential: pairing.value.credential,
      });

      expect(result).toEqual({
        ok: true,
        value: { code: expect.any(String), expiresAt: expect.any(String) },
      });
      expect(requests[0]?.headers.get('X-App-Version')).toBe(APP_VERSION);
      expect(requests[0]?.headers.get('Authorization')).toBe(
        `Bearer ${pairing.value.credential}`,
      );
    });

    it.each([
      [401, { type: 'DeviceNotAuthorized' }],
      [426, { type: 'UpdateRequired' }],
      [500, { type: 'ServerError' }],
      [503, { type: 'ServerError' }],
    ])('maps %i to %o', async (status, error) => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => new Response('{}', { status }),
      });

      const result = await syncServer.createPairingCode(conn);

      expect(result).toEqual({ ok: false, error });
    });

    it('maps a refused connection to Offline', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.createPairingCode({
        ...conn,
        url: 'http://127.0.0.1:9',
      });

      expect(result).toEqual({ ok: false, error: { type: 'Offline' } });
    });

    it('maps a TLS error to UntrustedServer', async () => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => {
          throw new TypeError('self-signed certificate');
        },
      });

      const result = await syncServer.createPairingCode(conn);

      expect(result).toEqual({ ok: false, error: { type: 'UntrustedServer' } });
    });
  });
  describe('sync', () => {
    const request = {
      lastSeq: 0,
      hlc: { wallMs: Date.now(), counter: 0, deviceId: 'd-1' },
      changes: [
        {
          changeId: 'ch-1',
          hlc: { wallMs: Date.now(), counter: 0, deviceId: 'd-1' },
          kind: 'list' as const,
          id: 'l-1',
          fields: { name: 'Ma liste' },
        },
      ],
    };

    const paired = async () => {
      const plain = createSyncServer({ appVersion: APP_VERSION });
      const pairing = await plain.claim(
        server.url,
        await server.createPairingCode(),
        'A',
      );
      if (!pairing.ok) throw new Error('claim failed');
      return {
        url: server.url,
        deviceId: pairing.value.deviceId,
        credential: pairing.value.credential,
      };
    };

    it('round-trips a change with the real server', async () => {
      const conn = await paired();
      const { requests, fetchFn } = recording();
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: fetchFn,
      });

      const result = await syncServer.sync(conn, request);

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          acknowledged: ['ch-1'],
          rows: [expect.objectContaining({ kind: 'list', id: 'l-1' })],
          seq: 1,
        }),
      });
      expect(requests[0]?.headers.get('Authorization')).toBe(
        `Bearer ${conn.credential}`,
      );
      expect(requests[0]?.headers.get('X-App-Version')).toBe(APP_VERSION);
    });

    it.each([
      [401, { type: 'DeviceNotAuthorized' }],
      [426, { type: 'UpdateRequired' }],
      [400, { type: 'ServerError' }],
      [500, { type: 'ServerError' }],
    ])('maps %i to %o', async (status, error) => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => new Response('{}', { status }),
      });

      const result = await syncServer.sync(
        { url: server.url, deviceId: 'd', credential: 'c' },
        request,
      );

      expect(result).toEqual({ ok: false, error });
    });

    it('maps a refused connection to Offline', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.sync(
        { url: 'http://127.0.0.1:9', deviceId: 'd', credential: 'c' },
        request,
      );

      expect(result).toEqual({ ok: false, error: { type: 'Offline' } });
    });

    it('maps a TLS error to UntrustedServer', async () => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => {
          throw new TypeError('self-signed certificate');
        },
      });

      const result = await syncServer.sync(
        { url: server.url, deviceId: 'd', credential: 'c' },
        request,
      );

      expect(result).toEqual({ ok: false, error: { type: 'UntrustedServer' } });
    });

    it('maps a 200 that is not a sync answer to ServerError', async () => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => new Response('<html>portal</html>', { status: 200 }),
      });

      const result = await syncServer.sync(
        { url: server.url, deviceId: 'd', credential: 'c' },
        request,
      );

      expect(result).toEqual({ ok: false, error: { type: 'ServerError' } });
    });
  });
});
