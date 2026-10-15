import {
  createAccountServer,
  createSyncServer,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const APP_VERSION = '1.1.0';
const PASSWORD = 'a long enough password';

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
    known.clear();
    await server.close();
  });

  let accounts = 0;
  /** A device signed in through the real adapter; an address already used joins its account. */
  const known = new Set<string>();
  const pairDevice = async ({
    email = `user${++accounts}@example.org`,
    name = 'A',
  }: { email?: string; name?: string } = {}) => {
    if (!known.has(email)) {
      known.add(email);
      await server.createAccount({ email });
    }
    const signedIn = await createAccountServer({
      appVersion: APP_VERSION,
    }).signIn(server.url, email, PASSWORD, name);
    if (!signedIn.ok || signedIn.value.type !== 'signedIn') {
      throw new Error('sign-in failed');
    }
    return {
      url: server.url,
      deviceId: signedIn.value.pairing.deviceId,
      credential: signedIn.value.pairing.credential,
    };
  };

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
          // FR-029: the server also reports its release; the app ignores it.
          release: { version: expect.any(String), commit: expect.any(String) },
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

  describe('authenticated requests', () => {
    const conn = {
      url: 'https://courses.example.fr',
      deviceId: 'd1',
      credential: 'secret-credential',
    };

    it('sends X-App-Version and Authorization: Bearer, and returns the devices', async () => {
      const paired = await pairDevice();
      const { requests, fetchFn } = recording();
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: fetchFn,
      });

      const result = await syncServer.listDevices(paired);

      expect(result.ok).toBe(true);
      expect(requests[0]?.headers.get('X-App-Version')).toBe(APP_VERSION);
      expect(requests[0]?.headers.get('Authorization')).toBe(
        `Bearer ${paired.credential}`,
      );
    });

    it.each([
      [401, { type: 'DeviceNotAuthorized' }],
      [426, { type: 'UpdateRequired' }],
      [500, { type: 'ServerError' }],
      [503, { type: 'Offline' }],
    ])('maps %i to %o', async (status, error) => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => new Response('{}', { status }),
      });

      const result = await syncServer.listDevices(conn);

      expect(result).toEqual({ ok: false, error });
    });

    it('maps a refused connection to Offline', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });

      const result = await syncServer.listDevices({
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

      const result = await syncServer.listDevices(conn);

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

    const paired = pairDevice;

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

    it.each([502, 503, 504])(
      'maps a %i from the proxy to Offline, not ServerError (FR-003)',
      async (status) => {
        const syncServer = createSyncServer({
          appVersion: APP_VERSION,
          fetch: async () => new Response('', { status }),
        });

        const result = await syncServer.sync(
          { url: server.url, deviceId: 'd', credential: 'c' },
          request,
        );

        expect(result).toEqual({ ok: false, error: { type: 'Offline' } });
      },
    );

    it('still maps a 500 to ServerError', async () => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => new Response('', { status: 500 }),
      });

      const result = await syncServer.sync(
        { url: server.url, deviceId: 'd', credential: 'c' },
        request,
      );

      expect(result).toEqual({ ok: false, error: { type: 'ServerError' } });
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
  describe('device management', () => {
    it('003 US4-8 listDevices returns the authorized devices', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });
      const conn = await pairDevice({
        email: 'shared@example.org',
        name: 'Pixel',
      });
      const other = await pairDevice({
        email: 'shared@example.org',
        name: 'Pixel',
      });

      const result = await syncServer.listDevices(conn);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // The account was made with a device of its own, "Test phone".
      const pixels = result.value.filter((d) => d.name === 'Pixel');
      expect(pixels.map((d) => d.id).sort()).toEqual(
        [conn.deviceId, other.deviceId].sort(),
      );
      expect(pixels[0]).toEqual({
        id: expect.any(String),
        name: 'Pixel',
        createdAt: expect.any(String),
        lastSyncAt: null,
      });
    });

    it('renameDevice renames, and maps an unknown id to NotFound', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });
      const conn = await pairDevice({
        email: 'shared@example.org',
        name: 'Pixel',
      });

      const renamed = await syncServer.renameDevice(
        conn,
        conn.deviceId,
        'Pixel de Marie',
      );
      const listed = await syncServer.listDevices(conn);
      const missing = await syncServer.renameDevice(conn, 'unknown', 'X');

      expect(renamed).toEqual({ ok: true, value: undefined });
      expect(
        listed.ok && listed.value.find((d) => d.id === conn.deviceId)?.name,
      ).toBe('Pixel de Marie');
      expect(missing).toEqual({ ok: false, error: { type: 'NotFound' } });
    });

    it('003 US4-9 revokeDevice revokes: the device gets DeviceNotAuthorized', async () => {
      const syncServer = createSyncServer({ appVersion: APP_VERSION });
      const conn = await pairDevice({
        email: 'shared@example.org',
        name: 'Pixel',
      });
      const other = await pairDevice({
        email: 'shared@example.org',
        name: 'Pixel',
      });

      const revoked = await syncServer.revokeDevice(conn, other.deviceId);
      const again = await syncServer.revokeDevice(conn, other.deviceId);
      const refused = await syncServer.listDevices(other);

      expect(revoked).toEqual({ ok: true, value: undefined });
      expect(again).toEqual({ ok: false, error: { type: 'NotFound' } });
      expect(refused).toEqual({
        ok: false,
        error: { type: 'DeviceNotAuthorized' },
      });
    });

    it.each([
      [401, { type: 'DeviceNotAuthorized' }],
      [426, { type: 'UpdateRequired' }],
      [500, { type: 'ServerError' }],
    ])('maps %i to %o on every device method', async (status, error) => {
      const syncServer = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => new Response('{}', { status }),
      });
      const conn = { url: server.url, deviceId: 'd', credential: 'c' };

      for (const result of [
        await syncServer.listDevices(conn),
        await syncServer.renameDevice(conn, 'x', 'Name'),
        await syncServer.revokeDevice(conn, 'x'),
      ]) {
        expect(result).toEqual({ ok: false, error });
      }
    });

    it('maps a refused connection to Offline and a TLS error to UntrustedServer', async () => {
      const closed = createSyncServer({ appVersion: APP_VERSION });
      const tls = createSyncServer({
        appVersion: APP_VERSION,
        fetch: async () => {
          throw new Error('TLS certificate verification failed');
        },
      });
      const gone = {
        url: 'http://127.0.0.1:9',
        deviceId: 'd',
        credential: 'c',
      };

      expect(await closed.listDevices(gone)).toEqual({
        ok: false,
        error: { type: 'Offline' },
      });
      expect(await tls.revokeDevice(gone, 'x')).toEqual({
        ok: false,
        error: { type: 'UntrustedServer' },
      });
    });
  });
});
