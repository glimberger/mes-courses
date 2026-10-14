import { FakeClock, buildTestAppStack } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

import { EMAIL, PASSWORD, signInDevice } from './testing/onboard';

const START = Date.parse('2026-10-12T10:00:00.000Z');
const ADMIN_EMAIL = 'admin@example.org';

describe('administration scenarios (004 US5)', () => {
  let server: TestServer;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
  });
  afterEach(async () => {
    await server.close();
  });

  const newDevice = () => buildTestAppStack({ serverUrl: server.url, clock });
  const cycle = async (stack: Awaited<ReturnType<typeof newDevice>>) => {
    clock.advance(1_000);
    return (await stack.useCases.synchronize()).outcome;
  };

  /** An administrator's phone, signed in, and the id of the account `EMAIL`. */
  const setup = async () => {
    await server.createAccount({ role: 'administrator', email: ADMIN_EMAIL });
    const adminPhone = await newDevice();
    const signedIn = await adminPhone.useCases.signIn(
      server.url,
      ADMIN_EMAIL,
      PASSWORD,
      'Admin',
    );
    expect(signedIn.ok).toBe(true);
    const phone = await newDevice();
    expect((await signInDevice(server, phone, 'Pixel')).ok).toBe(true);
    const accounts = await adminPhone.useCases.listAccounts();
    if (!accounts.ok) throw new Error('no accounts');
    const idOf = (email: string) => {
      const found = accounts.value.find((account) => account.email === email);
      if (!found) throw new Error(`no account ${email}`);
      return found.id;
    };
    return {
      adminPhone,
      phone,
      userId: idOf(EMAIL),
      adminId: idOf(ADMIN_EMAIL),
    };
  };

  const addList = async (phone: Awaited<ReturnType<typeof newDevice>>) => {
    clock.advance(1_000);
    const created = await phone.useCases.createList('Courses du samedi');
    if (!created.ok) throw new Error('no list');
  };
  const pending = (phone: Awaited<ReturnType<typeof newDevice>>) =>
    phone.unitOfWork.run((repos) => repos.changes.count());

  it('004 US5-2/3 SC-004 suspends: the device is refused, keeps its copy and queues edits; reactivated, it syncs with nothing lost', async () => {
    const { adminPhone, phone, userId } = await setup();
    expect(await cycle(phone)).toEqual({ type: 'saved' });

    expect((await adminPhone.useCases.suspendAccount(userId)).ok).toBe(true);
    await addList(phone);
    expect(await cycle(phone)).toEqual({ type: 'suspended' });
    expect(await pending(phone)).toBeGreaterThan(0);
    expect(
      (await phone.useCases.getCurrentList()).list.name.length,
    ).toBeGreaterThan(0);

    expect((await adminPhone.useCases.reactivateAccount(userId)).ok).toBe(true);
    expect(await cycle(phone)).toEqual({ type: 'saved' });
    expect(await pending(phone)).toBe(0);
    expect((await phone.useCases.getSyncInfo()).connection).toBe('connected');
  });

  it('004 US5-4 deletes: the device is signedOut(accountDeleted), then acknowledging erases its data', async () => {
    const { adminPhone, phone, userId } = await setup();
    await addList(phone);
    await cycle(phone);

    expect((await adminPhone.useCases.deleteAccountAsAdmin(userId)).ok).toBe(
      true,
    );
    expect(await cycle(phone)).toEqual({
      type: 'signedOut',
      reason: 'accountDeleted',
    });
    const lists = await phone.useCases.getLists();
    expect(lists.map((list) => list.name)).toContain('Courses du samedi');

    await phone.useCases.acknowledgeSignedOut();

    expect((await phone.useCases.getSyncInfo()).connection).toBe(
      'notConnected',
    );
    const after = await phone.useCases.getLists();
    expect(after.map((list) => list.name)).not.toContain('Courses du samedi');
  });

  it('004 US6-5 a suspended account then deleted ends as accountDeleted', async () => {
    const { adminPhone, phone, userId } = await setup();
    await adminPhone.useCases.suspendAccount(userId);
    expect(await cycle(phone)).toEqual({ type: 'suspended' });

    await adminPhone.useCases.deleteAccountAsAdmin(userId);

    expect(await cycle(phone)).toEqual({
      type: 'signedOut',
      reason: 'accountDeleted',
    });
  });

  it('004 US5-5 the only administrator can neither suspend nor delete themselves', async () => {
    const { adminPhone, adminId } = await setup();

    expect(await adminPhone.useCases.suspendAccount(adminId)).toEqual({
      ok: false,
      error: { type: 'LastAdministrator' },
    });
    expect(await adminPhone.useCases.deleteAccountAsAdmin(adminId)).toEqual({
      ok: false,
      error: { type: 'LastAdministrator' },
    });
  });

  it('004 US5-6 resending credentials stops the first temporary password; a suspended invited account is refused', async () => {
    const { adminPhone } = await setup();
    const first = await server.invite('paul@example.org');
    const accounts = await adminPhone.useCases.listAccounts();
    if (!accounts.ok) throw new Error('no accounts');
    const paulId = accounts.value.find(
      (a) => a.email === 'paul@example.org',
    )?.id;
    if (paulId === undefined) throw new Error('no paul');

    expect((await adminPhone.useCases.resendCredentials(paulId)).ok).toBe(true);

    const newPassword = (server.mails().at(-1) as { temporaryPassword: string })
      .temporaryPassword;
    expect(newPassword).not.toBe(first.temporaryPassword);
    const old = await (
      await newDevice()
    ).useCases.signIn(
      server.url,
      'paul@example.org',
      first.temporaryPassword,
      'Pixel',
    );
    expect(old.ok).toBe(false);
    const fresh = await (
      await newDevice()
    ).useCases.signIn(server.url, 'paul@example.org', newPassword, 'Pixel');
    expect(fresh).toEqual({
      ok: true,
      value: { type: 'passwordChangeRequired' },
    });

    await server.suspend(paulId);
    expect(await adminPhone.useCases.resendCredentials(paulId)).toEqual({
      ok: false,
      error: { type: 'NotInvited' },
    });
  });

  it('004 US5-4 a revoked device shows signedOut(revoked)', async () => {
    const { phone } = await setup();
    const second = await newDevice();
    expect((await signInDevice(server, second, 'Tablette')).ok).toBe(true);
    const devices = await phone.useCases.listDevices();
    if (!devices.ok) throw new Error('no devices');
    const tablet = devices.value.find((device) => device.name === 'Tablette');
    if (!tablet) throw new Error('no tablet');

    expect((await phone.useCases.revokeDevice(tablet.id)).ok).toBe(true);

    expect(await cycle(second)).toEqual({
      type: 'signedOut',
      reason: 'revoked',
    });
  });
});
