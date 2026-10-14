import type { Random } from '../../application/ports/random';
import {
  generateCredential,
  generateTemporaryPassword,
  sha256Hex,
  systemRandom,
} from './crypto';

/** Hands out the given bytes in order, then zeros. */
const fixedRandom = (...values: number[]): Random => {
  let index = 0;
  return {
    bytes: (length) => Uint8Array.from({ length }, () => values[index++] ?? 0),
  };
};

describe('generateCredential', () => {
  it('is 32 random bytes in base64url', () => {
    const credential = generateCredential(systemRandom);

    expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(credential, 'base64url')).toHaveLength(32);
  });

  it('encodes the bytes it was given', () => {
    expect(generateCredential(fixedRandom(...Array(32).fill(255)))).toBe(
      '_'.repeat(42) + '8',
    );
  });

  it('differs from one call to the next', () => {
    expect(generateCredential(systemRandom)).not.toBe(
      generateCredential(systemRandom),
    );
  });
});

describe('sha256Hex', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ])('matches the known vector for %j', (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });
});

describe('generateTemporaryPassword', () => {
  it('004 R3 is 16 characters formatted XXXX-XXXX-XXXX-XXXX from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword(systemRandom);
      expect(password).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
      expect(password).not.toMatch(/[01OIL]/);
    }
  });

  it('004 R3 never repeats over many passwords', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      seen.add(generateTemporaryPassword(systemRandom));
    }

    expect(seen.size).toBe(1_000);
  });

  it('004 R3 skips the biased bytes, so each character is equally likely', () => {
    const limit = 256 - (256 % 31);
    const passwords = generateTemporaryPassword(
      fixedRandom(limit, 255, ...Array.from({ length: 16 }, () => 0)),
    );

    expect(passwords).toBe('AAAA-AAAA-AAAA-AAAA');
  });
});
