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
});
