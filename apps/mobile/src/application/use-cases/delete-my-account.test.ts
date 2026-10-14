import { err, ok } from '../../domain/result';
import type { LocalDataEraser } from '../ports/local-data-eraser';
import { InMemoryAccountServer } from '../testing/in-memory-account-server';
import { pairedDevice } from '../testing/paired-device';
import { createDeleteMyAccount } from './delete-my-account';

const setup = async () => {
  const device = await pairedDevice();
  const accountServer = new InMemoryAccountServer();
  let erasures = 0;
  const localDataEraser: LocalDataEraser = {
    erase: async () => {
      erasures += 1;
    },
  };
  return {
    ...device,
    accountServer,
    erasures: () => erasures,
    deleteMyAccount: createDeleteMyAccount({
      ...device,
      accountServer,
      localDataEraser,
    }),
  };
};

describe('deleteMyAccount', () => {
  it('004 US6-6 deletes the account, then clears the credential and erases the copy', async () => {
    const { deleteMyAccount, accountServer, credentials, erasures, calls } =
      await setup();

    expect(await deleteMyAccount('my password')).toEqual(ok(undefined));

    expect(accountServer.deleteAccountCalls).toEqual([
      { password: 'my password' },
    ]);
    expect(await credentials.read()).toBeNull();
    expect(erasures()).toBe(1);
    // The server ended this device with the account: no revocation to ask for.
    expect(calls).toEqual([]);
  });

  it('004 US6-6 a wrong password changes nothing', async () => {
    const { deleteMyAccount, accountServer, credentials, erasures } =
      await setup();
    accountServer.deleteAccountResult = err({ type: 'InvalidCredentials' });

    expect(await deleteMyAccount('wrong')).toEqual(
      err({ type: 'InvalidCredentials' }),
    );

    expect(await credentials.read()).toBe('secret-credential');
    expect(erasures()).toBe(0);
  });

  it('004 US6-7 the last administrator is refused and nothing changes', async () => {
    const { deleteMyAccount, accountServer, credentials, erasures } =
      await setup();
    accountServer.deleteAccountResult = err({ type: 'LastAdministrator' });

    expect(await deleteMyAccount('my password')).toEqual(
      err({ type: 'LastAdministrator' }),
    );

    expect(await credentials.read()).toBe('secret-credential');
    expect(erasures()).toBe(0);
  });

  it('004 offline changes nothing', async () => {
    const { deleteMyAccount, accountServer, credentials, erasures } =
      await setup();
    accountServer.offline = true;

    expect(await deleteMyAccount('my password')).toEqual(
      err({ type: 'Offline' }),
    );

    expect(await credentials.read()).toBe('secret-credential');
    expect(erasures()).toBe(0);
  });
});
