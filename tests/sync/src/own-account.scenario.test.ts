import { FakeClock, buildTestAppStack } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

import { EMAIL, PASSWORD, signInDevice } from './testing/onboard';

const START = Date.parse('2026-10-12T10:00:00.000Z');
const ADMIN_EMAIL = 'admin@example.org';
const NEW_PASSWORD = 'a brand new password';

describe('my account and my devices scenarios (004 US6)', () => {
  let server: TestServer;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
  });
  afterEach(async () => {
    await server.close();
  });

  type Device = Awaited<ReturnType<typeof newDevice>>;
  const newDevice = () => buildTestAppStack({ serverUrl: server.url, clock });
  const cycle = async (device: Device) => {
    clock.advance(1_000);
    return (await device.useCases.synchronize()).outcome;
  };
  const addList = async (device: Device, name: string) => {
    clock.advance(1_000);
    const created = await device.useCases.createList(name);
    if (!created.ok) throw new Error('no list');
  };
  const listNames = async (device: Device) =>
    (await device.useCases.getLists()).map((list) => list.name);

  /** Two phones of the same account, both synced. */
  const twoPhones = async () => {
    const phone = await newDevice();
    expect((await signInDevice(server, phone, 'Pixel')).ok).toBe(true);
    const tablet = await newDevice();
    expect((await signInDevice(server, tablet, 'Tablette')).ok).toBe(true);
    await cycle(phone);
    await cycle(tablet);
    return { phone, tablet };
  };

  it('004 US6-1 the settings read model shows only the devices of the caller', async () => {
    const { phone } = await twoPhones();
    const other = await newDevice();
    expect(
      (await signInDevice(server, other, 'Pixel de Paul', 'paul@example.org'))
        .ok,
    ).toBe(true);

    const settings = await phone.useCases.getAccountSettings();

    expect(settings.account).toEqual({
      ok: true,
      value: { id: expect.any(String), email: EMAIL, role: 'user' },
    });
    expect(
      settings.devices?.ok && settings.devices.value.map((d) => d.name).sort(),
    ).toEqual(['Pixel', 'Tablette']);
  });

  it('004 US6-2 changing the password keeps the other device signed in and ends the old password', async () => {
    const { phone, tablet } = await twoPhones();

    expect(
      await phone.useCases.changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD),
    ).toEqual({ ok: true, value: undefined });

    expect(await cycle(tablet)).toEqual({ type: 'saved' });
    const oldPassword = await (
      await newDevice()
    ).useCases.signIn(server.url, EMAIL, PASSWORD, 'Autre');
    expect(oldPassword).toEqual({
      ok: false,
      error: { type: 'InvalidCredentials' },
    });
    const newer = await (
      await newDevice()
    ).useCases.signIn(server.url, EMAIL, NEW_PASSWORD, 'Autre');
    expect(newer.ok).toBe(true);
  });

  it('004 US6-2 the same password is refused with SameAsCurrent, locally', async () => {
    const { phone } = await twoPhones();

    expect(
      await phone.useCases.changePassword(PASSWORD, PASSWORD, PASSWORD),
    ).toEqual({
      ok: false,
      error: { type: 'PasswordRejected', problem: 'SameAsCurrent' },
    });
  });

  it('004 US6-2 a wrong current password is refused and the password stays', async () => {
    const { phone } = await twoPhones();

    expect(
      await phone.useCases.changePassword(
        'not my password',
        NEW_PASSWORD,
        NEW_PASSWORD,
      ),
    ).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
    expect(
      (
        await (
          await newDevice()
        ).useCases.signIn(server.url, EMAIL, PASSWORD, 'X')
      ).ok,
    ).toBe(true);
  });

  it('004 US6-3 revoking another device signs it out on its next sync and keeps its copy until acknowledged', async () => {
    const { phone, tablet } = await twoPhones();
    await addList(tablet, 'Courses du samedi');
    await cycle(tablet);
    const devices = await phone.useCases.listDevices();
    if (!devices.ok) throw new Error('no devices');
    const tabletId = devices.value.find((d) => d.name === 'Tablette')?.id;
    if (tabletId === undefined) throw new Error('no tablet');

    expect((await phone.useCases.revokeDevice(tabletId)).ok).toBe(true);

    expect(await cycle(tablet)).toEqual({
      type: 'signedOut',
      reason: 'revoked',
    });
    expect(await listNames(tablet)).toContain('Courses du samedi');
    await tablet.useCases.acknowledgeSignedOut();
    expect(await listNames(tablet)).not.toContain('Courses du samedi');
    expect(await cycle(phone)).toEqual({ type: 'saved' });
  });

  it('004 US6-4 signing out with a pending change erases the copy; the account keeps what was sent', async () => {
    const { phone, tablet } = await twoPhones();
    await addList(phone, 'Envoyée');
    await cycle(phone);
    await addList(phone, 'Jamais envoyée');
    expect((await phone.useCases.getSyncInfo()).pendingCount).toBe(1);

    expect(await phone.useCases.signOut()).toEqual({
      ok: true,
      value: undefined,
    });

    expect((await phone.useCases.getSyncInfo()).connection).toBe(
      'notConnected',
    );
    expect(await listNames(phone)).not.toContain('Envoyée');
    // The account still has what reached it, and the signed-out device is no longer listed.
    await cycle(tablet);
    expect(await listNames(tablet)).toContain('Envoyée');
    expect(await listNames(tablet)).not.toContain('Jamais envoyée');
    const devices = await tablet.useCases.listDevices();
    expect(devices.ok && devices.value.map((d) => d.name)).toEqual([
      'Tablette',
    ]);
  });

  it('004 US6-4 signing in again on the erased device gets the sent lists back', async () => {
    const { phone } = await twoPhones();
    await addList(phone, 'Envoyée');
    await cycle(phone);
    await phone.useCases.signOut();

    expect((await signInDevice(server, phone, 'Pixel')).ok).toBe(true);
    await cycle(phone);

    expect(await listNames(phone)).toContain('Envoyée');
  });

  it('004 US6-6 deleting the account with the password removes it from the server and signs the other devices out', async () => {
    const { phone, tablet } = await twoPhones();
    await addList(tablet, 'Courses du samedi');
    await cycle(tablet);

    expect(await phone.useCases.deleteMyAccount(PASSWORD)).toEqual({
      ok: true,
      value: undefined,
    });

    expect((await phone.useCases.getSyncInfo()).connection).toBe(
      'notConnected',
    );
    expect(await listNames(phone)).not.toContain('Courses du samedi');
    expect(await cycle(tablet)).toEqual({
      type: 'signedOut',
      reason: 'accountDeleted',
    });
    // Nothing of the account is left to sign in to.
    expect(
      await (
        await newDevice()
      ).useCases.signIn(server.url, EMAIL, PASSWORD, 'X'),
    ).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
  });

  it('004 US6-6 a wrong password deletes nothing', async () => {
    const { phone, tablet } = await twoPhones();

    expect(await phone.useCases.deleteMyAccount('not my password')).toEqual({
      ok: false,
      error: { type: 'InvalidCredentials' },
    });

    expect((await phone.useCases.getSyncInfo()).connection).toBe('connected');
    expect(await cycle(tablet)).toEqual({ type: 'saved' });
  });

  it('004 US6-7 the only administrator cannot delete their own account', async () => {
    await server.createAccount({ role: 'administrator', email: ADMIN_EMAIL });
    const adminPhone = await newDevice();
    expect(
      (
        await adminPhone.useCases.signIn(
          server.url,
          ADMIN_EMAIL,
          PASSWORD,
          'Admin',
        )
      ).ok,
    ).toBe(true);

    expect(await adminPhone.useCases.deleteMyAccount(PASSWORD)).toEqual({
      ok: false,
      error: { type: 'LastAdministrator' },
    });

    expect((await adminPhone.useCases.getSyncInfo()).connection).toBe(
      'connected',
    );
  });
});
