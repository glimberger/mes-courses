import type { AccountRecord } from '../../domain/account';
import type { Clock } from '../ports/clock';
import type { PasswordHasher } from '../ports/password-hasher';
import type { ServerStore } from '../ports/store';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { InMemoryStore } from '../testing/in-memory-store';
import { changePassword } from './change-password';
import { choosePassword } from './choose-password';
import { deleteOwnAccount } from './delete-own-account';
import { signIn } from './sign-in';

const fake = createFakePasswordHasher();
const CURRENT = 'correct horse battery';
const NEXT = 'another long password';
const TEMP = 'ABCD-EFGH-JKMN-PQRS';

const clock: Clock = { nowMs: () => Date.parse('2026-10-12T10:00:00.000Z') };

/** A store that counts the transactions open, and a hasher that notes how many were when it ran. */
const instrumented = async (overrides: Partial<AccountRecord> = {}) => {
  const inner = new InMemoryStore();
  let open = 0;
  const store = Object.assign(Object.create(inner), {
    run: <T>(work: Parameters<ServerStore['run']>[0]) => {
      open++;
      return (inner.run(work) as Promise<T>).finally(() => open--);
    },
  }) as ServerStore;
  const openDuringHashing: number[] = [];
  let beforeVerify: (() => Promise<void>) | null = null;
  const hasher: PasswordHasher = {
    hash: async (password) => {
      openDuringHashing.push(open);
      return fake.hash(password);
    },
    verify: async (password, stored) => {
      openDuringHashing.push(open);
      await beforeVerify?.();
      return fake.verify(password, stored);
    },
  };
  await inner.run(async ({ accounts }) =>
    accounts.add({
      id: 'acc-1',
      email: 'marie@example.org',
      role: 'user',
      passwordHash: await fake.hash(CURRENT),
      temporaryPasswordHash: await fake.hash('ABCDEFGHJKMNPQRS'),
      temporaryExpiresAt: '2026-10-19T10:00:00.000Z',
      suspendedAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      ...overrides,
    }),
  );
  let n = 0;
  return {
    inner,
    openDuringHashing,
    onVerify: (hook: () => Promise<void>) => {
      beforeVerify = hook;
    },
    deps: {
      store,
      clock,
      crypto: createFakePairingCrypto(),
      hasher,
      ids: { next: () => `id-${++n}` },
    },
  };
};

const signInRequest = (password: string) => ({
  email: 'marie@example.org',
  password,
  deviceName: 'Pixel 8',
  clientAddress: '10.0.0.1',
});

describe('hashing stays outside the store transaction', () => {
  it('004 review: signIn hashes with no transaction open', async () => {
    const { deps, openDuringHashing } = await instrumented();

    await signIn(deps, signInRequest(CURRENT));

    expect(openDuringHashing.length).toBeGreaterThan(0);
    expect(openDuringHashing.every((open) => open === 0)).toBe(true);
  });

  it('004 review: choosePassword hashes with no transaction open', async () => {
    const { deps, openDuringHashing } = await instrumented();

    const outcome = await choosePassword(deps, {
      email: 'marie@example.org',
      temporaryPassword: TEMP,
      newPassword: NEXT,
      deviceName: 'Pixel 8',
      clientAddress: '10.0.0.1',
    });

    expect(outcome.kind).toBe('signedIn');
    expect(openDuringHashing.length).toBeGreaterThan(1);
    expect(openDuringHashing.every((open) => open === 0)).toBe(true);
  });

  it('004 review: changePassword and deleteOwnAccount hash with no transaction open', async () => {
    const changed = await instrumented();
    expect(
      await changePassword(changed.deps, {
        accountId: 'acc-1',
        currentPassword: CURRENT,
        newPassword: NEXT,
        clientAddress: '10.0.0.1',
      }),
    ).toEqual({ kind: 'changed' });
    expect(changed.openDuringHashing.length).toBeGreaterThan(1);
    expect(changed.openDuringHashing.every((open) => open === 0)).toBe(true);

    const deleted = await instrumented();
    expect(
      await deleteOwnAccount(deleted.deps, {
        accountId: 'acc-1',
        password: CURRENT,
        clientAddress: '10.0.0.1',
      }),
    ).toMatchObject({
      kind: expect.stringMatching(/deleted|lastAdministrator/),
    });
    expect(deleted.openDuringHashing.every((open) => open === 0)).toBe(true);
  });

  it('004 review: a password changed while signIn was hashing is not accepted', async () => {
    const { deps, inner, onVerify } = await instrumented();
    let changedOnce = false;
    onVerify(async () => {
      if (changedOnce) return;
      changedOnce = true;
      await inner.run(async ({ accounts }) => {
        const account = await accounts.get('acc-1');
        if (account === null) throw new Error('missing account');
        await accounts.update({
          ...account,
          passwordHash: await fake.hash('a brand new password'),
        });
      });
    });

    const outcome = await signIn(deps, signInRequest(CURRENT));

    expect(outcome).toEqual({ kind: 'invalid' });
    const devices = await inner.run(({ devices }) =>
      devices.forAccount('acc-1'),
    );
    expect(devices).toEqual([]);
  });

  it('004 review: an account deleted while changePassword was hashing changes nothing', async () => {
    const { deps, inner, onVerify } = await instrumented();
    onVerify(async () => {
      await inner.run(({ accounts }) => accounts.delete('acc-1'));
    });

    const outcome = await changePassword(deps, {
      accountId: 'acc-1',
      currentPassword: CURRENT,
      newPassword: NEXT,
      clientAddress: '10.0.0.1',
    });

    expect(outcome).toEqual({ kind: 'invalid' });
  });
});
