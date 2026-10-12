import { createFakePasswordHasher } from '../../application/testing/fake-password-hasher';
import { systemRandom } from './crypto';
import { createPasswordHasher } from './password-hasher';

const cheap = createPasswordHasher(systemRandom, { cost: 2 ** 4 });

describe('createPasswordHasher', () => {
  it('004 R3 stores scrypt$N$r$p$salt$hash with the real parameters', async () => {
    const hasher = createPasswordHasher(systemRandom);

    const stored = await hasher.hash('correct horse battery');

    expect(stored).toMatch(/^scrypt\$32768\$8\$3\$[\w-]{22}\$[\w-]{43}$/);
    expect(await hasher.verify('correct horse battery', stored)).toBe(true);
    expect(await hasher.verify('correct horse batterz', stored)).toBe(false);
  });

  it('004 R3 salts every hash, and never contains the password', async () => {
    const first = await cheap.hash('correct horse battery');
    const second = await cheap.hash('correct horse battery');

    expect(first).not.toBe(second);
    expect(first).not.toContain('correct');
  });

  it('004 R3 verifies a hash made with other parameters, read from the string', async () => {
    const stored = await createPasswordHasher(systemRandom, {
      cost: 2 ** 5,
    }).hash('correct horse battery');

    expect(stored).toContain('$32$8$3$');
    expect(await cheap.verify('correct horse battery', stored)).toBe(true);
  });

  it('004 R3 verifies an accented password typed in NFD against its NFC hash, and the reverse', async () => {
    const nfc = 'élève sûr à la maison';
    const nfd = nfc.normalize('NFD');
    expect(nfd).not.toBe(nfc);

    expect(await cheap.verify(nfd, await cheap.hash(nfc))).toBe(true);
    expect(await cheap.verify(nfc, await cheap.hash(nfd))).toBe(true);
  });

  it('004 R3 keeps case, spaces and other characters significant', async () => {
    const stored = await cheap.hash(' Mot de passe 😀 ');

    expect(await cheap.verify(' Mot de passe 😀 ', stored)).toBe(true);
    expect(await cheap.verify('Mot de passe 😀', stored)).toBe(false);
    expect(await cheap.verify(' mot de passe 😀 ', stored)).toBe(false);
  });

  it('004 R3 verifies a dummy hash and says no when there is no stored hash or it is damaged', async () => {
    expect(await cheap.verify('anything at all here', null)).toBe(false);
    expect(await cheap.verify('anything at all here', 'garbage')).toBe(false);
    expect(await cheap.verify('anything at all here', 'scrypt$x$8$3$a$b')).toBe(
      false,
    );
  });

  it('004 R3 takes about as long for no account as for a wrong password', async () => {
    const hasher = createPasswordHasher(systemRandom);
    const stored = await hasher.hash('correct horse battery');
    const time = async (work: () => Promise<boolean>) => {
      const start = process.hrtime.bigint();
      await work();
      return Number(process.hrtime.bigint() - start) / 1e6;
    };

    const unknown = await time(() =>
      hasher.verify('wrong password here', null),
    );
    const wrong = await time(() =>
      hasher.verify('wrong password here', stored),
    );

    // Same work (one scrypt at the same cost): within a factor of 3 of each other.
    expect(unknown).toBeGreaterThan(wrong / 3);
    expect(unknown).toBeLessThan(wrong * 3);
  });
});

describe('createFakePasswordHasher', () => {
  const fake = createFakePasswordHasher();

  it('004 is deterministic, normalizes to NFC, and never contains the password', async () => {
    const stored = await fake.hash('élève sûr à la maison');

    expect(stored).toBe(
      await fake.hash('élève sûr à la maison'.normalize('NFD')),
    );
    expect(stored).not.toContain('lève');
    expect(
      await fake.verify('élève sûr à la maison'.normalize('NFD'), stored),
    ).toBe(true);
    expect(await fake.verify('autre', stored)).toBe(false);
    expect(await fake.verify('autre', null)).toBe(false);
  });
});
