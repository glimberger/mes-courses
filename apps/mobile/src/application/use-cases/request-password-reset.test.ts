import { err, ok } from '../../domain/result';
import { InMemoryAccountServer } from '../testing/in-memory-account-server';
import { createRequestPasswordReset } from './request-password-reset';

const setup = () => {
  const accountServer = new InMemoryAccountServer();
  return {
    accountServer,
    request: createRequestPasswordReset({ accountServer }),
  };
};

describe('requestPasswordReset', () => {
  it('004 US4-1 sends the normalized address to the normalized server address', async () => {
    const { accountServer, request } = setup();

    expect(
      await request(' Courses.Example.fr/ ', ' Marie@Example.org '),
    ).toEqual(ok(undefined));
    expect(accountServer.passwordResetCalls).toEqual([
      { url: 'https://courses.example.fr', email: 'marie@example.org' },
    ]);
  });

  it('004 US4-3 answers the same success whether or not the account exists', async () => {
    const { request } = setup();

    expect(await request('courses.example.fr', 'marie@example.org')).toEqual(
      await request('courses.example.fr', 'nobody@example.org'),
    );
  });

  it('004 US4-3 refuses a malformed address or server address without any request', async () => {
    const { accountServer, request } = setup();

    expect(await request('courses.example.fr', 'not an address')).toEqual(
      err({ type: 'InvalidEmail' }),
    );
    expect(await request('http://courses.example.fr', 'a@example.org')).toEqual(
      err({ type: 'InvalidUrl' }),
    );
    expect(accountServer.passwordResetCalls).toEqual([]);
  });

  it('004 US4-4 reports the minutes to wait', async () => {
    const { accountServer, request } = setup();
    accountServer.passwordResetResult = err({
      type: 'TooManyAttempts',
      minutesToWait: 42,
    });

    expect(await request('courses.example.fr', 'marie@example.org')).toEqual(
      err({ type: 'TooManyAttempts', minutesToWait: 42 }),
    );
  });

  it('004 reports an unreachable server', async () => {
    const { accountServer, request } = setup();
    accountServer.offline = true;

    expect(await request('courses.example.fr', 'marie@example.org')).toEqual(
      err({ type: 'ServerUnreachable' }),
    );
  });
});
