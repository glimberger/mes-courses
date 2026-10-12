import * as Sentry from '@sentry/node';

import type { ErrorReporter } from '../../application/ports/error-reporter';
import { scrubAddresses, scrubError } from './scrubber';

const FLUSH_TIMEOUT_MS = 2000;

/**
 * Sentry reporter (research R15). Request bodies, headers and cookies never leave the Pi, nor do
 * breadcrumbs, `extra` data and the user; the only contexts are the fixed `{ operation, route }`
 * tags. An exception message is kept, so callers must not put a pairing code or a credential in
 * one (addresses are scrubbed anyway, research R10). `Sentry.init` is global: the reporter is built once, at start-up. The caller picks the console reporter
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
      // A second line after not putting an address in a message (research R10).
      if (event.message !== undefined) {
        event.message = scrubAddresses(event.message);
      }
      for (const exception of event.exception?.values ?? []) {
        if (exception.value !== undefined) {
          exception.value = scrubAddresses(exception.value);
        }
      }
      if (event.tags) {
        for (const [name, value] of Object.entries(event.tags)) {
          if (typeof value === 'string')
            event.tags[name] = scrubAddresses(value);
        }
      }
      return event;
    },
  });

  return {
    report: (error, { operation, route, accountId }) => {
      try {
        // The opaque account id is the only identifier a report carries (research R10).
        Sentry.captureException(scrubError(error), {
          tags: {
            operation,
            route,
            ...(accountId === undefined ? {} : { accountId }),
          },
        });
      } catch {
        // Reporting never breaks the server.
      }
    },
    flush: async () => {
      await Sentry.flush(FLUSH_TIMEOUT_MS);
    },
  };
};
