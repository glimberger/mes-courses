import { err, ok } from '../../domain/result';
import { InMemoryAccountServer } from '../testing/in-memory-account-server';
import { createRequestPasswordReset } from './request-password-reset';

const setup = (serverUrl = 'https://courses.example.fr') => {
  const accountServer = new InMemoryAccountServer();
  return {
    accountServer,
    request: createRequestPasswordReset({ accountServer, serverUrl }),
  };
};

describe('requestPasswordReset', () => {
  it('004 US4-1 sends the normalized address to the fixed server address (013)', async () => {
    const { accountServer, request } = setup('https://fixed.example.fr');

    expect(await request(' Marie@Example.org ')).toEqual(ok(undefined));
    expect(accountServer.passwordResetCalls).toEqual([
      { url: 'https://fixed.example.fr', email: 'marie@example.org' },
    ]);
  });

  it('004 US4-3 answers the same success whether or not the account exists', async () => {
    const { request } = setup();

    expect(await request('marie@example.org')).toEqual(
      await request('nobody@example.org'),
    );
  });

  it('004 US4-3 refuses a malformed address without any request', async () => {
    const { accountServer, request } = setup();

    expect(await request('not an address')).toEqual(
      err({ type: 'InvalidEmail' }),
    );
    expect(accountServer.passwordResetCalls).toEqual([]);
  });

  it('004 US4-4 reports the minutes to wait', async () => {
    const { accountServer, request } = setup();
    accountServer.passwordResetResult = err({
      type: 'TooManyAttempts',
      minutesToWait: 42,
    });

    expect(await request('marie@example.org')).toEqual(
      err({ type: 'TooManyAttempts', minutesToWait: 42 }),
    );
  });

  it('004 reports an unreachable server', async () => {
    const { accountServer, request } = setup();
    accountServer.offline = true;

    expect(await request('marie@example.org')).toEqual(
      err({ type: 'ServerUnreachable' }),
    );
  });
});
