import { ConsoleErrorReporter } from './console-error-reporter';

describe('ConsoleErrorReporter', () => {
  let print: jest.SpyInstance;

  beforeEach(() => {
    print = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    print.mockRestore();
  });

  it('prints each report with its operation and screen', () => {
    const reporter = new ConsoleErrorReporter();
    const error = new Error('boom');

    reporter.report(error, {
      operation: 'toggleItemInCart',
      screen: 'CurrentList',
    });

    expect(print).toHaveBeenCalledWith(
      'Error report',
      { operation: 'toggleItemInCart', screen: 'CurrentList' },
      error,
    );
  });

  it('prints the last screen recorded with a report that names none', () => {
    const reporter = new ConsoleErrorReporter();
    const error = new Error('boom');
    reporter.setScreen('CurrentList');
    reporter.setScreen('Lists');

    reporter.report(error, { operation: 'createList' });

    expect(print).toHaveBeenCalledWith(
      'Error report',
      { operation: 'createList', screen: 'Lists' },
      error,
    );
  });

  it('setScreen only remembers the screen and prints nothing', () => {
    new ConsoleErrorReporter().setScreen('Lists');

    expect(print).not.toHaveBeenCalled();
  });

  it('crashNatively prints a line and does not crash', () => {
    const reporter = new ConsoleErrorReporter();

    expect(() => reporter.crashNatively()).not.toThrow();
    expect(print).toHaveBeenCalledTimes(1);
  });
});
