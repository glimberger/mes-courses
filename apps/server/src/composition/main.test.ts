import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installCrashHandlers } from './crash-handlers';
import { main } from './main';

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

describe('crash handlers', () => {
  it.each(['uncaughtException', 'unhandledRejection'])(
    'report %s with fixed identifiers and exit non-zero',
    (event) => {
      const proc = new EventEmitter();
      const reporter = { report: jest.fn() };
      const exit = jest.fn();
      installCrashHandlers(proc, reporter, exit);
      const error = new Error('boom');

      proc.emit(event, error);

      expect(reporter.report).toHaveBeenCalledWith(error, {
        operation: 'process',
        route: 'none',
      });
      expect(exit).toHaveBeenCalledWith(1);
    },
  );

  it('exits even when the reporter throws', () => {
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

    expect(() => proc.emit('uncaughtException', new Error('x'))).toThrow();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
