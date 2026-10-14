import type { AccountRecord } from '../../domain/account';
import type { Clock } from '../ports/clock';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { InMemoryStore } from '../testing/in-memory-store';
import { signIn, type SignInDeps } from './sign-in';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const hasher = createFakePasswordHasher();
const TEMP = 'ABCD-EFGH-JKMN-PQRS';
const PASSWORD = 'correct horse battery';

const base = {
  id: 'acc-1',
  email: 'marie@example.org',
  role: 'user',
  passwordHash: null,
  temporaryPasswordHash: null,
  temporaryExpiresAt: null,
  suspendedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
} satisfies AccountRecord;

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
  await store.run(({ accounts }) => accounts.add({ ...base, ...overrides }));
  return { store, clock, deps };
};

const invited = async () =>
  setup({
    temporaryPasswordHash: await hasher.hash('ABCDEFGHJKMNPQRS'),
    temporaryExpiresAt: '2026-10-19T10:00:00.000Z',
  });

const active = async (overrides: Partial<AccountRecord> = {}) =>
  setup({ passwordHash: await hasher.hash(PASSWORD), ...overrides });

const request = (password: string, clientAddress = '10.0.0.1') => ({
  email: ' Marie@Example.org ',
  password,
  deviceName: ' Pixel 8 ',
  clientAddress,
});

const devicesOf = (store: InMemoryStore) =>
  store.run(({ devices }) => devices.forAccount('acc-1'));

describe('signIn', () => {
  it('004 US2-1 signs in with the current password and creates a named device', async () => {
    const { store, deps } = await active();

    const outcome = await signIn(deps, request(PASSWORD));

    expect(outcome).toEqual({
      kind: 'signedIn',
      deviceId: 'id-1',
      credential: 'credential-0',
      account: { id: 'acc-1', email: 'marie@example.org', role: 'user' },
    });
    const [device] = await devicesOf(store);
    expect(device).toMatchObject({
      id: 'id-1',
      accountId: 'acc-1',
      name: 'Pixel 8',
      credentialHash: deps.crypto.sha256Hex('credential-0'),
      revokedAt: null,
    });
  });

  it('004 US2-1 asks for a new password when the temporary one matches, in any case and with dashes, and creates no device', async () => {
    const { store, deps } = await invited();

    expect(await signIn(deps, request(TEMP))).toEqual({
      kind: 'passwordChangeRequired',
    });
    expect(await signIn(deps, request('abcd efgh jkmn pqrs'))).toEqual({
      kind: 'passwordChangeRequired',
    });
    expect(await devicesOf(store)).toEqual([]);
  });

  it('004 US2-4 answers an unknown address and a wrong password alike', async () => {
    const { deps } = await active();

    const wrong = await signIn(deps, request('not the password'));
    const unknown = await signIn(deps, {
      ...request(PASSWORD),
      email: 'nobody@example.org',
    });

    expect(wrong).toEqual({ kind: 'invalid' });
    expect(unknown).toEqual(wrong);
  });

  it('004 US2-4 refuses an invalid address or device name before anything else', async () => {
    const { deps } = await active();

    expect(await signIn(deps, { ...request(PASSWORD), email: 'nope' })).toEqual(
      { kind: 'invalidEmail' },
    );
    expect(
      await signIn(deps, { ...request(PASSWORD), deviceName: '   ' }),
    ).toEqual({ kind: 'invalidDeviceName' });
  });

  it('004 US2-5 tells an expired temporary password only to whoever typed it', async () => {
    const { clock, deps } = await invited();
    clock.ms = Date.parse('2026-10-19T10:00:00.000Z');

    expect(await signIn(deps, request(TEMP))).toEqual({ kind: 'expired' });
    expect(await signIn(deps, request('something else'))).toEqual({
      kind: 'invalid',
    });
  });

  it('004 US2-1 lets the current password work while a temporary one is outstanding', async () => {
    const { deps } = await active({
      temporaryPasswordHash: await hasher.hash('ABCDEFGHJKMNPQRS'),
      temporaryExpiresAt: '2026-10-19T10:00:00.000Z',
    });

    expect(await signIn(deps, request(PASSWORD))).toMatchObject({
      kind: 'signedIn',
    });
    expect(await signIn(deps, request(TEMP))).toEqual({
      kind: 'passwordChangeRequired',
    });
  });

  it('004 FR-013 refuses a suspended account only when the password was right', async () => {
    const { deps } = await active({ suspendedAt: '2026-10-10T10:00:00.000Z' });

    expect(await signIn(deps, request(PASSWORD))).toEqual({
      kind: 'suspended',
    });
    expect(await signIn(deps, request('wrong'))).toEqual({ kind: 'invalid' });
  });

  it('004 FR-006 blocks the sixth failure for an address in 10 minutes, even with the right password', async () => {
    const { store, clock, deps } = await active();

    for (let i = 0; i < 5; i++) {
      expect(await signIn(deps, request('wrong', `10.0.0.${i}`))).toEqual({
        kind: 'invalid',
      });
    }
    clock.ms += 60_000;
    const blocked = await signIn(deps, request(PASSWORD, '10.0.0.9'));

    expect(blocked).toEqual({ kind: 'blocked', retryAfterSeconds: 540 });
    expect(await devicesOf(store)).toEqual([]);
  });

  it('004 FR-006 lets the window slide', async () => {
    const { clock, deps } = await active();
    for (let i = 0; i < 5; i++) await signIn(deps, request('wrong'));

    clock.ms += 10 * 60_000;

    expect(await signIn(deps, request(PASSWORD))).toMatchObject({
      kind: 'signedIn',
    });
  });

  it('004 FR-006 blocks a client after 20 failures in 10 minutes, whatever the address', async () => {
    const { clock, deps } = await active();
    for (let i = 0; i < 20; i++) {
      await signIn(deps, {
        ...request('wrong'),
        email: `user${i}@example.org`,
      });
    }
    clock.ms += 1000;

    expect(await signIn(deps, request(PASSWORD))).toMatchObject({
      kind: 'blocked',
    });
    expect(await signIn(deps, request(PASSWORD, '10.0.0.2'))).toMatchObject({
      kind: 'signedIn',
    });
  });

  it('004 FR-006 stores only hashes of the address and of the client', async () => {
    const { store, deps } = await active();
    await signIn(deps, request('wrong'));

    const key = deps.crypto.sha256Hex('marie@example.org');
    const count = await store.run(({ authAttempts }) =>
      authAttempts.countSince('signIn', key, '2000-01-01T00:00:00.000Z'),
    );
    expect(count).toBe(1);
  });

  it('004 FR-006 forgets attempts older than 60 minutes at the next request', async () => {
    const { store, clock, deps } = await active();
    await signIn(deps, request('wrong'));
    clock.ms += 61 * 60_000;

    await signIn(deps, request(PASSWORD));

    const key = deps.crypto.sha256Hex('marie@example.org');
    expect(
      await store.run(({ authAttempts }) =>
        authAttempts.countSince('signIn', key, '2000-01-01T00:00:00.000Z'),
      ),
    ).toBe(0);
  });

  it('004 FR-002 never signs in the setup account, which has no address and no password', async () => {
    const { store, deps } = await setup({ email: null, role: 'administrator' });

    for (const password of ['', 'anything', TEMP]) {
      expect(await signIn(deps, request(password))).toEqual({
        kind: 'invalid',
      });
    }
    expect(await devicesOf(store)).toEqual([]);
  });
});
