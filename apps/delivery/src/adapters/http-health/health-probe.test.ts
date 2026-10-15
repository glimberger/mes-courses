import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createHttpHealthProbe } from './health-probe';

let server: Server;
let port: number;
let respond: (res: import('node:http').ServerResponse) => void;

beforeAll(async () => {
  server = createServer((_req, res) => respond(res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

const json = (body: unknown) => (res: import('node:http').ServerResponse) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

const probe = createHttpHealthProbe({ pollMs: 20, requestTimeoutMs: 100 });

describe('http health probe', () => {
  it('is healthy when the release commit matches', async () => {
    respond = json({ release: { version: '1.0.0', commit: 'abc' } });
    await expect(probe.waitForCommit(port, 'abc', 500)).resolves.toBe(
      'healthy',
    );
  });

  it('says wrong-commit when another commit answers until the deadline', async () => {
    respond = json({ release: { version: '1.0.0', commit: 'old' } });
    await expect(probe.waitForCommit(port, 'abc', 150)).resolves.toBe(
      'wrong-commit',
    );
  });

  it('waits for a restart that takes a moment', async () => {
    let calls = 0;
    respond = (res) =>
      json({ release: { commit: ++calls < 3 ? 'old' : 'abc' } })(res);
    await expect(probe.waitForCommit(port, 'abc', 1000)).resolves.toBe(
      'healthy',
    );
  });

  it('is unavailable when the connection is refused', async () => {
    await expect(probe.waitForCommit(1, 'abc', 100)).resolves.toBe(
      'unavailable',
    );
  });

  it('is unavailable when the response is too slow', async () => {
    respond = () => undefined;
    await expect(probe.waitForCommit(port, 'abc', 250)).resolves.toBe(
      'unavailable',
    );
  });

  it('is unavailable when the body has no release', async () => {
    respond = json({ serverId: 'x' });
    await expect(probe.waitForCommit(port, 'abc', 100)).resolves.toBe(
      'unavailable',
    );
  });
});
