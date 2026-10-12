import { account, device } from '../testing/contracts/entities';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { InMemoryStore } from '../testing/in-memory-store';
import { authenticateDevice } from './authenticate-device';

const crypto = createFakePairingCrypto();

const setup = async () => {
  const store = new InMemoryStore();
  await store.run(async ({ accounts, devices }) => {
    await accounts.add(
      account('acc-1', 'marie@example.org', { passwordHash: 'h' }),
    );
    await devices.add(
      device('d-1', crypto.sha256Hex('credential-1'), { accountId: 'acc-1' }),
    );
  });
  return { store, deps: { store, crypto } };
};

describe('authenticateDevice', () => {
  it('004 resolves a credential to its device and account', async () => {
    const { deps } = await setup();

    const result = await authenticateDevice(deps, 'credential-1');

    expect(result).toMatchObject({
      kind: 'authorized',
      device: { id: 'd-1', accountId: 'acc-1' },
      account: { id: 'acc-1', role: 'user' },
    });
  });

  it('004 R7 refuses a missing or unknown credential as DeviceNotAuthorized', async () => {
    const { deps } = await setup();

    expect(await authenticateDevice(deps, null)).toEqual({
      kind: 'notAuthorized',
    });
    expect(await authenticateDevice(deps, 'credential-9')).toEqual({
      kind: 'notAuthorized',
    });
  });

  it('004 R7 tells a credential of a deleted account from an unknown one', async () => {
    const { store, deps } = await setup();
    await store.run(({ endedCredentials }) =>
      endedCredentials.add(
        crypto.sha256Hex('credential-7'),
        'accountDeleted',
        '2026-10-01T10:00:00.000Z',
      ),
    );

    expect(await authenticateDevice(deps, 'credential-7')).toEqual({
      kind: 'accountDeleted',
    });
  });

  it('004 R7 refuses a revoked device as DeviceNotAuthorized', async () => {
    const { store, deps } = await setup();
    await store.run(({ devices }) =>
      devices.update(
        device('d-1', crypto.sha256Hex('credential-1'), {
          accountId: 'acc-1',
          revokedAt: '2026-10-02T10:00:00.000Z',
        }),
      ),
    );

    expect(await authenticateDevice(deps, 'credential-1')).toEqual({
      kind: 'notAuthorized',
    });
  });

  it('004 R7 refuses a device of a suspended account, and a revoked one still reads as revoked first', async () => {
    const { store, deps } = await setup();
    await store.run(({ accounts }) =>
      accounts.update(
        account('acc-1', 'marie@example.org', {
          passwordHash: 'h',
          suspendedAt: '2026-10-02T10:00:00.000Z',
        }),
      ),
    );

    expect(await authenticateDevice(deps, 'credential-1')).toEqual({
      kind: 'suspended',
    });

    await store.run(({ devices }) =>
      devices.update(
        device('d-1', crypto.sha256Hex('credential-1'), {
          accountId: 'acc-1',
          revokedAt: '2026-10-02T10:00:00.000Z',
        }),
      ),
    );
    expect(await authenticateDevice(deps, 'credential-1')).toEqual({
      kind: 'notAuthorized',
    });
  });
});
