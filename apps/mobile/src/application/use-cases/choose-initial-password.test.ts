import { err, ok } from '../../domain/result';
import { signInHarness } from '../testing/sign-in-harness';
import { createChooseInitialPassword } from './choose-initial-password';

const TEMP = 'ABCD-EFGH-JKMN-PQRS';
const NEW = 'a brand new password';

const choose = (
  h: Awaited<ReturnType<typeof signInHarness>>,
  overrides: {
    newPassword?: string;
    confirmation?: string;
    temp?: string;
  } = {},
) =>
  createChooseInitialPassword(h.deps)(
    'courses.example.fr',
    ' Marie@Example.org ',
    overrides.temp ?? TEMP,
    overrides.newPassword ?? NEW,
    overrides.confirmation ?? overrides.newPassword ?? NEW,
    'Pixel de Léa',
  );

describe('chooseInitialPassword', () => {
  it('004 US2-2 sends the new password and keeps the device and the connection', async () => {
    const h = await signInHarness();

    expect(await choose(h)).toEqual(ok(undefined));

    expect(h.accountServer.choosePasswordCalls).toEqual([
      {
        url: 'https://courses.example.fr',
        email: 'marie@example.org',
        temporaryPassword: TEMP,
        newPassword: NEW,
        deviceName: 'Pixel de Léa',
      },
    ]);
    expect(await h.credentials.read()).toBe('credential-signed-in');
    expect(await h.syncState()).toMatchObject({
      serverUrl: 'https://courses.example.fr',
      accountId: 'account-1',
      snapshotDone: false,
    });
  });

  it('004 US2-3 makes no request when the two entries differ', async () => {
    const h = await signInHarness();

    expect(
      await choose(h, { confirmation: 'something else entirely' }),
    ).toEqual(err({ type: 'PasswordsDiffer' }));
    expect(h.accountServer.choosePasswordCalls).toEqual([]);
  });

  it.each([
    ['short', 'TooShort'],
    ['x'.repeat(129), 'TooLong'],
    [TEMP.toLowerCase(), 'SameAsTemporary'],
  ])(
    '004 US2-3 makes no request for a password that breaks a rule (%s)',
    async (newPassword, problem) => {
      const h = await signInHarness();

      expect(await choose(h, { newPassword })).toEqual(
        err({ type: 'PasswordRejected', problem }),
      );
      expect(h.accountServer.choosePasswordCalls).toEqual([]);
      expect(await h.credentials.read()).toBeNull();
    },
  );

  it('004 R4 returns TemporaryPasswordInvalid when the server no longer accepts the temporary password', async () => {
    const h = await signInHarness();
    h.accountServer.choosePasswordResult = err({ type: 'InvalidCredentials' });

    expect(await choose(h)).toEqual(err({ type: 'TemporaryPasswordInvalid' }));
    expect(await h.credentials.read()).toBeNull();
  });

  it.each([
    { type: 'TemporaryPasswordExpired' },
    { type: 'AccountSuspended' },
    { type: 'TooManyAttempts', minutesToWait: 3 },
    { type: 'ServerUnreachable' },
    { type: 'PasswordRejected', problem: 'TooShort' },
  ] as const)('004 US2-2 passes %j on and changes nothing', async (failure) => {
    const h = await signInHarness();
    h.accountServer.choosePasswordResult = err(failure);

    expect(await choose(h)).toEqual(err(failure));
    expect((await h.syncState()).serverUrl).toBeNull();
  });

  it("004 FR-017 erases another account's copy before storing the credential", async () => {
    const h = await signInHarness();
    await h.setSyncState({
      accountId: 'account-2',
      serverUrl: 'https://courses.example.fr',
    });
    await h.unitOfWork.run((repos) =>
      repos.lists.add({ id: 'list-x' as never, name: 'Theirs' }),
    );

    await choose(h);

    const names = await h.unitOfWork.run((repos) => repos.lists.all());
    expect(names.map((list) => list.name)).toEqual(['Courses']);
  });
});
