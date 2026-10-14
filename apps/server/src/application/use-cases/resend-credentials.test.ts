import type { Clock } from '../ports/clock';
import type { ErrorContext } from '../ports/error-reporter';
import { account } from '../testing/contracts/entities';
import { createFakeMailer } from '../testing/fake-mailer';
import { createFakePairingCrypto } from '../testing/fake-pairing-crypto';
import { createFakePasswordHasher } from '../testing/fake-password-hasher';
import { InMemoryStore } from '../testing/in-memory-store';
import { resendCredentials } from './resend-credentials';

class FakeClock implements Clock {
  ms = Date.parse('2026-10-12T10:00:00.000Z');
  nowMs() {
    return this.ms;
  }
}

const setup = async () => {
  const store = new InMemoryStore();
  const mailer = createFakeMailer();
  const hasher = createFakePasswordHasher();
  const reports: Array<{ error: unknown; context: ErrorContext }> = [];
  await store.run(async ({ accounts }) => {
    await accounts.add(
      account('inv', 'i@example.org', {
        temporaryPasswordHash: await hasher.hash('OLDOLDOLDOLD0000'),
        temporaryExpiresAt: '2026-10-14T10:00:00.000Z',
      }),
    );
    await accounts.add(account('act', 'a@example.org', { passwordHash: 'h' }));
    await accounts.add(
      account('sus', 's@example.org', {
        suspendedAt: '2026-10-11T10:00:00.000Z',
        temporaryPasswordHash: 'x',
        temporaryExpiresAt: '2026-10-14T10:00:00.000Z',
      }),
    );
  });
  const deps = {
    store,
    clock: new FakeClock(),
    crypto: createFakePairingCrypto(),
    hasher,
    ids: { next: () => 'unused' },
    mailer,
    publicUrl: 'https://courses.test',
    errorReporter: {
      report: (error: unknown, context: ErrorContext) =>
        void reports.push({ error, context }),
    },
  };
  return { store, mailer, hasher, reports, deps };
};

const get = (store: InMemoryStore, id: string) =>
  store.run(({ accounts }) => accounts.get(id));

describe('resendCredentials', () => {
  it('004 US5-6 replaces the temporary password so the previous one stops working, and emails the new one', async () => {
    const { store, mailer, hasher, deps } = await setup();

    expect(await resendCredentials(deps, 'inv')).toEqual({ kind: 'sent' });

    const record = await get(store, 'inv');
    expect(record?.temporaryExpiresAt).toBe('2026-10-19T10:00:00.000Z');
    expect(
      await hasher.verify(
        'OLDOLDOLDOLD0000',
        record?.temporaryPasswordHash ?? null,
      ),
    ).toBe(false);
    expect(
      await hasher.verify(
        'TEMP0000ABCDWXYZ',
        record?.temporaryPasswordHash ?? null,
      ),
    ).toBe(true);
    expect(mailer.sent).toEqual([
      {
        kind: 'invitation',
        to: 'i@example.org',
        temporaryPassword: 'TEMP-0000-ABCD-WXYZ',
        expiresAt: '2026-10-19T10:00:00.000Z',
        serverUrl: 'https://courses.test',
      },
    ]);
  });

  it('004 US5-6 works for an invitation that expired', async () => {
    const { deps, mailer } = await setup();
    deps.clock.ms = Date.parse('2026-10-20T10:00:00.000Z');

    expect(await resendCredentials(deps, 'inv')).toEqual({ kind: 'sent' });
    expect(mailer.sent).toHaveLength(1);
  });

  it('004 US5-6 restores the previous temporary password when the email fails, and reports without the address', async () => {
    const { store, mailer, hasher, reports, deps } = await setup();
    const before = await get(store, 'inv');
    mailer.failing = true;

    expect(await resendCredentials(deps, 'inv')).toEqual({
      kind: 'mailFailed',
    });

    const after = await get(store, 'inv');
    expect(after).toEqual(before);
    expect(
      await hasher.verify(
        'OLDOLDOLDOLD0000',
        after?.temporaryPasswordHash ?? null,
      ),
    ).toBe(true);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.context).toEqual({
      operation: 'resendCredentials',
      route: 'POST /v1/admin/accounts/:id/resend-credentials',
      accountId: 'inv',
    });
    expect(JSON.stringify(reports)).not.toContain('example.org');
  });

  it('refuses an account that already chose a password', async () => {
    const { store, mailer, deps } = await setup();
    const before = await get(store, 'act');

    expect(await resendCredentials(deps, 'act')).toEqual({
      kind: 'notInvited',
    });
    expect(await get(store, 'act')).toEqual(before);
    expect(mailer.sent).toEqual([]);
  });

  it('004 US5-6 refuses a suspended account that never signed in', async () => {
    const { mailer, deps } = await setup();

    expect(await resendCredentials(deps, 'sus')).toEqual({
      kind: 'notInvited',
    });
    expect(mailer.sent).toEqual([]);
  });

  it('answers notFound for an unknown id', async () => {
    const { deps } = await setup();
    expect(await resendCredentials(deps, 'nobody')).toEqual({
      kind: 'notFound',
    });
  });
});
