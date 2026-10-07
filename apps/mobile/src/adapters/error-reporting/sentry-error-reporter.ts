import * as Sentry from '@sentry/react-native';
import type {
  ErrorEvent,
  Exception,
  ReactNativeOptions,
} from '@sentry/react-native';

import type { ErrorReporter } from '../../application/ports/error-reporter';
import { ConsoleErrorReporter } from './console-error-reporter';

/** The only environments a report may carry (FR-030, research R13). */
const ENVIRONMENTS = ['production', 'preview'];

/** The operation of an error the global handlers catch (FR-039a). */
const UNCAUGHT = 'uncaught';

type Hint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1];

/** The error code is the error's `code` property, when it has one (the SQLite result code). */
const errorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'number' || typeof code === 'string'
    ? String(code)
    : undefined;
};

/** The given fields of an object, leaving out those it does not have. */
const pick = <T extends object, K extends keyof T>(
  source: T,
  fields: K[],
): Pick<T, K> =>
  Object.fromEntries(
    fields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]]),
  ) as Pick<T, K>;

/** The exception without its text: its type, its stack frames and how it was caught. */
const cleanException = ({
  type,
  stacktrace,
  mechanism,
}: Exception): Exception => ({
  ...(type !== undefined && { type }),
  value: '',
  // Frames keep their position and source lines; local variables are dropped.
  ...(stacktrace?.frames && {
    stacktrace: {
      frames: stacktrace.frames.map(({ vars: _vars, ...frame }) => frame),
    },
  }),
  // The mechanism's structural fields link the errors of a `cause` chain; none holds content.
  ...(mechanism && {
    mechanism: pick(mechanism, [
      'type',
      'handled',
      'source',
      'exception_id',
      'parent_id',
      'is_exception_group',
    ]),
  }),
});

/**
 * Keeps only the FR-030 fields of an event: error type, error code, stack trace, operation,
 * screen, app version, device model and system version, environment, plus the event's own
 * technical fields (id, time, platform, level, SDK). Every text, user field, extra, other tag
 * and other context is dropped (research R13).
 */
const filterEvent = (
  event: ErrorEvent,
  hint: Hint,
  screen: string | undefined,
): ErrorEvent => {
  const values = event.exception?.values?.map(cleanException);
  const code = errorCode(hint.originalException);
  const operation = event.tags?.operation ?? UNCAUGHT;
  const eventScreen = event.tags?.screen ?? screen;
  const { device, os } = event.contexts ?? {};
  return {
    type: undefined,
    ...pick(event, [
      'event_id',
      'timestamp',
      'platform',
      'level',
      'sdk',
      'release',
      'dist',
      'environment',
      // The debug ids of the bundle files, which match the uploaded source maps (FR-030).
      'debug_meta',
    ]),
    ...(values && { exception: { values } }),
    tags: {
      operation,
      ...(eventScreen !== undefined && { screen: eventScreen }),
      ...(code !== undefined && { code }),
    },
    contexts: {
      ...(device && { device: pick(device, ['model']) }),
      ...(os && { os: pick(os, ['name', 'version']) }),
    },
  };
};

/** The type of the main exception, which Sentry lists last. */
const errorType = (event: ErrorEvent): string =>
  event.exception?.values?.at(-1)?.type ?? '';

/**
 * Sentry reporter (research R13). It returns a console reporter when the environment is neither
 * `production` nor `preview`, so a report never carries an unknown environment.
 */
export const createSentryErrorReporter = ({
  dsn,
  environment,
}: {
  dsn: string;
  environment?: string | undefined;
}): ErrorReporter => {
  if (
    !dsn ||
    environment === undefined ||
    !ENVIRONMENTS.includes(environment)
  ) {
    return new ConsoleErrorReporter();
  }

  // Sentry's global `screen` tag already reaches every event; this copy fills it in when
  // `setTag` failed.
  let screen: string | undefined;
  // The FR-030 signatures sent since this opening of the app; the reporter is built once per opening.
  const sent = new Set<string>();

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    maxCacheItems: 30,
    enableNativeCrashHandling: true,
    maxBreadcrumbs: 0,
    enableAppHangTracking: false,
    enableAutoSessionTracking: false,
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) => {
      const filtered = filterEvent(event, hint, screen);
      const fingerprint = [
        errorType(filtered),
        filtered.tags?.code ?? '',
        filtered.tags?.operation ?? '',
        filtered.tags?.screen ?? '',
      ].map(String);
      const signature = JSON.stringify(fingerprint);
      if (sent.has(signature)) return null;
      sent.add(signature);
      return { ...filtered, fingerprint };
    },
  });
  // Global tags reach native crashes too (FR-030).
  Sentry.setTag('operation', UNCAUGHT);

  return {
    report: (error, { operation, screen: reportScreen }) => {
      try {
        Sentry.captureException(error, {
          tags: {
            operation,
            ...(reportScreen !== undefined && { screen: reportScreen }),
          },
        });
      } catch {
        // Reporting never breaks the app.
      }
    },
    setScreen: (name) => {
      screen = name;
      try {
        Sentry.setTag('screen', name);
      } catch {
        // Reporting never breaks the app.
      }
    },
    crashNatively: () => Sentry.nativeCrash(),
  };
};
