import { normalizeTemporaryPassword } from '@mes-courses/sync-core';

import type { AccountRecord } from '../../domain/account';
import type { Clock } from '../ports/clock';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { InMemoryStore } from '../testing/in-memory-store';
import { requestPasswordReset } from './request-password-reset';
import { signIn, type SignInDeps } from './sign-in';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const hasher = createFakePasswordHasher();
const CURRENT = 'a long enough password';

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
      passwordHash: await hasher.hash(CURRENT),
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
      suspendedAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      ...overrides,
    }),
  );
  return { store, clock, deps };
};

const ask = (
  deps: SignInDeps,
  email = 'Marie@example.org',
  clientAddress = '10.0.0.1',
) => requestPasswordReset(deps, { email, clientAddress });

const accountOf = (store: InMemoryStore) =>
  store.run(({ accounts }) => accounts.get('acc-1'));

const signInWith = (deps: SignInDeps, password: string) =>
  signIn(deps, {
    email: 'marie@example.org',
    password,
    deviceName: 'Pixel 8',
    clientAddress: '10.0.0.9',
  });

describe('requestPasswordReset', () => {
  it('004 US4-1 stores a hashed temporary password for 7 days and returns the message to send', async () => {
    const { store, deps } = await setup();

    const outcome = await ask(deps);

    expect(outcome).toMatchObject({
      kind: 'accepted',
      message: {
        kind: 'newTemporaryPassword',
        to: 'marie@example.org',
        expiresAt: '2026-10-19T10:00:00.000Z',
      },
    });
    if (outcome.kind !== 'accepted' || outcome.message === null) {
      throw new Error('expected a message');
    }
    const account = await accountOf(store);
    expect(account?.temporaryExpiresAt).toBe('2026-10-19T10:00:00.000Z');
    expect(account?.temporaryPasswordHash).toBe(
      await hasher.hash(
        normalizeTemporaryPassword(outcome.message.temporaryPassword),
      ),
    );
    expect(account?.temporaryPasswordHash).not.toContain(
      outcome.message.temporaryPassword,
    );
  });

  it('004 US4-2 keeps the current password working, and the temporary one asks for a new password', async () => {
    const { store, deps } = await setup();
    const before = (await accountOf(store))?.passwordHash;
    const outcome = await ask(deps);
    if (outcome.kind !== 'accepted' || outcome.message === null) {
      throw new Error('expected a message');
    }

    expect((await accountOf(store))?.passwordHash).toBe(before);
    expect(await signInWith(deps, CURRENT)).toMatchObject({
      kind: 'signedIn',
    });
    expect(await signInWith(deps, outcome.message.temporaryPassword)).toEqual({
      kind: 'passwordChangeRequired',
    });
  });

  it('004 US4-3 answers an unknown address like a known one, stores nothing and sends nothing', async () => {
    const { store, deps } = await setup();

    const unknown = await ask(deps, 'nobody@example.org');

    expect(unknown).toEqual({ kind: 'accepted', message: null });
    expect((await accountOf(store))?.temporaryPasswordHash).toBeNull();
  });

  it('004 US4-4 refuses the 4th request in an hour with the seconds to wait, known address or not', async () => {
    const { deps, clock } = await setup();
    for (let i = 0; i < 3; i++) await ask(deps);

    clock.ms += 10 * 60 * 1000;
    expect(await ask(deps)).toEqual({
      kind: 'blocked',
      retryAfterSeconds: 50 * 60,
    });
    // Unknown addresses are limited the same way.
    for (let i = 0; i < 3; i++) await ask(deps, 'nobody@example.org');
    expect(await ask(deps, 'nobody@example.org')).toMatchObject({
      kind: 'blocked',
    });
  });

  it('004 US4-4 refuses a blocked request before it pays for a hash', async () => {
    const { deps } = await setup();
    for (let i = 0; i < 3; i++) await ask(deps);
    const hash = jest.spyOn(deps.hasher, 'hash');

    expect(await ask(deps)).toMatchObject({ kind: 'blocked' });

    expect(hash).not.toHaveBeenCalled();
  });

  it('004 US4-4 limits a client to 10 requests an hour across addresses', async () => {
    const { deps } = await setup();
    for (let i = 0; i < 10; i++) await ask(deps, `user${i}@example.org`);

    expect(await ask(deps, 'another@example.org')).toMatchObject({
      kind: 'blocked',
    });
  });

  it('004 US4-4 lets requests through again once the window has passed', async () => {
    const { deps, clock } = await setup();
    for (let i = 0; i < 3; i++) await ask(deps);

    clock.ms += 60 * 60 * 1000;

    expect(await ask(deps)).toMatchObject({ kind: 'accepted' });
  });

  it('004 US4-5 lets the owner keep signing in, and the unused temporary password expires after 7 days', async () => {
    const { deps, clock } = await setup();
    const outcome = await ask(deps);
    if (outcome.kind !== 'accepted' || outcome.message === null) {
      throw new Error('expected a message');
    }

    expect(await signInWith(deps, CURRENT)).toMatchObject({
      kind: 'signedIn',
    });
    clock.ms += 7 * 24 * 60 * 60 * 1000;
    expect(await signInWith(deps, outcome.message.temporaryPassword)).toEqual({
      kind: 'expired',
    });
    expect(await signInWith(deps, CURRENT)).toMatchObject({
      kind: 'signedIn',
    });
  });

  it('004 US4-1 replaces the temporary password of an invited account, so the invitation one stops working', async () => {
    const { deps } = await setup({
      passwordHash: null,
      temporaryPasswordHash: await hasher.hash('ABCDEFGHJKMNPQRS'),
      temporaryExpiresAt: '2026-10-14T10:00:00.000Z',
    });

    const outcome = await ask(deps);
    if (outcome.kind !== 'accepted' || outcome.message === null) {
      throw new Error('expected a message');
    }

    expect(await signInWith(deps, 'ABCD-EFGH-JKMN-PQRS')).toEqual({
      kind: 'invalid',
    });
    expect(await signInWith(deps, outcome.message.temporaryPassword)).toEqual({
      kind: 'passwordChangeRequired',
    });
  });

  it('004 US4-6 stores and sends nothing for a suspended account, and answers the same', async () => {
    const { store, deps } = await setup({
      suspendedAt: '2026-10-10T10:00:00.000Z',
    });

    expect(await ask(deps)).toEqual({ kind: 'accepted', message: null });
    expect((await accountOf(store))?.temporaryPasswordHash).toBeNull();
  });

  it('004 US4-3 refuses a malformed address without counting it', async () => {
    const { deps } = await setup();

    expect(await ask(deps, 'not an address')).toEqual({
      kind: 'invalidEmail',
    });
    for (let i = 0; i < 3; i++) {
      expect(await ask(deps)).toMatchObject({ kind: 'accepted' });
    }
  });
});
