import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createHttpHealthProbe, waitForHealthyCommit } from './health-probe';

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

describe('waitForHealthyCommit', () => {
  it('polls a public address until the commit shows up, with an injected clock', async () => {
    let calls = 0;
    const local = createServer((_request, response) => {
      calls += 1;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          release: { commit: calls < 3 ? 'old' : 'new', version: '1' },
        }),
      );
    });
    await new Promise<void>((done) => local.listen(0, '127.0.0.1', done));
    const { port: localPort } = local.address() as AddressInfo;
    let clock = 0;
    const sleeps: number[] = [];
    try {
      expect(
        await waitForHealthyCommit(
          `http://127.0.0.1:${localPort}`,
          'new',
          100_000,
          {
            pollMs: 20_000,
            now: () => clock,
            sleep: async (ms) => {
              sleeps.push(ms);
              clock += ms;
            },
          },
        ),
      ).toBe('healthy');
      expect(sleeps).toEqual([20_000, 20_000]);
    } finally {
      local.close();
    }
  });

  it('gives up at the timeout and says why', async () => {
    let clock = 0;
    expect(
      await waitForHealthyCommit('http://127.0.0.1:1', 'new', 50_000, {
        pollMs: 20_000,
        requestTimeoutMs: 200,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
        },
      }),
    ).toBe('unavailable');
    expect(clock).toBeLessThanOrEqual(50_000);
  });
});
