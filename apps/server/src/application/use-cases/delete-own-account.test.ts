import type { Clock } from '../ports/clock';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { account, device } from '../testing/contracts/entities';
import { InMemoryStore } from '../testing/in-memory-store';
import type { OwnAccountDeps } from './change-password';
import { deleteOwnAccount } from './delete-own-account';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const hasher = createFakePasswordHasher();
const PASSWORD = 'correct horse battery';

const setup = async () => {
  const store = new InMemoryStore();
  const deps: OwnAccountDeps = {
    store,
    clock: new FakeClock(),
    crypto: createFakePairingCrypto(),
    hasher,
  };
  const passwordHash = await hasher.hash(PASSWORD);
  await store.run(async ({ accounts, devices }) => {
    await accounts.add(
      account('admin', 'admin@example.org', {
        role: 'administrator',
        passwordHash,
      }),
    );
    await accounts.add(account('user', 'u@example.org', { passwordHash }));
    await devices.add(device('d-1', 'cred-1', { accountId: 'user' }));
    await devices.add(device('d-2', 'cred-2', { accountId: 'user' }));
  });
  return { store, deps };
};

const request = (accountId: string, password: string) => ({
  accountId,
  password,
  clientAddress: '10.0.0.1',
});

describe('deleteOwnAccount', () => {
  it('004 US6-6 deletes the account and ends every device credential', async () => {
    const { store, deps } = await setup();

    expect(await deleteOwnAccount(deps, request('user', PASSWORD))).toEqual({
      kind: 'deleted',
    });

    await store.run(async ({ accounts, devices, endedCredentials }) => {
      expect(await accounts.get('user')).toBeNull();
      expect(await devices.get('d-1')).toBeNull();
      expect(await endedCredentials.find('cred-1')).toEqual({
        reason: 'accountDeleted',
      });
      expect(await endedCredentials.find('cred-2')).toEqual({
        reason: 'accountDeleted',
      });
      expect(await accounts.get('admin')).not.toBeNull();
    });
  });

  it('004 US6-6 a wrong password changes nothing', async () => {
    const { store, deps } = await setup();

    expect(
      await deleteOwnAccount(deps, request('user', 'nope nope nope')),
    ).toEqual({
      kind: 'invalid',
    });

    expect(
      await store.run(({ accounts }) => accounts.get('user')),
    ).not.toBeNull();
  });

  it('004 blocks after five wrong passwords', async () => {
    const { deps } = await setup();
    for (let i = 0; i < 5; i++) {
      await deleteOwnAccount(deps, request('user', 'nope nope nope'));
    }

    expect(
      await deleteOwnAccount(deps, request('user', PASSWORD)),
    ).toMatchObject({
      kind: 'blocked',
    });
  });

  it('004 US6-7 refuses the only active administrator', async () => {
    const { store, deps } = await setup();

    expect(await deleteOwnAccount(deps, request('admin', PASSWORD))).toEqual({
      kind: 'lastAdministrator',
    });

    expect(
      await store.run(({ accounts }) => accounts.get('admin')),
    ).not.toBeNull();
  });

  it('004 an administrator can delete themselves while another remains', async () => {
    const { store, deps } = await setup();
    await store.run(async ({ accounts }) =>
      accounts.add(
        account('admin-2', 'a2@example.org', {
          role: 'administrator',
          passwordHash: await hasher.hash(PASSWORD),
        }),
      ),
    );

    expect(await deleteOwnAccount(deps, request('admin', PASSWORD))).toEqual({
      kind: 'deleted',
    });
  });
});
