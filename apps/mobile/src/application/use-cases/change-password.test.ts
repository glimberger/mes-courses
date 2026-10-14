import { err, ok } from '../../domain/result';
import { InMemoryAccountServer } from '../testing/in-memory-account-server';
import { pairedDevice } from '../testing/paired-device';
import { createChangePassword } from './change-password';

const setup = async () => {
  const device = await pairedDevice();
  const accountServer = new InMemoryAccountServer();
  const changePassword = createChangePassword({ ...device, accountServer });
  return { accountServer, changePassword };
};

const CURRENT = 'correct horse battery';
const NEXT = 'another long password';

describe('changePassword', () => {
  it('004 US6-2 sends the current and the new password', async () => {
    const { accountServer, changePassword } = await setup();

    expect(await changePassword(CURRENT, NEXT, NEXT)).toEqual(ok(undefined));

    expect(accountServer.changePasswordCalls).toEqual([
      { currentPassword: CURRENT, newPassword: NEXT },
    ]);
  });

  it('004 US6-2 catches SameAsCurrent locally and makes no request', async () => {
    const { accountServer, changePassword } = await setup();

    expect(await changePassword(CURRENT, CURRENT, CURRENT)).toEqual(
      err({ type: 'PasswordRejected', problem: 'SameAsCurrent' }),
    );
    expect(accountServer.changePasswordCalls).toEqual([]);
  });

  it('004 refuses a too short password locally', async () => {
    const { accountServer, changePassword } = await setup();

    expect(await changePassword(CURRENT, 'short', 'short')).toEqual(
      err({ type: 'PasswordRejected', problem: 'TooShort' }),
    );
    expect(accountServer.changePasswordCalls).toEqual([]);
  });

  it('004 refuses entries that differ, comparing them after NFC normalization', async () => {
    const { accountServer, changePassword } = await setup();
    const nfc = 'mot de passe é accentué';

    expect(await changePassword(CURRENT, NEXT, `${NEXT}!`)).toEqual(
      err({ type: 'PasswordsDiffer' }),
    );
    expect(await changePassword(CURRENT, nfc, nfc.normalize('NFD'))).toEqual(
      ok(undefined),
    );
    expect(accountServer.changePasswordCalls).toHaveLength(1);
  });

  it('004 returns the refusals of the server as they are', async () => {
    const { accountServer, changePassword } = await setup();

    accountServer.changePasswordResult = err({ type: 'InvalidCredentials' });
    expect(await changePassword(CURRENT, NEXT, NEXT)).toEqual(
      err({ type: 'InvalidCredentials' }),
    );
    accountServer.changePasswordResult = err({
      type: 'TooManyAttempts',
      minutesToWait: 4,
    });
    expect(await changePassword(CURRENT, NEXT, NEXT)).toEqual(
      err({ type: 'TooManyAttempts', minutesToWait: 4 }),
    );
    accountServer.offline = true;
    expect(await changePassword(CURRENT, NEXT, NEXT)).toEqual(
      err({ type: 'Offline' }),
    );
  });

  it('004 fails as not authorized for a device with no connection', async () => {
    const device = await pairedDevice();
    await device.credentials.clear();
    const accountServer = new InMemoryAccountServer();

    expect(
      await createChangePassword({ ...device, accountServer })(
        CURRENT,
        NEXT,
        NEXT,
      ),
    ).toEqual(err({ type: 'DeviceNotAuthorized' }));
    expect(accountServer.changePasswordCalls).toEqual([]);
  });
});
