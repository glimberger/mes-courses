import { ConsoleErrorReporter } from './console-error-reporter';

describe('ConsoleErrorReporter', () => {
  it('prints each report with its operation and route', () => {
    const print = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('boom');

    new ConsoleErrorReporter().report(error, {
      operation: 'sync',
      route: 'POST /v1/sync',
    });

    expect(print).toHaveBeenCalledWith(
      'Error report',
      { operation: 'sync', route: 'POST /v1/sync' },
      error,
    );
    print.mockRestore();
  });
});
