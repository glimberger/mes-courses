import type { Change, Hlc } from '@mes-courses/sync-core';

import { buildApp } from '../adapters/http/app';
import { openDatabase } from '../adapters/sqlite/open-database';
import { SqliteStore } from '../adapters/sqlite/sqlite-store';
import type {
  ErrorContext,
  ErrorReporter,
} from '../application/ports/error-reporter';
import type { Repositories, ServerStore } from '../application/ports/store';
import { createPairingCode } from '../application/use-cases/create-pairing-code';
import { appDeps } from './wiring';

/**
 * Where the store fails: `afterAuth` lets the credential lookup and the server identity through,
 * so the route itself fails; `everywhere` fails them too.
 */
type Breakage = 'none' | 'afterAuth' | 'everywhere';

const broken = () => {
  throw new Error('store unavailable');
};

/** A repository whose every method throws. */
const failingRepository = <R extends object>(): R =>
  new Proxy({} as R, { get: () => broken });

/** The real store, made to fail inside its transactions on demand. */
class BreakableStore implements ServerStore {
  breakage: Breakage = 'none';

  constructor(private readonly inner: ServerStore) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.inner.run((repos) => {
      if (this.breakage === 'none') return work(repos);
      const keep = this.breakage === 'afterAuth';
      return work({
        meta: keep ? repos.meta : failingRepository(),
        categories: failingRepository(),
        articles: failingRepository(),
        lists: failingRepository(),
        items: failingRepository(),
        appliedChanges: failingRepository(),
        devices: keep
          ? {
              ...failingRepository<Repositories['devices']>(),
              findByCredentialHash: (hash) =>
                repos.devices.findByCredentialHash(hash),
              get: broken,
              add: broken,
              update: broken,
              all: broken,
            }
          : failingRepository(),
        pairingCodes: failingRepository(),
        pairingFailures: failingRepository(),
      } as Repositories);
    });
  }
}

class RecordingReporter implements ErrorReporter {
  readonly reports: { error: unknown; context: ErrorContext }[] = [];

  report(error: unknown, context: ErrorContext): void {
    this.reports.push({ error, context });
  }
}

const HOST = 'courses.example.fr';
const deviceName = 'Tablette de Camille';
const newName = 'Téléphone de Camille';
const hlc: Hlc = { wallMs: Date.now(), counter: 0, deviceId: 'device' };
const changes: Change[] = [
  {
    changeId: '00000000-0000-4000-8000-000000000001',
    hlc,
    kind: 'list',
    id: 'list-1',
    fields: { name: 'Barbecue' },
  },
  {
    changeId: '00000000-0000-4000-8000-000000000002',
    hlc,
    kind: 'article',
    id: 'article-1',
    fields: { name: 'Houmous maison', categoryId: 'category-1' },
  },
];

/** A report as Sentry would get it: its context, and the error's name, message and own fields. */
const serialize = ({
  error,
  context,
}: {
  error: unknown;
  context: ErrorContext;
}): string =>
  JSON.stringify({
    context,
    error:
      error instanceof Error
        ? { ...error, name: error.name, message: error.message }
        : String(error),
  });

const harness = async () => {
  const db = openDatabase(':memory:');
  const store = new BreakableStore(new SqliteStore(db));
  const reporter = new RecordingReporter();
  const deps = appDeps({ store, errorReporter: reporter });
  const app = buildApp(deps);
  const claim = async (code: string, name: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/pairing/claim',
      headers: { host: HOST },
      payload: { code, deviceName: name },
    });
  const paired = (
    await claim((await createPairingCode(deps, null)).code, deviceName)
  ).json() as {
    deviceId: string;
    credential: string;
  };
  const spareCode = (await createPairingCode(deps, null)).code;
  return { app, deps, db, store, reporter, claim, paired, spareCode };
};

type Harness = Awaited<ReturnType<typeof harness>>;

/** Every route of the API, called with what must never reach a report. */
const requests: Record<string, (h: Harness) => Promise<unknown>> = {
  // A fresh app: the first one already holds the server identity, read once.
  'GET /v1/health': ({ deps }) =>
    buildApp(deps).inject({
      method: 'GET',
      url: '/v1/health',
      headers: { host: HOST },
    }),
  'POST /v1/pairing/claim': ({ claim, spareCode }) =>
    claim(spareCode, deviceName),
  'POST /v1/pairing-codes': ({ app, paired }) =>
    app.inject({
      method: 'POST',
      url: '/v1/pairing-codes',
      headers: { host: HOST, authorization: `Bearer ${paired.credential}` },
      payload: {},
    }),
  'GET /v1/devices': ({ app, paired }) =>
    app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: { host: HOST, authorization: `Bearer ${paired.credential}` },
    }),
  'PATCH /v1/devices/:id': ({ app, paired }) =>
    app.inject({
      method: 'PATCH',
      url: `/v1/devices/${paired.deviceId}`,
      headers: { host: HOST, authorization: `Bearer ${paired.credential}` },
      payload: { name: newName },
    }),
  'DELETE /v1/devices/:id': ({ app, paired }) =>
    app.inject({
      method: 'DELETE',
      url: `/v1/devices/${paired.deviceId}`,
      headers: { host: HOST, authorization: `Bearer ${paired.credential}` },
    }),
  'POST /v1/sync': ({ app, paired }) =>
    app.inject({
      method: 'POST',
      url: '/v1/sync',
      headers: { host: HOST, authorization: `Bearer ${paired.credential}` },
      payload: { lastSeq: 0, hlc, changes },
    }),
};

const cases = (['afterAuth', 'everywhere'] as const).flatMap((breakage) =>
  Object.entries(requests).map(
    ([route, send]) => [route, breakage, send] as const,
  ),
);

describe('the context of every report the server makes', () => {
  it.each(cases)(
    'FR-022a %s with the store failing %s reports the operation and the route only, never a request content',
    async (route, breakage, send) => {
      const h = await harness();
      h.store.breakage = breakage;
      try {
        await send(h);
      } finally {
        h.db.close();
      }

      const forbidden = [
        HOST,
        deviceName,
        newName,
        h.paired.credential,
        h.paired.deviceId,
        h.spareCode,
        h.spareCode.replace('-', ''),
        'Barbecue',
        'Houmous maison',
      ];
      // `GET /v1/health` reads only the identity, which `afterAuth` lets through.
      if (!(route === 'GET /v1/health' && breakage === 'afterAuth')) {
        expect(h.reporter.reports.length).toBeGreaterThan(0);
      }
      for (const report of h.reporter.reports) {
        expect(Object.keys(report.context).sort()).toEqual([
          'operation',
          'route',
        ]);
        expect(report.context.route).toMatch(
          /^(identity|none|[A-Z]+ \/v1\/[a-z/:-]+)$/,
        );
        const serialized = serialize(report);
        for (const text of forbidden) {
          expect(serialized).not.toContain(text);
        }
      }
    },
  );
});
