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

  it('004 R10 prints no address and the account id when given', () => {
    const print = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    new ConsoleErrorReporter().report(new Error('to marie@example.org'), {
      operation: 'inviteAccount',
      route: 'POST /v1/admin/accounts',
      accountId: 'acc-1',
    });

    const [, context, printed] = print.mock.calls[0] ?? [];
    expect(context).toEqual({
      operation: 'inviteAccount',
      route: 'POST /v1/admin/accounts',
      accountId: 'acc-1',
    });
    expect((printed as Error).message).toBe('to [email]');
    print.mockRestore();
  });
});
