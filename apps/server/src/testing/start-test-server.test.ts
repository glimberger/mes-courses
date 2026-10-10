import { startTestServer } from './start-test-server';

describe('startTestServer', () => {
  it('serves a real server that pairs a device', async () => {
    const server = await startTestServer();
    try {
      const code = await server.createPairingCode();
      const response = await fetch(`${server.url}/v1/pairing/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, deviceName: 'Test phone' }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({ credential: expect.any(String) }),
      );
    } finally {
      await server.close();
    }
  });

  it('listenAlso answers at a second address over the same database', async () => {
    const server = await startTestServer();
    const second = await server.listenAlso();
    try {
      expect(second.url).not.toBe(server.url);
      const [a, b] = await Promise.all(
        [server.url, second.url].map(
          async (url) =>
            (
              (await (await fetch(`${url}/v1/health`)).json()) as {
                serverId: string;
              }
            ).serverId,
        ),
      );
      expect(a).toBe(b);
    } finally {
      await second.close();
      await server.close();
    }
  });
});
