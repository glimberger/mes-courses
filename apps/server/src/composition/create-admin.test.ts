import { PassThrough } from 'node:stream';

import { createFakePasswordHasher } from '../application/testing/fake-password-hasher';
import { account } from '../application/testing/contracts/entities';
import { InMemoryStore } from '../application/testing/in-memory-store';
import { accountState } from '../domain/account';
import {
  CommandError,
  terminalPrompt,
  type PasswordPrompt,
} from './admin-prompt';
import { createAdmin } from './create-admin';

const hasher = createFakePasswordHasher();
const answers = (...entries: string[]): PasswordPrompt => {
  const queue = [...entries];
  return { ask: async () => queue.shift() ?? '' };
};

const GOOD = 'a long enough secret';

/** A store holding the setup account migration 2 leaves: no address, no password. */
const setup = async () => {
  const store = new InMemoryStore();
  await store.run(({ accounts }) =>
    accounts.add(account('setup', null, { role: 'administrator' })),
  );
  return store;
};

describe('createAdmin', () => {
  it('004 R2 completes the setup account with the normalized address and the password hash', async () => {
    const store = await setup();

    const line = await createAdmin(
      { store, hasher, prompt: answers(GOOD, GOOD) },
      '  Marie@Example.ORG ',
    );

    const done = await store.run(({ accounts }) => accounts.get('setup'));
    expect(done).toMatchObject({
      id: 'setup',
      email: 'marie@example.org',
      role: 'administrator',
      passwordHash: await hasher.hash(GOOD),
    });
    expect(done && accountState(done)).toBe('active');
    expect(line).toContain('marie@example.org');
    expect(line).not.toContain(GOOD);
  });

  it.each([
    [
      'an invalid address',
      'not-an-address',
      [GOOD, GOOD],
      'invalid email address',
    ],
    [
      'a short password',
      'marie@example.org',
      ['short', 'short'],
      'at least 12',
    ],
    [
      'a long password',
      'marie@example.org',
      ['x'.repeat(129), 'x'.repeat(129)],
      'at most 128',
    ],
    [
      'two different entries',
      'marie@example.org',
      [GOOD, `${GOOD}!`],
      'differ',
    ],
  ])(
    '004 R2 refuses %s and changes nothing',
    async (_label, email, entries, message) => {
      const store = await setup();

      await expect(
        createAdmin({ store, hasher, prompt: answers(...entries) }, email),
      ).rejects.toThrow(message);

      const untouched = await store.run(({ accounts }) =>
        accounts.get('setup'),
      );
      expect(untouched).toMatchObject({ email: null, passwordHash: null });
    },
  );

  it('004 R2 asks nothing when the address is invalid', async () => {
    const store = await setup();
    const ask = jest.fn(async () => GOOD);

    await expect(
      createAdmin({ store, hasher, prompt: { ask } }, 'nope'),
    ).rejects.toBeInstanceOf(CommandError);

    expect(ask).not.toHaveBeenCalled();
  });

  it('004 R2 refuses to run once the setup account has an address', async () => {
    const store = await setup();
    await createAdmin(
      { store, hasher, prompt: answers(GOOD, GOOD) },
      'marie@example.org',
    );

    await expect(
      createAdmin(
        { store, hasher, prompt: answers(GOOD, GOOD) },
        'paul@example.org',
      ),
    ).rejects.toThrow('already has an address');

    expect(
      (await store.run(({ accounts }) => accounts.get('setup')))?.email,
    ).toBe('marie@example.org');
  });

  it('004 R2 refuses an address another account already uses', async () => {
    const store = await setup();
    await store.run(({ accounts }) =>
      accounts.add(account('u-1', 'marie@example.org', { passwordHash: 'h' })),
    );

    await expect(
      createAdmin(
        { store, hasher, prompt: answers(GOOD, GOOD) },
        'Marie@example.org',
      ),
    ).rejects.toThrow('already uses');
  });

  it('004 R2 the setup account is never reachable before the command: no address, no password', async () => {
    const store = await setup();

    const before = await store.run(({ accounts }) => accounts.get('setup'));

    expect(before).toMatchObject({ email: null, passwordHash: null });
    expect(
      await store.run(({ accounts }) => accounts.findByEmail('')),
    ).toBeNull();
  });
});

describe('terminalPrompt', () => {
  const run = async (typed: string) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const written: string[] = [];
    output.on('data', (chunk: Buffer) => written.push(chunk.toString()));
    const pending = terminalPrompt(input, output).ask('Password: ');
    input.write(typed);
    return { answer: await pending, written: written.join('') };
  };

  it('004 reads one line without writing it back', async () => {
    const { answer, written } = await run('secret passphrase\n');

    expect(answer).toBe('secret passphrase');
    expect(written).not.toContain('secret');
    expect(written).toContain('Password: ');
  });
});
