import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_PORT, listenPort } from './config';
import { installCrashHandlers } from './crash-handlers';
import { main } from './main';
import { installShutdownHandlers } from './shutdown';

describe('main', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mes-courses-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('starts on a temporary database, serves health on 127.0.0.1 and stops', async () => {
    const server = await main(
      { MES_COURSES_DB: join(dir, 'x.db'), MES_COURSES_PORT: '0' },
      new EventEmitter(),
      jest.fn(),
    );
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const response = await fetch(`${server.url}/v1/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({ apiVersion: 1 }),
      );
    } finally {
      await server.close();
    }
    await expect(fetch(`${server.url}/v1/health`)).rejects.toThrow();
  });
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('crash handlers', () => {
  it.each(['uncaughtException', 'unhandledRejection'])(
    'report %s with fixed identifiers, flush, then exit non-zero',
    async (event) => {
      const proc = new EventEmitter();
      const calls: string[] = [];
      const reporter = {
        report: jest.fn(() => calls.push('report')),
        flush: jest.fn(async () => {
          calls.push('flush');
        }),
      };
      const exit = jest.fn(() => calls.push('exit'));
      installCrashHandlers(proc, reporter, exit);
      const error = new Error('boom');

      proc.emit(event, error);
      await flushPromises();

      expect(reporter.report).toHaveBeenCalledWith(error, {
        operation: 'process',
        route: 'none',
      });
      expect(calls).toEqual(['report', 'flush', 'exit']);
      expect(exit).toHaveBeenCalledWith(1);
    },
  );

  it('exits even when the reporter or its flush fails', async () => {
    const proc = new EventEmitter();
    const exit = jest.fn();
    installCrashHandlers(
      proc,
      {
        report: () => {
          throw new Error('reporter down');
        },
      },
      exit,
    );
    proc.emit('uncaughtException', new Error('x'));
    await flushPromises();
    expect(exit).toHaveBeenCalledWith(1);

    const exit2 = jest.fn();
    installCrashHandlers(
      proc,
      { report: jest.fn(), flush: () => Promise.reject(new Error('down')) },
      exit2,
    );
    proc.emit('unhandledRejection', new Error('y'));
    await flushPromises();
    expect(exit2).toHaveBeenCalledWith(1);
  });
});

describe('shutdown handlers', () => {
  it.each(['SIGTERM', 'SIGINT'])(
    'close the server once on %s, then exit 0',
    async (signal) => {
      const proc = new EventEmitter();
      const server = { close: jest.fn().mockResolvedValue(undefined) };
      const exit = jest.fn();
      installShutdownHandlers(proc, server, exit);

      proc.emit(signal);
      proc.emit(signal);
      await flushPromises();

      expect(server.close).toHaveBeenCalledTimes(1);
      expect(exit).toHaveBeenCalledWith(0);
    },
  );

  it('exits 1 when closing fails', async () => {
    const proc = new EventEmitter();
    const exit = jest.fn();
    installShutdownHandlers(
      proc,
      { close: () => Promise.reject(new Error('stuck')) },
      exit,
    );

    proc.emit('SIGTERM');
    await flushPromises();

    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('listenPort', () => {
  it('defaults when unset or empty, parses a valid port', () => {
    expect(listenPort({})).toBe(DEFAULT_PORT);
    expect(listenPort({ MES_COURSES_PORT: '' })).toBe(DEFAULT_PORT);
    expect(listenPort({ MES_COURSES_PORT: '8080' })).toBe(8080);
  });

  it.each(['30000x', '70000', '-1', '1.5'])('rejects %s', (value) => {
    expect(() => listenPort({ MES_COURSES_PORT: value })).toThrow(
      /MES_COURSES_PORT/,
    );
  });
});
