import { FakeClock, buildTestAppStack } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

import { PASSWORD } from './testing/onboard';

const START = Date.parse('2026-10-12T10:00:00.000Z');
const NEW_PASSWORD = 'a different password';

describe('password reset scenarios (004 US4)', () => {
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

  /** The reset email is sent after the answer: waits for it, and returns its temporary password. */
  const nextTemporaryPassword = async (count: number) => {
    for (let i = 0; i < 100 && server.mails().length < count; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const mail = server.mails()[count - 1];
    if (mail?.kind !== 'newTemporaryPassword') throw new Error('No mail');
    return mail.temporaryPassword;
  };

  it('004 US4-1/2 recovers by email alone: the old password keeps working until a new one replaces both', async () => {
    await server.createAccount({ email: 'marie@example.org' });
    const phone = await newDevice();

    const asked = await phone.useCases.requestPasswordReset(
      server.url,
      'Marie@Example.org',
    );
    expect(asked).toEqual({ ok: true, value: undefined });
    const temporary = await nextTemporaryPassword(1);
    expect(server.mails()[0]).toMatchObject({ to: 'marie@example.org' });

    // The current password still signs in.
    const tablet = await newDevice();
    expect(
      (
        await tablet.useCases.signIn(
          server.url,
          'marie@example.org',
          PASSWORD,
          'Tablette',
        )
      ).ok,
    ).toBe(true);

    // The temporary one asks for a new password, which replaces both.
    const forgot = await newDevice();
    expect(
      await forgot.useCases.signIn(
        server.url,
        'marie@example.org',
        temporary,
        'Pixel',
      ),
    ).toEqual({ ok: true, value: { type: 'passwordChangeRequired' } });
    expect(
      (
        await forgot.useCases.chooseInitialPassword(
          server.url,
          'marie@example.org',
          temporary,
          NEW_PASSWORD,
          NEW_PASSWORD,
          'Pixel',
        )
      ).ok,
    ).toBe(true);

    const later = await newDevice();
    const withOld = await later.useCases.signIn(
      server.url,
      'marie@example.org',
      PASSWORD,
      'Autre',
    );
    expect(withOld).toEqual({
      ok: false,
      error: { type: 'InvalidCredentials' },
    });
    expect(
      (
        await later.useCases.signIn(
          server.url,
          'marie@example.org',
          NEW_PASSWORD,
          'Autre',
        )
      ).ok,
    ).toBe(true);
  });

  it('004 US4-1 makes the temporary password single-use', async () => {
    await server.createAccount({ email: 'marie@example.org' });
    const phone = await newDevice();
    await phone.useCases.requestPasswordReset(server.url, 'marie@example.org');
    const temporary = await nextTemporaryPassword(1);
    await phone.useCases.chooseInitialPassword(
      server.url,
      'marie@example.org',
      temporary,
      NEW_PASSWORD,
      NEW_PASSWORD,
      'Pixel',
    );

    const again = await (
      await newDevice()
    ).useCases.signIn(server.url, 'marie@example.org', temporary, 'Tablette');

    expect(again).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
  });

  it('004 US4-4 refuses the 4th request in an hour with the minutes to wait', async () => {
    await server.createAccount({ email: 'marie@example.org' });
    const phone = await newDevice();
    for (let i = 0; i < 3; i++) {
      await phone.useCases.requestPasswordReset(
        server.url,
        'marie@example.org',
      );
    }

    expect(
      await phone.useCases.requestPasswordReset(
        server.url,
        'marie@example.org',
      ),
    ).toEqual({
      ok: false,
      error: { type: 'TooManyAttempts', minutesToWait: 60 },
    });
  });

  it('004 US4-3 answers an unknown address like a known one and mails nothing', async () => {
    await server.createAccount({ email: 'marie@example.org' });
    const phone = await newDevice();

    const known = await phone.useCases.requestPasswordReset(
      server.url,
      'marie@example.org',
    );
    const unknown = await phone.useCases.requestPasswordReset(
      server.url,
      'nobody@example.org',
    );

    expect(unknown).toEqual(known);
    await nextTemporaryPassword(1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(server.mails()).toHaveLength(1);
  });

  it('004 US4-1 invalidates the temporary password of an invitation', async () => {
    const { temporaryPassword: invitation } =
      await server.invite('marie@example.org');
    const phone = await newDevice();
    await phone.useCases.requestPasswordReset(server.url, 'marie@example.org');
    const fresh = await nextTemporaryPassword(1);

    const old = await phone.useCases.signIn(
      server.url,
      'marie@example.org',
      invitation,
      'Pixel',
    );
    const current = await phone.useCases.signIn(
      server.url,
      'marie@example.org',
      fresh,
      'Pixel',
    );

    expect(old).toEqual({ ok: false, error: { type: 'InvalidCredentials' } });
    expect(current).toEqual({
      ok: true,
      value: { type: 'passwordChangeRequired' },
    });
  });

  it('004 US4-6 answers a suspended address the same and sends nothing', async () => {
    const { accountId } = await server.createAccount({
      email: 'marie@example.org',
    });
    await server.suspend(accountId);
    const phone = await newDevice();

    const result = await phone.useCases.requestPasswordReset(
      server.url,
      'marie@example.org',
    );

    expect(result).toEqual({ ok: true, value: undefined });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(server.mails()).toEqual([]);
  });
});
