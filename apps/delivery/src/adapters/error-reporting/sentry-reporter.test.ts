import { createSentryReporter, type SentryClient } from './sentry-reporter';

const fakeClient = () => {
  const events: Parameters<SentryClient['captureEvent']>[0][] = [];
  const checkIns: Parameters<SentryClient['captureCheckIn']>[] = [];
  const flushes: number[] = [];
  const client: SentryClient = {
    captureEvent: (event) => void events.push(event),
    captureCheckIn: (...args) => void checkIns.push(args),
    flush: async (ms) => void flushes.push(ms),
  };
  return { client, events, checkIns, flushes };
};

const quiet = () => undefined;

describe('Sentry reporter', () => {
  it.each([
    ['info', 'info'],
    ['error', 'error'],
    ['critical', 'fatal'],
  ] as const)('maps the %s level to Sentry %s', (level, expected) => {
    const { client, events } = fakeClient();
    createSentryReporter(client, quiet).report(level, 'm', {
      environment: 'staging',
    });
    expect(events[0]?.level).toBe(expected);
  });

  it('tags every event with the component and names the instance, the commit and the reason', () => {
    const { client, events } = fakeClient();
    createSentryReporter(client, quiet).report(
      'error',
      'Deployment of 1.2.0 was rolled back: timeout',
      { environment: 'production', commit: 'abc' },
    );
    expect(events[0]).toMatchObject({
      message: 'production: Deployment of 1.2.0 was rolled back: timeout',
      environment: 'production',
      tags: { component: 'delivery-agent', commit: 'abc' },
    });
  });

  it('gives a success a fixed fingerprint per environment, and no other level one', () => {
    const { client, events } = fakeClient();
    const reporter = createSentryReporter(client, quiet);
    reporter.report('info', 'Deployed 1', {
      environment: 'staging',
      commit: 'a',
    });
    reporter.report('info', 'Deployed 2', {
      environment: 'staging',
      commit: 'b',
    });
    reporter.report('info', 'Deployed 3', { environment: 'production' });
    reporter.report('error', 'x', { environment: 'staging' });
    expect(events.map((e) => e.fingerprint)).toEqual([
      ['deployment-succeeded', 'staging'],
      ['deployment-succeeded', 'staging'],
      ['deployment-succeeded', 'production'],
      undefined,
    ]);
  });

  it('also writes the report to the journal', () => {
    const lines: string[] = [];
    createSentryReporter(fakeClient().client, (l) => lines.push(l)).report(
      'error',
      'boom',
      { environment: 'staging' },
    );
    expect(lines).toEqual(['error boom environment=staging']);
  });

  it('checks in on the monitor with its config: every 2 minutes, missed after 30', () => {
    const { client, checkIns } = fakeClient();
    const reporter = createSentryReporter(client, quiet);
    reporter.checkIn('ok');
    reporter.checkIn('error');
    expect(checkIns.map(([c]) => c)).toEqual([
      { monitorSlug: 'mes-courses-agent', status: 'ok' },
      { monitorSlug: 'mes-courses-agent', status: 'error' },
    ]);
    expect(checkIns[0]?.[1]).toEqual({
      schedule: { type: 'interval', value: 2, unit: 'minute' },
      checkinMargin: 30,
    });
  });

  it('flushes the client before the process exits', async () => {
    const { client, flushes } = fakeClient();
    await createSentryReporter(client, quiet).flush();
    expect(flushes).toHaveLength(1);
  });
});
