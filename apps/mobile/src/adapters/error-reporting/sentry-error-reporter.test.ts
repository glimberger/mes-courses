import * as Sentry from '@sentry/react-native';
import type { ErrorEvent, ReactNativeOptions } from '@sentry/react-native';

import { ConsoleErrorReporter } from './console-error-reporter';
import { createSentryErrorReporter } from './sentry-error-reporter';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  captureException: jest.fn(),
  nativeCrash: jest.fn(),
}));

const init = jest.mocked(Sentry.init);
const setTag = jest.mocked(Sentry.setTag);
const captureException = jest.mocked(Sentry.captureException);

const dsn = 'https://key@o1.ingest.de.sentry.io/1';

type Hint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1];

/** Builds a reporter, as an opening of the app does, and returns it with the options it gave. */
const start = (environment = 'production') => {
  const reporter = createSentryErrorReporter({ dsn, environment });
  const options = init.mock.calls.at(-1)?.[0] as ReactNativeOptions;
  const beforeSend = (event: ErrorEvent, hint: Hint = {}) =>
    options.beforeSend?.(event, hint) as ErrorEvent | null;
  return { reporter, options, beforeSend };
};

const frames = [
  { filename: 'app:///index.bundle', function: 'toggle', lineno: 12, colno: 3 },
];

/** An event as the SDK hands it to `beforeSend`, scope data already applied. */
const event = (
  overrides: Partial<ErrorEvent> = {},
  exception: { type?: string; value?: string } = {},
): ErrorEvent => ({
  type: undefined,
  event_id: 'event-1',
  exception: {
    values: [
      {
        type: 'Error',
        value: 'boom',
        stacktrace: { frames },
        ...exception,
      },
    ],
  },
  tags: { operation: 'toggleItemInCart', screen: 'CurrentList' },
  ...overrides,
});

/** An event from the global handlers, with no tag of its own. */
const withoutTags = ({ tags: _tags, ...rest }: ErrorEvent): ErrorEvent => rest;

class StorageError extends Error {
  readonly code = 13;
  constructor() {
    super('Storage operation failed');
    this.name = 'StorageError';
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createSentryErrorReporter', () => {
  it('FR-030 FR-030a starts Sentry with no PII, no breadcrumbs, 30 cached reports, native crashes on, sessions and app hangs off', () => {
    const { options } = start();

    expect(init).toHaveBeenCalledTimes(1);
    expect(options).toEqual(
      expect.objectContaining({
        dsn,
        sendDefaultPii: false,
        maxCacheItems: 30,
        enableNativeCrashHandling: true,
        maxBreadcrumbs: 0,
        enableAppHangTracking: false,
        enableAutoSessionTracking: false,
      }),
    );
    // The SDK reads the release and dist from the native app (research R13).
    expect(options).not.toHaveProperty('release');
    expect(options).not.toHaveProperty('dist');
  });

  it.each(['production', 'preview'])(
    'FR-030 hands the %s environment to Sentry',
    (environment) => {
      const { options } = start(environment);

      expect(options.environment).toBe(environment);
    },
  );

  it.each([['development'], ['test'], [''], [undefined]])(
    'FR-030 with the environment %p, does not start Sentry and reports to the console',
    (environment) => {
      const reporter = createSentryErrorReporter({ dsn, environment });

      expect(init).not.toHaveBeenCalled();
      expect(reporter).toBeInstanceOf(ConsoleErrorReporter);
    },
  );

  it('with no DSN, does not start Sentry and reports to the console', () => {
    const reporter = createSentryErrorReporter({
      dsn: '',
      environment: 'production',
    });

    expect(init).not.toHaveBeenCalled();
    expect(reporter).toBeInstanceOf(ConsoleErrorReporter);
  });

  it('FR-030 keeps the debug ids that match the uploaded source maps', () => {
    const { beforeSend } = start();
    const debugMeta = {
      images: [
        {
          type: 'sourcemap' as const,
          code_file: 'app:///index.android.bundle',
          debug_id: '2a5e7b1c-4d3f-4e8a-9b6c-0f1d2e3a4b5c',
        },
      ],
    };

    const sent = beforeSend(event({ debug_meta: debugMeta }));

    expect(sent?.debug_meta).toEqual(debugMeta);
  });

  it('keeps the links between the errors of a cause chain', () => {
    const { beforeSend } = start();
    const linked = {
      type: 'generic',
      handled: true,
      source: 'cause',
      exception_id: 1,
      parent_id: 0,
      is_exception_group: false,
    };
    const root = {
      type: 'generic',
      handled: true,
      exception_id: 0,
      parent_id: 0,
      is_exception_group: false,
    };

    const sent = beforeSend(
      event({
        exception: {
          values: [
            { type: 'Error', value: 'cause', mechanism: linked },
            {
              type: 'Error',
              value: 'boom',
              mechanism: root,
            },
          ],
        },
      }),
    );

    expect(sent?.exception?.values?.map((value) => value.mechanism)).toEqual([
      linked,
      {
        type: 'generic',
        handled: true,
        exception_id: 0,
        parent_id: 0,
        is_exception_group: false,
      },
    ]);
  });

  it('keeps no breadcrumb', () => {
    const { options } = start();

    expect(
      options.beforeBreadcrumb?.({ category: 'console', message: 'Lait' }),
    ).toBeNull();
    expect(
      options.beforeBreadcrumb?.({ category: 'navigation', data: {} }),
    ).toBeNull();
  });

  it('removes the request data', () => {
    const { beforeSend } = start();

    const sent = beforeSend(event({ request: { url: 'app:///Lists' } }));

    expect(sent).not.toHaveProperty('request');
  });

  it('FR-030 sets the global operation tag to uncaught, and the screen tag on setScreen, so native crashes carry both', () => {
    const { reporter } = start();

    expect(setTag).toHaveBeenCalledWith('operation', 'uncaught');

    reporter.setScreen('Lists');

    expect(setTag).toHaveBeenCalledWith('screen', 'Lists');
  });

  it("FR-030 empties the exception's text and keeps its stack frames", () => {
    const { beforeSend } = start();

    const sent = beforeSend(
      event({}, { value: "Cannot read 'Houmous maison'" }),
    );

    expect(sent?.exception?.values?.[0]?.value).toBe('');
    expect(sent?.exception?.values?.[0]?.stacktrace?.frames).toEqual(frames);
    expect(JSON.stringify(sent)).not.toContain('Houmous');
  });

  it('FR-030 keeps only the error type, error code, stack trace, operation, screen, app version, device model, system version and environment', () => {
    const { beforeSend } = start();

    const sent = beforeSend(
      event({
        timestamp: 1_780_000_000,
        platform: 'javascript',
        level: 'error',
        release: 'mes-courses@1.0.0+42',
        dist: '42',
        environment: 'production',
        message: 'Liste Courses de la semaine',
        tags: {
          operation: 'toggleItemInCart',
          screen: 'CurrentList',
          listName: 'Courses',
        },
        extra: { article: 'Lait' },
        user: { id: 'install-1', ip_address: '192.0.2.1' },
        breadcrumbs: [{ message: 'Lait' }],
        contexts: {
          device: {
            model: 'Pixel 8',
            memory_size: 8_000_000_000,
            name: 'Le téléphone de Marie',
          },
          os: { name: 'Android', version: '15', kernel_version: '6.1' },
          app: { app_name: 'Mes courses', app_memory: 120 },
        },
        modules: { react: '19.2.3' },
        server_name: 'Le téléphone de Marie',
      }),
    );

    expect(sent).toEqual({
      event_id: 'event-1',
      timestamp: 1_780_000_000,
      platform: 'javascript',
      level: 'error',
      release: 'mes-courses@1.0.0+42',
      dist: '42',
      environment: 'production',
      exception: {
        values: [{ type: 'Error', value: '', stacktrace: { frames } }],
      },
      tags: { operation: 'toggleItemInCart', screen: 'CurrentList' },
      contexts: {
        device: { model: 'Pixel 8' },
        os: { name: 'Android', version: '15' },
      },
      fingerprint: ['Error', '', 'toggleItemInCart', 'CurrentList'],
    });
  });

  it('FR-030 keeps no identifier and no device name, and keeps the device model', () => {
    const { beforeSend } = start();

    const sent = beforeSend(
      event({
        user: { id: 'install-1' },
        contexts: {
          device: { name: 'iPhone de Marie', model: 'iPhone15,2' },
        },
      }),
    );

    expect(sent).not.toHaveProperty('user');
    expect(sent?.contexts?.device).toEqual({ model: 'iPhone15,2' });
    expect(JSON.stringify(sent)).not.toContain('Marie');
  });

  it('FR-039a gives an event from the global handlers the operation uncaught and the last screen recorded', () => {
    const { reporter, beforeSend } = start();
    reporter.setScreen('CurrentList');
    reporter.setScreen('Lists');

    const sent = beforeSend(withoutTags(event()));

    expect(sent?.tags).toEqual({ operation: 'uncaught', screen: 'Lists' });
  });

  it('FR-030 removes the global screen tag on clearScreen, so a later event carries no screen', () => {
    const { reporter, beforeSend } = start();
    reporter.setScreen('Lists');

    reporter.clearScreen();

    expect(setTag).toHaveBeenLastCalledWith('screen', undefined);
    expect(beforeSend(withoutTags(event()))?.tags).toEqual({
      operation: 'uncaught',
    });
  });

  it('report with no screen keeps the global screen tag', () => {
    const { reporter, beforeSend } = start();
    reporter.setScreen('Lists');
    setTag.mockClear();
    const error = new Error('boom');

    reporter.report(error, { operation: 'createList' });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { operation: 'createList' },
    });
    expect(setTag).not.toHaveBeenCalled();
    expect(
      beforeSend(event({ tags: { operation: 'createList' } }))?.tags,
    ).toEqual({ operation: 'createList', screen: 'Lists' });
  });

  it('report with a screen tags that one event only, without changing the global tags', () => {
    const { reporter } = start();
    setTag.mockClear();
    const error = new Error('boom');

    reporter.report(error, {
      operation: 'toggleItemInCart',
      screen: 'CurrentList',
    });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { operation: 'toggleItemInCart', screen: 'CurrentList' },
    });
    expect(setTag).not.toHaveBeenCalled();
  });

  describe('FR-030 once per opening', () => {
    const failure = { operation: 'toggleItemInCart', screen: 'CurrentList' };
    const storageFailure = () =>
      [
        event({ tags: failure }, { type: 'StorageError' }),
        { originalException: new StorageError() },
      ] as const;

    it('sends the first of two identical failures and drops the second', () => {
      const { beforeSend } = start();

      expect(beforeSend(...storageFailure())).not.toBeNull();
      expect(beforeSend(...storageFailure())).toBeNull();
    });

    it.each([
      [
        'error type',
        event({ tags: failure }, { type: 'Error' }),
        { originalException: Object.assign(new Error(), { code: 13 }) },
      ],
      [
        'error code',
        event({ tags: failure }, { type: 'StorageError' }),
        {
          originalException: Object.assign(new StorageError(), { code: 19 }),
        },
      ],
      [
        'operation',
        event(
          { tags: { ...failure, operation: 'finishShopping' } },
          { type: 'StorageError' },
        ),
        { originalException: new StorageError() },
      ],
      [
        'screen',
        event(
          { tags: { ...failure, screen: 'Lists' } },
          { type: 'StorageError' },
        ),
        { originalException: new StorageError() },
      ],
    ])('sends a failure that differs in its %s', (_, other, hint) => {
      const { beforeSend } = start();
      beforeSend(...storageFailure());

      expect(beforeSend(other, hint)).not.toBeNull();
    });

    it('sends the failure again from a new opening', () => {
      start().beforeSend(...storageFailure());

      expect(start().beforeSend(...storageFailure())).not.toBeNull();
    });
  });

  it('FR-030 keeps the type and code of a StorageError', () => {
    const { beforeSend } = start();

    const sent = beforeSend(event({}, { type: 'StorageError' }), {
      originalException: new StorageError(),
    });

    expect(sent?.exception?.values?.[0]?.type).toBe('StorageError');
    expect(sent?.tags?.code).toBe('13');
  });

  it('FR-030 keeps the type of an Error with no code, and no code', () => {
    const { beforeSend } = start();

    const sent = beforeSend(event(), { originalException: new Error('boom') });

    expect(sent?.exception?.values?.[0]?.type).toBe('Error');
    expect(sent?.tags).not.toHaveProperty('code');
  });

  it('FR-030c fingerprints a failure with its type, code, operation and screen', () => {
    const { reporter, beforeSend } = start();

    expect(
      beforeSend(event({}, { type: 'StorageError' }), {
        originalException: new StorageError(),
      })?.fingerprint,
    ).toEqual(['StorageError', '13', 'toggleItemInCart', 'CurrentList']);

    reporter.setScreen('Lists');
    expect(
      beforeSend(withoutTags(event()), {
        originalException: new Error('boom'),
      })?.fingerprint,
    ).toEqual(['Error', '', 'uncaught', 'Lists']);
  });

  it("FR-030b filters and fingerprints another feature's report like the others", () => {
    const { reporter, beforeSend } = start();
    const error = new Error("Cannot edit 'Houmous maison'");

    reporter.report(error, { operation: 'editArticle', screen: 'AddArticles' });
    const sent = beforeSend(
      event(
        { tags: { operation: 'editArticle', screen: 'AddArticles' } },
        { value: error.message },
      ),
      { originalException: error },
    );

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { operation: 'editArticle', screen: 'AddArticles' },
    });
    expect(sent?.exception?.values?.[0]?.value).toBe('');
    expect(sent?.fingerprint).toEqual([
      'Error',
      '',
      'editArticle',
      'AddArticles',
    ]);
  });

  it('crashNatively crashes in native code', () => {
    const { reporter } = start();

    reporter.crashNatively();

    expect(Sentry.nativeCrash).toHaveBeenCalledTimes(1);
  });

  it('report, setScreen and clearScreen never throw, even when the SDK throws', () => {
    const { reporter } = start();
    captureException.mockImplementation(() => {
      throw new Error('SDK failure');
    });
    setTag.mockImplementation(() => {
      throw new Error('SDK failure');
    });

    expect(() =>
      reporter.report(new Error('boom'), { operation: 'createList' }),
    ).not.toThrow();
    expect(() => reporter.setScreen('Lists')).not.toThrow();
    expect(() => reporter.clearScreen()).not.toThrow();
  });
});
