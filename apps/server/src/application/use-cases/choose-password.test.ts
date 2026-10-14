import type { AccountRecord } from '../../domain/account';
import type { Clock } from '../ports/clock';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { InMemoryStore } from '../testing/in-memory-store';
import { choosePassword } from './choose-password';
import { signIn, type SignInDeps } from './sign-in';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const hasher = createFakePasswordHasher();
const TEMP = 'ABCD-EFGH-JKMN-PQRS';
const NEW_PASSWORD = 'a brand new password';

const setup = async (overrides: Partial<AccountRecord> = {}) => {
  const store = new InMemoryStore();
  const clock = new FakeClock();
  let n = 0;
  const deps: SignInDeps = {
    store,
    clock,
    crypto: createFakePairingCrypto(),
    hasher,
    ids: { next: () => `id-${++n}` },
  };
  await store.run(async ({ accounts }) =>
    accounts.add({
      id: 'acc-1',
      email: 'marie@example.org',
      role: 'user',
      passwordHash: null,
      temporaryPasswordHash: await hasher.hash('ABCDEFGHJKMNPQRS'),
      temporaryExpiresAt: '2026-10-19T10:00:00.000Z',
      suspendedAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      ...overrides,
    }),
  );
  return { store, clock, deps };
};

const request = (overrides: Record<string, string> = {}) => ({
  email: 'Marie@example.org',
  temporaryPassword: TEMP,
  newPassword: NEW_PASSWORD,
  deviceName: 'Pixel 8',
  clientAddress: '10.0.0.1',
  ...overrides,
});

const accountOf = (store: InMemoryStore) =>
  store.run(({ accounts }) => accounts.get('acc-1'));
const devicesOf = (store: InMemoryStore) =>
  store.run(({ devices }) => devices.forAccount('acc-1'));

describe('choosePassword', () => {
  it('004 US2-2 sets the password, clears the temporary one and creates the device', async () => {
    const { store, deps } = await setup();

    const outcome = await choosePassword(deps, request());

    expect(outcome).toMatchObject({
      kind: 'signedIn',
      account: { id: 'acc-1', email: 'marie@example.org', role: 'user' },
    });
    expect(await accountOf(store)).toMatchObject({
      passwordHash: await hasher.hash(NEW_PASSWORD),
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
    });
    expect(await devicesOf(store)).toHaveLength(1);
  });

  it('004 US2-2 stops the temporary password working and lets the new one sign in', async () => {
    const { deps } = await setup();
    await choosePassword(deps, request());

    expect(
      await signIn(deps, {
        email: 'marie@example.org',
        password: TEMP,
        deviceName: 'Tablet',
        clientAddress: '10.0.0.1',
      }),
    ).toEqual({ kind: 'invalid' });
    expect(
      await signIn(deps, {
        email: 'marie@example.org',
        password: NEW_PASSWORD,
        deviceName: 'Tablet',
        clientAddress: '10.0.0.1',
      }),
    ).toMatchObject({ kind: 'signedIn' });
  });

  it.each([
    ['too short', 'short one', 'TooShort'],
    ['too long', 'x'.repeat(129), 'TooLong'],
    ['the temporary password', TEMP, 'SameAsTemporary'],
    [
      'the temporary password in another case',
      TEMP.toLowerCase(),
      'SameAsTemporary',
    ],
  ])(
    '004 US2-3 refuses a new password that is %s and stores nothing',
    async (_name, newPassword, problem) => {
      const { store, deps } = await setup();

      expect(await choosePassword(deps, request({ newPassword }))).toEqual({
        kind: 'invalidPassword',
        problem,
      });
      expect((await accountOf(store))?.passwordHash).toBeNull();
      expect(await devicesOf(store)).toEqual([]);
    },
  );

  it('004 US2-3 lets the new password equal the previous password of the account', async () => {
    const { deps } = await setup({
      passwordHash: await hasher.hash(NEW_PASSWORD),
    });

    expect(await choosePassword(deps, request())).toMatchObject({
      kind: 'signedIn',
    });
  });

  it('004 US2-2 refuses a second device using the temporary password after the new one was chosen', async () => {
    const { store, deps } = await setup();
    await choosePassword(deps, request());

    expect(
      await choosePassword(deps, request({ deviceName: 'Tablet' })),
    ).toEqual({ kind: 'invalid' });
    expect(await devicesOf(store)).toHaveLength(1);
  });

  it('004 US2-2 refuses the temporary password once it was replaced, and stores nothing', async () => {
    const { store, deps } = await setup();
    await store.run(async ({ accounts }) => {
      const account = await accounts.get('acc-1');
      if (account === null) throw new Error('missing');
      await accounts.update({
        ...account,
        temporaryPasswordHash: await hasher.hash('ZZZZZZZZZZZZZZZZ'),
      });
    });

    expect(await choosePassword(deps, request())).toEqual({ kind: 'invalid' });
    expect((await accountOf(store))?.passwordHash).toBeNull();
  });

  it('004 US2-5 tells an expired temporary password to whoever typed it, and stores nothing', async () => {
    const { store, clock, deps } = await setup();
    clock.ms = Date.parse('2026-10-19T10:00:00.000Z');

    expect(await choosePassword(deps, request())).toEqual({ kind: 'expired' });
    expect((await accountOf(store))?.passwordHash).toBeNull();
  });

  it('004 FR-013 refuses a suspended account', async () => {
    const { deps } = await setup({ suspendedAt: '2026-10-10T10:00:00.000Z' });

    expect(await choosePassword(deps, request())).toEqual({
      kind: 'suspended',
    });
  });

  it('004 US2-4 treats a wrong temporary password and an unknown address alike, and counts them', async () => {
    const { deps } = await setup();

    expect(
      await choosePassword(deps, request({ temporaryPassword: 'WRONG' })),
    ).toEqual({ kind: 'invalid' });
    expect(
      await choosePassword(deps, request({ email: 'nobody@example.org' })),
    ).toEqual({ kind: 'invalid' });
    for (let i = 0; i < 4; i++) {
      await choosePassword(deps, request({ temporaryPassword: 'WRONG' }));
    }
    expect(await choosePassword(deps, request())).toMatchObject({
      kind: 'blocked',
    });
  });

  it('004 US2-2 refuses a replay of the same request', async () => {
    const { deps } = await setup();
    await choosePassword(deps, request());

    expect(await choosePassword(deps, request())).toEqual({ kind: 'invalid' });
  });

  it('004 US2-3 refuses an invalid address or device name', async () => {
    const { deps } = await setup();

    expect(await choosePassword(deps, request({ email: 'nope' }))).toEqual({
      kind: 'invalidEmail',
    });
    expect(await choosePassword(deps, request({ deviceName: ' ' }))).toEqual({
      kind: 'invalidDeviceName',
    });
  });
});
