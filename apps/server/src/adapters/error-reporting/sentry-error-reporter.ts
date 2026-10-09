import * as Sentry from '@sentry/node';

import type { ErrorReporter } from '../../application/ports/error-reporter';

/**
 * Sentry reporter (research R15). Request bodies, headers and cookies never leave the Pi, nor do
 * breadcrumbs, `extra` data and the user; the only contexts are the fixed `{ operation, route }`
 * tags. An exception message is kept, so callers must not put a pairing code or a credential in
 * one. `Sentry.init` is global: the reporter is built once, at start-up. The caller picks the console reporter
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
      delete event.breadcrumbs;
      delete event.extra;
      delete event.user;
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
