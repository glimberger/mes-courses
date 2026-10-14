import { account } from '../application/testing/contracts/entities';
import { createFakePasswordHasher } from '../application/testing/fake-password-hasher';
import { InMemoryStore } from '../application/testing/in-memory-store';
import { accountState } from '../domain/account';
import type { PasswordPrompt } from './admin-prompt';
import { setPassword } from './set-password';

const hasher = createFakePasswordHasher();
const answers = (...entries: string[]): PasswordPrompt => {
  const queue = [...entries];
  return { ask: async () => queue.shift() ?? '' };
};
const GOOD = 'a brand new password';

const setup = async () => {
  const store = new InMemoryStore();
  await store.run(async ({ accounts, devices }) => {
    await accounts.add(account('setup', null, { role: 'administrator' }));
    await accounts.add(
      account('u-1', 'marie@example.org', {
        passwordHash: await hasher.hash('the old password'),
        temporaryPasswordHash: 'temp',
        temporaryExpiresAt: '2026-10-19T10:00:00.000Z',
      }),
    );
    await accounts.add(
      account('u-2', 'paul@example.org', {
        suspendedAt: '2026-10-02T10:00:00.000Z',
        passwordHash: await hasher.hash('his old password'),
      }),
    );
    await accounts.add(account('u-3', 'invited@example.org'));
    await devices.add({
      id: 'd-1',
      accountId: 'u-1',
      name: 'Tel',
      credentialHash: 'h-1',
      createdAt: '2026-10-01T10:00:00.000Z',
      lastSyncAt: null,
      revokedAt: null,
    });
  });
  return store;
};

describe('setPassword', () => {
  it('004 R17 sets the hash, clears the temporary password and leaves state, role and devices alone', async () => {
    const store = await setup();

    const line = await setPassword(
      { store, hasher, prompt: answers(GOOD, GOOD) },
      'Marie@Example.org',
    );

    const done = await store.run(({ accounts }) => accounts.get('u-1'));
    expect(done).toMatchObject({
      role: 'user',
      passwordHash: await hasher.hash(GOOD),
      temporaryPasswordHash: null,
      temporaryExpiresAt: null,
      suspendedAt: null,
    });
    expect(
      await store.run(({ devices }) => devices.forAccount('u-1')),
    ).toHaveLength(1);
    expect(line).not.toContain(GOOD);
  });

  it('004 R17 the old password no longer verifies and the new one does', async () => {
    const store = await setup();
    await setPassword(
      { store, hasher, prompt: answers(GOOD, GOOD) },
      'marie@example.org',
    );

    const done = await store.run(({ accounts }) => accounts.get('u-1'));
    expect(
      await hasher.verify('the old password', done?.passwordHash ?? null),
    ).toBe(false);
    expect(await hasher.verify(GOOD, done?.passwordHash ?? null)).toBe(true);
  });

  it('004 R17 a suspended account stays suspended', async () => {
    const store = await setup();

    await setPassword(
      { store, hasher, prompt: answers(GOOD, GOOD) },
      'paul@example.org',
    );

    const done = await store.run(({ accounts }) => accounts.get('u-2'));
    expect(done && accountState(done)).toBe('suspended');
    expect(done?.suspendedAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('004 R17 an invited account keeps what its data says: it has a password now, so it is derived active', async () => {
    const store = await setup();

    await setPassword(
      { store, hasher, prompt: answers(GOOD, GOOD) },
      'invited@example.org',
    );

    const done = await store.run(({ accounts }) => accounts.get('u-3'));
    expect(done && accountState(done)).toBe('active');
  });

  it.each([
    ['an unknown address', 'nobody@example.org', [GOOD, GOOD], 'no account'],
    ['an invalid address', 'nope', [GOOD, GOOD], 'invalid email'],
    [
      'a short password',
      'marie@example.org',
      ['short', 'short'],
      'at least 12',
    ],
    [
      'two different entries',
      'marie@example.org',
      [GOOD, `${GOOD}x`],
      'differ',
    ],
  ])(
    '004 R17 refuses %s and changes nothing',
    async (_label, email, entries, message) => {
      const store = await setup();
      const before = await store.run(({ accounts }) => accounts.all());

      await expect(
        setPassword({ store, hasher, prompt: answers(...entries) }, email),
      ).rejects.toThrow(message);

      expect(await store.run(({ accounts }) => accounts.all())).toEqual(before);
    },
  );

  it('004 R17 never reaches the setup account while it has no address', async () => {
    const store = await setup();

    await expect(
      setPassword({ store, hasher, prompt: answers(GOOD, GOOD) }, 'setup'),
    ).rejects.toThrow('invalid email');
    expect(
      (await store.run(({ accounts }) => accounts.get('setup')))?.passwordHash,
    ).toBeNull();
  });
});
