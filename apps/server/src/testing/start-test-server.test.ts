import { startTestServer } from './start-test-server';

describe('startTestServer', () => {
  it('serves a real server that signs a device in', async () => {
    const server = await startTestServer();
    try {
      await server.createAccount({ email: 'marie@example.org' });
      const response = await fetch(`${server.url}/v1/auth/sign-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'marie@example.org',
          password: 'a long enough password',
          deviceName: 'Test phone',
        }),
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

  it('004 creates accounts with a working device credential and shows the emails sent', async () => {
    const server = await startTestServer();
    try {
      const admin = await server.createAccount({
        role: 'administrator',
        email: 'admin@example.org',
      });
      const headers = {
        authorization: `Bearer ${admin.deviceCredential}`,
        'content-type': 'application/json',
      };

      const invited = await fetch(`${server.url}/v1/admin/accounts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: 'marie@example.org' }),
      });

      expect(invited.status).toBe(201);
      expect(server.mails()).toEqual([
        expect.objectContaining({
          kind: 'invitation',
          to: 'marie@example.org',
        }),
      ]);
    } finally {
      await server.close();
    }
  });

  it('004 invites an account with a known temporary password, sends no mail, and signs a device in', async () => {
    const server = await startTestServer();
    try {
      const { temporaryPassword } = await server.invite('marie@example.org');
      const choose = await fetch(`${server.url}/v1/auth/choose-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'marie@example.org',
          temporaryPassword,
          newPassword: 'a brand new password',
          deviceName: 'Phone',
        }),
      });
      expect(choose.status).toBe(200);

      const second = await server.signIn(
        'marie@example.org',
        'a brand new password',
        'Tablet',
      );
      const devices = await fetch(`${server.url}/v1/devices`, {
        headers: { authorization: `Bearer ${second.deviceCredential}` },
      });

      expect(server.mails()).toEqual([]);
      expect(
        ((await devices.json()) as { devices: Array<{ name: string }> }).devices
          .map((device) => device.name)
          .sort(),
      ).toEqual(['Phone', 'Tablet']);
    } finally {
      await server.close();
    }
  });
});
