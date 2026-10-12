import { InMemoryAdminServer } from '../testing/in-memory-admin-server';
import { pairedDevice } from '../testing/paired-device';
import { createInviteAccount } from './invite-account';

const setup = async () => {
  const { unitOfWork, credentials } = await pairedDevice();
  const adminServer = new InMemoryAdminServer();
  return {
    adminServer,
    invite: createInviteAccount({ unitOfWork, credentials, adminServer }),
  };
};

describe('inviteAccount', () => {
  it('004 US1-1 sends the normalized address and returns the new account', async () => {
    const { adminServer, invite } = await setup();

    const result = await invite('  Marie@Example.org ');

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        email: 'marie@example.org',
        state: 'invited',
      }),
    });
    expect(adminServer.invited).toEqual(['marie@example.org']);
  });

  it('004 US1-2 reports an address that already has an account', async () => {
    const { invite } = await setup();
    await invite('marie@example.org');

    expect(await invite('MARIE@example.org')).toEqual({
      ok: false,
      error: { type: 'AccountExists' },
    });
  });

  it('004 US1-3 refuses an address that is not valid without any request', async () => {
    const { adminServer, invite } = await setup();
    const spy = jest.spyOn(adminServer, 'invite');

    expect(await invite('not an address')).toEqual({
      ok: false,
      error: { type: 'InvalidEmail' },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('004 US1-4 reports an invitation that could not be sent', async () => {
    const { adminServer, invite } = await setup();
    adminServer.mailFails = true;

    expect(await invite('marie@example.org')).toEqual({
      ok: false,
      error: { type: 'MailFailed' },
    });
    expect(adminServer.accounts).toEqual([]);
  });

  it('004 reports Offline when the server cannot be reached', async () => {
    const { adminServer, invite } = await setup();
    adminServer.offline = true;

    expect(await invite('marie@example.org')).toEqual({
      ok: false,
      error: { type: 'Offline' },
    });
  });
});
