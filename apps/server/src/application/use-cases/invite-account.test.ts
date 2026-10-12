import type { Clock } from '../ports/clock';
import type { ErrorContext } from '../ports/error-reporter';
import { createFakeMailer } from '../testing/fake-mailer';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { account } from '../testing/contracts/entities';
import { InMemoryStore } from '../testing/in-memory-store';
import { inviteAccount } from './invite-account';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const setup = () => {
  const store = new InMemoryStore();
  const mailer = createFakeMailer();
  const reports: Array<{ error: unknown; context: ErrorContext }> = [];
  let n = 0;
  const deps = {
    store,
    clock: new FakeClock(),
    crypto: createFakePairingCrypto(),
    hasher: createFakePasswordHasher(),
    ids: { next: () => `acc-new-${++n}` },
    mailer,
    publicUrl: 'https://courses.test',
    errorReporter: {
      report: (error: unknown, context: ErrorContext) =>
        void reports.push({ error, context }),
    },
  };
  return { store, mailer, reports, deps };
};

const accountsOf = (store: InMemoryStore) =>
  store.run(({ accounts }) => accounts.all());

describe('inviteAccount', () => {
  it('004 US1-1 creates an invited user account and emails the address and a temporary password', async () => {
    const { store, mailer, deps } = setup();

    const outcome = await inviteAccount(deps, 'Marie@Example.org ');

    expect(outcome).toEqual({
      kind: 'invited',
      account: {
        id: 'acc-new-1',
        email: 'marie@example.org',
        role: 'user',
        state: 'invited',
        lastSyncAt: null,
        invitationExpired: false,
      },
    });
    const [stored] = await accountsOf(store);
    expect(stored).toMatchObject({
      id: 'acc-new-1',
      email: 'marie@example.org',
      role: 'user',
      passwordHash: null,
      temporaryExpiresAt: '2026-10-19T10:00:00.000Z',
      suspendedAt: null,
      createdAt: '2026-10-12T10:00:00.000Z',
    });
    expect(mailer.sent).toEqual([
      {
        kind: 'invitation',
        to: 'marie@example.org',
        temporaryPassword: 'TEMP-0000-ABCD-WXYZ',
        expiresAt: '2026-10-19T10:00:00.000Z',
        serverUrl: 'https://courses.test',
      },
    ]);
  });

  it('004 US1-1 stores only a hash of the temporary password, never the password', async () => {
    const { store, deps } = setup();

    await inviteAccount(deps, 'marie@example.org');

    const [stored] = await accountsOf(store);
    expect(stored?.temporaryPasswordHash).not.toBeNull();
    expect(stored?.temporaryPasswordHash).not.toContain('TEMP');
    expect(
      await deps.hasher.verify(
        'TEMP0000ABCDWXYZ',
        stored?.temporaryPasswordHash ?? null,
      ),
    ).toBe(true);
  });

  it('004 US1-2 refuses an address that already has an account: nothing created, nothing sent', async () => {
    const { store, mailer, deps } = setup();
    await store.run(({ accounts }) =>
      accounts.add(account('a-1', 'marie@example.org')),
    );

    expect(await inviteAccount(deps, 'marie@example.org')).toEqual({
      kind: 'exists',
    });

    expect(await accountsOf(store)).toHaveLength(1);
    expect(mailer.sent).toEqual([]);
  });

  it('004 US1-2 counts capitals and spaces as the existing address', async () => {
    const { store, mailer, deps } = setup();
    await store.run(({ accounts }) =>
      accounts.add(account('a-1', 'marie@example.org')),
    );

    expect(await inviteAccount(deps, '  MARIE@example.ORG')).toEqual({
      kind: 'exists',
    });
    expect(mailer.sent).toEqual([]);
  });

  it('004 US1-3 refuses an address that is not valid: nothing created, nothing sent', async () => {
    const { store, mailer, deps } = setup();

    expect(await inviteAccount(deps, 'not an address')).toEqual({
      kind: 'invalidEmail',
    });

    expect(await accountsOf(store)).toEqual([]);
    expect(mailer.sent).toEqual([]);
  });

  it('004 US1-4 deletes the account again when the email cannot be sent, and leaves nothing behind', async () => {
    const { store, mailer, deps } = setup();
    mailer.failing = true;

    expect(await inviteAccount(deps, 'marie@example.org')).toEqual({
      kind: 'mailFailed',
    });

    expect(await accountsOf(store)).toEqual([]);
    mailer.failing = false;
    expect((await inviteAccount(deps, 'marie@example.org')).kind).toBe(
      'invited',
    );
  });

  it('004 US1-4 reports the mail failure without the address', async () => {
    const { mailer, reports, deps } = setup();
    mailer.failing = true;

    await inviteAccount(deps, 'marie@example.org');

    expect(reports).toHaveLength(1);
    expect(reports[0]?.context.operation).toBe('inviteAccount');
    expect(JSON.stringify(reports)).not.toContain('marie@example.org');
  });

  it('004 an address whose account was deleted earlier creates a new empty account', async () => {
    const { store, deps } = setup();
    await inviteAccount(deps, 'marie@example.org');
    await store.run(({ accounts }) => accounts.delete('acc-new-1'));

    const outcome = await inviteAccount(deps, 'marie@example.org');

    expect(outcome.kind).toBe('invited');
    expect(await accountsOf(store)).toHaveLength(1);
    expect((await accountsOf(store))[0]?.id).toBe('acc-new-2');
  });
});
