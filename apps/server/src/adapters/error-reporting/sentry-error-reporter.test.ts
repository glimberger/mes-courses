import * as Sentry from '@sentry/node';
import type { ErrorEvent, NodeOptions } from '@sentry/node';

import { createSentryErrorReporter } from './sentry-error-reporter';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

const init = jest.mocked(Sentry.init);
const captureException = jest.mocked(Sentry.captureException);

const options = (): NodeOptions => {
  const [first] = init.mock.calls[0] ?? [];
  if (!first) throw new Error('Sentry.init was not called');
  return first;
};

describe('createSentryErrorReporter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initializes Sentry with no personal data collected, with the release and the environment', () => {
    createSentryErrorReporter({
      dsn: 'https://key@example.ingest.de.sentry.io/1',
      release: 'mes-courses-server@1.0.0',
      environment: 'production',
    });

    expect(init).toHaveBeenCalledTimes(1);
    expect(options()).toEqual(
      expect.objectContaining({
        dsn: 'https://key@example.ingest.de.sentry.io/1',
        release: 'mes-courses-server@1.0.0',
        environment: 'production',
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          databaseQueryData: false,
          queues: false,
          stackFrameVariables: false,
        },
      }),
    );
  });

  describe('beforeSend', () => {
    const send = (event: ErrorEvent) => {
      createSentryErrorReporter({ dsn: 'dsn', release: 'r', environment: 'e' });
      return options().beforeSend?.(event, {});
    };

    it('drops breadcrumbs, extra data and the user', async () => {
      const sent = await send({
        type: undefined,
        message: 'boom',
        breadcrumbs: [{ message: 'pairing code ABCD-2345' }],
        extra: { code: 'ABCD-2345' },
        user: { id: 'd-1' },
      });

      expect(sent?.breadcrumbs).toBeUndefined();
      expect(sent?.extra).toBeUndefined();
      expect(sent?.user).toBeUndefined();
    });

    it('drops request bodies, headers and cookies', async () => {
      const event: ErrorEvent = {
        type: undefined,
        message: 'boom',
        request: {
          method: 'POST',
          url: 'https://courses.example.fr/v1/sync',
          data: '{"changes":[{"fields":{"name":"Lait"}}]}',
          headers: { authorization: 'Bearer secret' },
          cookies: { session: 'secret' },
          query_string: 'token=secret',
        },
      };

      const sent = await send(event);

      expect(sent?.request).toEqual({
        method: 'POST',
        url: 'https://courses.example.fr/v1/sync',
      });
      expect(JSON.stringify(sent)).not.toMatch(/Lait|secret/);
    });

    it('keeps an event that has no request', async () => {
      const event: ErrorEvent = { type: undefined, message: 'boom' };

      expect(await send(event)).toEqual(event);
    });
  });

  describe('report', () => {
    const reporter = () =>
      createSentryErrorReporter({ dsn: 'dsn', release: 'r', environment: 'e' });

    it('sends only the operation and the route as tags', () => {
      const error = new Error('boom');

      reporter().report(error, { operation: 'sync', route: 'POST /v1/sync' });

      expect(captureException).toHaveBeenCalledWith(error, {
        tags: { operation: 'sync', route: 'POST /v1/sync' },
      });
    });

    it('never throws', () => {
      captureException.mockImplementationOnce(() => {
        throw new Error('Sentry is down');
      });

      expect(() =>
        reporter().report(new Error('boom'), { operation: 'a', route: 'b' }),
      ).not.toThrow();
    });
  });
});
