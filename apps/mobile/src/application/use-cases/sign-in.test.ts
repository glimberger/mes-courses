import { err, ok } from '../../domain/result';
import { signInHarness } from '../testing/sign-in-harness';
import { createSignIn } from './sign-in';

describe('signIn', () => {
  it('004 US2-1 signs in and keeps the credential and the connection, with the account', async () => {
    const h = await signInHarness();

    const outcome = await createSignIn(h.deps)(
      ' Courses.Example.fr/ ',
      ' Marie@Example.org ',
      'secret',
      'Pixel de Léa',
    );

    expect(outcome).toEqual(ok({ type: 'signedIn' }));
    expect(h.calls).toEqual(['health https://courses.example.fr']);
    expect(h.accountServer.signInCalls).toEqual([
      {
        url: 'https://courses.example.fr',
        email: 'marie@example.org',
        password: 'secret',
        deviceName: 'Pixel de Léa',
      },
    ]);
    expect(await h.credentials.read()).toBe('credential-signed-in');
    expect(await h.syncState()).toMatchObject({
      serverUrl: 'https://courses.example.fr',
      serverId: 'server-1',
      deviceId: 'device-signed-in',
      accountId: 'account-1',
      lastSeq: 0,
      lastSyncAt: null,
      snapshotDone: false,
    });
  });

  it('004 US2-1 stores nothing when the temporary password matched', async () => {
    const h = await signInHarness();
    h.accountServer.signInResult = ok({ type: 'passwordChangeRequired' });

    const outcome = await createSignIn(h.deps)(
      'courses.example.fr',
      'marie@example.org',
      'ABCD-EFGH-JKMN-PQRS',
      'Pixel',
    );

    expect(outcome).toEqual(ok({ type: 'passwordChangeRequired' }));
    expect(await h.credentials.read()).toBeNull();
    expect((await h.syncState()).serverUrl).toBeNull();
  });

  it('004 US2-1 refuses http:// and a malformed address without any request', async () => {
    const h = await signInHarness();

    expect(
      await createSignIn(h.deps)(
        'http://courses.example.fr',
        'a@b.co',
        'x',
        'P',
      ),
    ).toEqual(err({ type: 'InvalidUrl' }));
    expect(
      await createSignIn(h.deps)('courses.example.fr', 'nope', 'x', 'P'),
    ).toEqual(err({ type: 'InvalidEmail' }));
    expect(h.calls).toEqual([]);
    expect(h.accountServer.signInCalls).toEqual([]);
  });

  it('004 US2-1 refuses a trusted-looking unreachable or untrusted server before signing in', async () => {
    const h = await signInHarness();
    h.setHealth(err({ type: 'UntrustedServer' }));

    expect(
      await createSignIn(h.deps)('courses.example.fr', 'a@b.co', 'x', 'P'),
    ).toEqual(err({ type: 'UntrustedServer' }));
    expect(h.accountServer.signInCalls).toEqual([]);
  });

  it.each([
    { type: 'InvalidCredentials' },
    { type: 'TemporaryPasswordExpired' },
    { type: 'AccountSuspended' },
    { type: 'TooManyAttempts', minutesToWait: 4 },
    { type: 'ServerUnreachable' },
    { type: 'UpdateRequired' },
  ] as const)('004 US2-4 returns %j and changes nothing', async (failure) => {
    const h = await signInHarness();
    h.accountServer.signInResult = err(failure);
    const before = await h.syncState();

    const outcome = await createSignIn(h.deps)(
      'courses.example.fr',
      'a@b.co',
      'x',
      'P',
    );

    expect(outcome).toEqual(err(failure));
    expect(await h.credentials.read()).toBeNull();
    expect(await h.syncState()).toEqual(before);
  });

  describe('the local copy rule (FR-017)', () => {
    it('004 FR-017 keeps the copy and its outbox for the same account', async () => {
      const h = await signInHarness();
      await h.setSyncState({
        accountId: 'account-1',
        serverUrl: 'https://old.example.fr',
        deviceId: 'old-device',
      });
      await h.unitOfWork.run((repos) =>
        repos.lists.add({ id: 'list-x' as never, name: 'Mine' }),
      );
      const listsBefore = await h.lists();

      await createSignIn(h.deps)('courses.example.fr', 'a@b.co', 'x', 'P');

      expect(await h.lists()).toBe(listsBefore);
      expect((await h.syncState()).deviceId).toBe('device-signed-in');
    });

    it('004 FR-017 keeps an anonymous never-connected copy, to be adopted by the snapshot', async () => {
      const h = await signInHarness();
      await h.unitOfWork.run((repos) =>
        repos.lists.add({ id: 'list-x' as never, name: 'Mine' }),
      );

      await createSignIn(h.deps)('courses.example.fr', 'a@b.co', 'x', 'P');

      expect(await h.lists()).toBe(1);
    });

    it("004 FR-017 erases another account's copy before the credential is stored", async () => {
      const h = await signInHarness();
      await h.setSyncState({
        accountId: 'account-2',
        serverUrl: 'https://courses.example.fr',
        deviceId: 'old-device',
      });
      await h.unitOfWork.run((repos) =>
        repos.lists.add({ id: 'list-x' as never, name: 'Theirs' }),
      );
      const events: string[] = [];
      const write = h.credentials.write.bind(h.credentials);
      h.credentials.write = async (value) => {
        events.push(`write after ${await h.lists()} lists`);
        return write(value);
      };

      await createSignIn(h.deps)('courses.example.fr', 'a@b.co', 'x', 'P');

      // Only the seed remains, and it was in place before the credential was written.
      expect(events).toEqual(['write after 1 lists']);
      const names = await h.unitOfWork.run((repos) => repos.lists.all());
      expect(names.map((list) => list.name)).toEqual(['Courses']);
      expect((await h.syncState()).accountId).toBe('account-1');
    });

    it('004 FR-017 erases a copy tied to a server but to no known account', async () => {
      const h = await signInHarness();
      await h.setSyncState({
        accountId: null,
        serverUrl: 'https://courses.example.fr',
        deviceId: 'old-device',
      });
      await h.unitOfWork.run((repos) =>
        repos.lists.add({ id: 'list-x' as never, name: 'Unknown owner' }),
      );

      await createSignIn(h.deps)('courses.example.fr', 'a@b.co', 'x', 'P');

      const names = await h.unitOfWork.run((repos) => repos.lists.all());
      expect(names.map((list) => list.name)).toEqual(['Courses']);
    });

    it('004 FR-017 returns StorageFailed when the credential cannot be saved', async () => {
      const h = await signInHarness();
      h.credentials.write = async () => {
        throw new Error('secure storage unavailable');
      };

      expect(
        await createSignIn(h.deps)('courses.example.fr', 'a@b.co', 'x', 'P'),
      ).toEqual(err({ type: 'StorageFailed' }));
      expect((await h.syncState()).serverUrl).toBeNull();
    });
  });
});
