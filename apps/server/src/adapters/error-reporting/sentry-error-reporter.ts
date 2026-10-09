import * as Sentry from '@sentry/node';

import type { ErrorReporter } from '../../application/ports/error-reporter';

/**
 * Sentry reporter (research R15). Request bodies, headers and cookies never leave the Pi; the
 * only contexts are the fixed `{ operation, route }` tags. The caller picks the console reporter
 * when no DSN is set.
 */
export const createSentryErrorReporter = ({
  dsn,
  release,
  environment,
}: {
  dsn: string;
  release: string;
  environment: string;
}): ErrorReporter => {
  Sentry.init({
    dsn,
    release,
    environment,
    // Sentry 11 replaced `sendDefaultPii: false` by `dataCollection`: everything is off.
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
    beforeSend: (event) => {
      if (event.request) {
        delete event.request.data;
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.query_string;
      }
      return event;
    },
  });

  return {
    report: (error, { operation, route }) => {
      try {
        Sentry.captureException(error, { tags: { operation, route } });
      } catch {
        // Reporting never breaks the server.
      }
    },
  };
};
