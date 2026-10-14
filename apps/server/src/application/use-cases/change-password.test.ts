import { attemptKey } from '../../domain/attempts';
import type { AccountRecord } from '../../domain/account';
import type { Clock } from '../ports/clock';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { InMemoryStore } from '../testing/in-memory-store';
import { changePassword, type OwnAccountDeps } from './change-password';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const hasher = createFakePasswordHasher();
const CURRENT = 'correct horse battery';
const NEXT = 'another long password';

const setup = async (overrides: Partial<AccountRecord> = {}) => {
  const store = new InMemoryStore();
  const deps: OwnAccountDeps = {
    store,
    clock: new FakeClock(),
    crypto: createFakePairingCrypto(),
    hasher,
  };
  await store.run(async ({ accounts }) =>
    accounts.add({
      id: 'acc-1',
      email: 'marie@example.org',
      role: 'user',
      passwordHash: await hasher.hash(CURRENT),
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
      suspendedAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      ...overrides,
    }),
  );
  return { store, deps };
};

const request = (currentPassword: string, newPassword: string) => ({
  accountId: 'acc-1',
  currentPassword,
  newPassword,
  clientAddress: '10.0.0.1',
});

const passwordHash = (store: InMemoryStore) =>
  store.run(
    async ({ accounts }) => (await accounts.get('acc-1'))?.passwordHash,
  );

describe('changePassword', () => {
  it('004 US6-2 replaces the password hash', async () => {
    const { store, deps } = await setup();

    expect(await changePassword(deps, request(CURRENT, NEXT))).toEqual({
      kind: 'changed',
    });

    expect(await passwordHash(store)).toBe(await hasher.hash(NEXT));
  });

  it('004 US6-2 leaves the devices of the account signed in', async () => {
    const { store, deps } = await setup();
    await store.run(({ devices }) =>
      devices.add({
        id: 'd-1',
        accountId: 'acc-1',
        name: 'Other',
        credentialHash: 'hash',
        createdAt: '2026-10-01T10:00:00.000Z',
        lastSyncAt: null,
        revokedAt: null,
      }),
    );

    await changePassword(deps, request(CURRENT, NEXT));

    const [device] = await store.run(({ devices }) =>
      devices.forAccount('acc-1'),
    );
    expect(device?.revokedAt).toBeNull();
  });

  it('004 clears an outstanding temporary password', async () => {
    const { store, deps } = await setup({
      temporaryPasswordHash: 'temp',
      temporaryExpiresAt: '2026-10-19T10:00:00.000Z',
    });

    await changePassword(deps, request(CURRENT, NEXT));

    const record = await store.run(({ accounts }) => accounts.get('acc-1'));
    expect(record).toMatchObject({
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
    });
  });

  it('004 verifies an accented password typed in NFD against its NFC hash', async () => {
    const nfc = 'mot de passe é accentué';
    const { store, deps } = await setup({
      passwordHash: await hasher.hash(nfc),
    });

    const outcome = await changePassword(
      deps,
      request(nfc.normalize('NFD'), NEXT),
    );

    expect(outcome).toEqual({ kind: 'changed' });
    expect(await passwordHash(store)).toBe(await hasher.hash(NEXT));
  });

  it('004 US6-2 refuses the same password, told after the current one is verified', async () => {
    const { store, deps } = await setup();

    expect(await changePassword(deps, request(CURRENT, CURRENT))).toEqual({
      kind: 'invalidPassword',
      problem: 'SameAsCurrent',
    });
    expect(await passwordHash(store)).toBe(await hasher.hash(CURRENT));
  });

  it('004 refuses a too short new password', async () => {
    const { deps } = await setup();

    expect(await changePassword(deps, request(CURRENT, 'short'))).toEqual({
      kind: 'invalidPassword',
      problem: 'TooShort',
    });
  });

  it('004 a wrong current password changes nothing, hides SameAsCurrent and is counted', async () => {
    const { store, deps } = await setup();

    expect(
      await changePassword(
        deps,
        request('wrong wrong wrong', 'wrong wrong wrong'),
      ),
    ).toEqual({
      kind: 'invalid',
    });

    expect(await passwordHash(store)).toBe(await hasher.hash(CURRENT));
    const attempts = await store.run(({ authAttempts }) =>
      authAttempts.countSince(
        'signIn',
        attemptKey(deps.crypto.sha256Hex, 'marie@example.org'),
        '2026-01-01T00:00:00.000Z',
      ),
    );
    expect(attempts).toBe(1);
  });

  it('004 blocks after five wrong passwords, even for the right one', async () => {
    const { store, deps } = await setup();
    for (let i = 0; i < 5; i++) {
      expect(
        await changePassword(deps, request('wrong wrong wrong', NEXT)),
      ).toEqual({
        kind: 'invalid',
      });
    }

    const outcome = await changePassword(deps, request(CURRENT, NEXT));

    expect(outcome).toMatchObject({ kind: 'blocked' });
    expect(await passwordHash(store)).toBe(await hasher.hash(CURRENT));
  });

  it('004 answers invalid for an account that no longer exists', async () => {
    const { deps } = await setup();

    expect(
      await changePassword(deps, {
        ...request(CURRENT, NEXT),
        accountId: 'gone',
      }),
    ).toEqual({ kind: 'invalid' });
  });
});
