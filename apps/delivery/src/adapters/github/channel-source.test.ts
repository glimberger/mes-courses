import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ChannelSourceError } from '../../application/ports/channel-source';
import { createGithubChannelSource } from './channel-source';

let server: Server;
let apiUrl: string;
let dir: string;
let handler: (req: IncomingMessage, res: ServerResponse) => void;
const seen: {
  url: string;
  auth: string | undefined;
  accept: string | undefined;
}[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push({
      url: req.url ?? '',
      auth: req.headers.authorization,
      accept: req.headers.accept,
    });
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mes-courses-source-'));
  seen.length = 0;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const source = (timeoutMs?: number) =>
  createGithubChannelSource({
    repository: 'o/r',
    token: 'tok',
    apiUrl,
    timeoutMs,
  });

const channelHandler: typeof handler = (req, res) => {
  if (req.url === '/repos/o/r/releases/tags/channel-staging') {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        assets: [
          { id: 1, name: 'manifest.json' },
          { id: 2, name: 'manifest.json.sig' },
          { id: 3, name: 'server-abc.tar.gz' },
        ],
      }),
    );
  } else if (req.url === '/repos/o/r/releases/assets/1') res.end('MANIFEST');
  else if (req.url === '/repos/o/r/releases/assets/2') res.end('SIGNATURE');
  else if (req.url === '/repos/o/r/releases/assets/3') res.end('TARBALL');
  else {
    res.statusCode = 404;
    res.end();
  }
};

describe('github channel source', () => {
  it('fetches the manifest and its signature with the bearer token', async () => {
    handler = channelHandler;
    await expect(source().fetchChannel('staging')).resolves.toEqual({
      manifest: 'MANIFEST',
      signature: 'SIGNATURE',
    });
    expect(seen.every((call) => call.auth === 'Bearer tok')).toBe(true);
    expect(seen.map((call) => call.accept)).toContain(
      'application/octet-stream',
    );
  });

  it('streams an asset to a file', async () => {
    handler = channelHandler;
    const destination = join(dir, 'out.tar.gz');
    await source().downloadAsset('staging', 'server-abc.tar.gz', destination);
    expect(readFileSync(destination, 'utf8')).toBe('TARBALL');
  });

  it('gives null when the channel does not exist yet', async () => {
    handler = (_req, res) => {
      res.statusCode = 404;
      res.end();
    };
    await expect(source().fetchChannel('staging')).resolves.toBeNull();
  });

  it.each([401, 403])('tells a %i apart by its status', async (status) => {
    handler = (_req, res) => {
      res.statusCode = status;
      res.end();
    };
    await expect(source().fetchChannel('staging')).rejects.toMatchObject({
      name: 'ChannelSourceError',
      status,
    });
  });

  it('cuts a hung response at the time limit', async () => {
    handler = () => undefined;
    const error = await source(150)
      .fetchChannel('staging')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChannelSourceError);
  });
});
