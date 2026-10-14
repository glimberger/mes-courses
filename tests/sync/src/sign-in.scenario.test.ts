import { FakeClock, buildTestAppStack } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

import { signInDevice, PASSWORD } from './testing/onboard';

const START = Date.parse('2026-10-12T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('sign-in scenarios (004 US2)', () => {
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

  it('004 US2-1/2/3/4 invited person signs in, chooses a password; the temporary one then fails; wrong credentials all alike', async () => {
    const { temporaryPassword } = await server.invite('marie@example.org');
    const phone = await newDevice();

    const first = await phone.useCases.signIn(
      server.url,
      'Marie@Example.org',
      temporaryPassword,
      'Pixel',
    );
    expect(first).toEqual({
      ok: true,
      value: { type: 'passwordChangeRequired' },
    });
    expect((await phone.useCases.getSyncInfo()).connection).toBe(
      'notConnected',
    );

    const short = await phone.useCases.chooseInitialPassword(
      server.url,
      'marie@example.org',
      temporaryPassword,
      'short',
      'short',
      'Pixel',
    );
    expect(short).toEqual({
      ok: false,
      error: { type: 'PasswordRejected', problem: 'TooShort' },
    });

    const chosen = await phone.useCases.chooseInitialPassword(
      server.url,
      'marie@example.org',
      temporaryPassword,
      PASSWORD,
      PASSWORD,
      'Pixel',
    );
    expect(chosen.ok).toBe(true);
    expect((await phone.useCases.getSyncInfo()).connection).toBe('connected');

    const tablet = await newDevice();
    const reuse = await tablet.useCases.signIn(
      server.url,
      'marie@example.org',
      temporaryPassword,
      'Tablette',
    );
    const wrong = await tablet.useCases.signIn(
      server.url,
      'marie@example.org',
      'not the password',
      'Tablette',
    );
    const unknown = await tablet.useCases.signIn(
      server.url,
      'nobody@example.org',
      'not the password',
      'Tablette',
    );
    expect(reuse).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
    expect(wrong).toEqual(reuse);
    expect(unknown).toEqual(reuse);
  });

  it('004 US2-5 a temporary password is refused after 7 days', async () => {
    const { temporaryPassword } = await server.invite('marie@example.org');
    clock.advance(7 * DAY_MS);
    const phone = await newDevice();

    expect(
      await phone.useCases.signIn(
        server.url,
        'marie@example.org',
        temporaryPassword,
        'Pixel',
      ),
    ).toEqual({ ok: false, error: { type: 'TemporaryPasswordExpired' } });
  });

  it('004 US2-6 / FR-008 the credential persists across a restart, and the device is listed under its name', async () => {
    const phone = await newDevice();
    expect((await signInDevice(server, phone, 'Pixel de Léa')).ok).toBe(true);

    const restarted = await buildTestAppStack({
      serverUrl: server.url,
      clock,
      database: phone.database,
      credentials: phone.credentials,
    });

    expect((await restarted.useCases.getSyncInfo()).connection).toBe(
      'connected',
    );
    const devices = await restarted.useCases.listDevices();
    expect(devices.ok && devices.value.map((d) => d.name)).toEqual([
      'Pixel de Léa',
    ]);
  });

  it('004 FR-017 another account signing in on the same device erases the previous copy first', async () => {
    const phone = await newDevice();
    await signInDevice(server, phone, 'Pixel', 'marie@example.org');
    const { list } = await phone.useCases.getCurrentList();
    const [category] = await phone.useCases.getCategories();
    const created = await phone.useCases.createArticleAndAddToList(
      list.id,
      { name: 'Lait', categoryId: category?.id as never },
      null,
    );
    expect(created.ok).toBe(true);
    clock.advance(1000);
    await phone.useCases.synchronize();

    const second = await signInDevice(
      server,
      phone,
      'Pixel',
      'paul@example.org',
    );
    expect(second.ok).toBe(true);
    clock.advance(1000);
    await phone.useCases.synchronize();

    const { sections } = await phone.useCases.getCurrentList();
    expect(sections.flatMap((section) => section.items)).toEqual([]);
    const catalog = await phone.useCases.getCatalog(list.id);
    expect(JSON.stringify(catalog)).not.toContain('Lait');
  });
});
