import { RecordingErrorReporter } from './recording-error-reporter';

describe('RecordingErrorReporter', () => {
  it('records nothing at first', () => {
    const reporter = new RecordingErrorReporter();

    expect(reporter.reports).toEqual([]);
    expect(reporter.screens).toEqual([]);
    expect(reporter.nativeCrashes).toBe(0);
  });

  it('records each report with its error and context, in order', () => {
    const reporter = new RecordingErrorReporter();
    const first = new Error('first');
    const second = new Error('second');

    reporter.report(first, { operation: 'startup' });
    reporter.report(second, {
      operation: 'toggleItemInCart',
      screen: 'CurrentList',
    });

    expect(reporter.reports).toEqual([
      { error: first, context: { operation: 'startup' } },
      {
        error: second,
        context: { operation: 'toggleItemInCart', screen: 'CurrentList' },
      },
    ]);
  });

  it('records every report, the same failure repeated included', () => {
    const reporter = new RecordingErrorReporter();
    const failure = new Error('failure');

    reporter.report(failure, { operation: 'startup' });
    reporter.report(failure, { operation: 'startup' });

    expect(reporter.reports).toHaveLength(2);
  });

  it('records each screen given, in order', () => {
    const reporter = new RecordingErrorReporter();

    reporter.setScreen('CurrentList');
    reporter.setScreen('Lists');

    expect(reporter.screens).toEqual(['CurrentList', 'Lists']);
  });

  it('counts the native crash requests, and does not crash', () => {
    const reporter = new RecordingErrorReporter();

    reporter.crashNatively();
    reporter.crashNatively();

    expect(reporter.nativeCrashes).toBe(2);
  });
});
