import type { Random } from '../../application/ports/random';
import {
  generateCredential,
  generatePairingCode,
  normalizeCode,
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

describe('generatePairingCode', () => {
  it('is 8 characters formatted XXXX-XXXX', () => {
    expect(generatePairingCode(systemRandom)).toMatch(
      /^[A-Z2-9]{4}-[A-Z2-9]{4}$/,
    );
  });

  it('never uses 0, O, 1, I or L, over many codes', () => {
    for (let i = 0; i < 500; i++) {
      expect(generatePairingCode(systemRandom)).not.toMatch(/[01OIL]/);
    }
  });

  it('can produce every character of the alphabet', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2_000; i++) {
      for (const char of generatePairingCode(systemRandom).replace('-', '')) {
        seen.add(char);
      }
    }

    expect(seen.size).toBe(31);
  });

  it('maps bytes to the alphabet in order', () => {
    expect(generatePairingCode(fixedRandom(0, 1, 2, 3, 4, 5, 6, 7))).toBe(
      'ABCD-EFGH',
    );
  });

  it('skips bytes that would bias the choice', () => {
    // 248 and above are rejected; 255 is skipped, 0 gives "A".
    expect(
      generatePairingCode(fixedRandom(255, 248, 0, 0, 0, 0, 0, 0, 0)),
    ).toBe('AAAA-AAAA');
  });
});

describe('normalizeCode', () => {
  it('accepts lower case', () => {
    expect(normalizeCode('abcd-ef23')).toBe('ABCD-EF23');
  });

  it('accepts a missing dash', () => {
    expect(normalizeCode('ABCDEF23')).toBe('ABCD-EF23');
  });

  it('ignores spaces around and inside', () => {
    expect(normalizeCode('  abcd ef23 ')).toBe('ABCD-EF23');
  });

  it('keeps a code of the wrong length as it is, without a dash added', () => {
    expect(normalizeCode('abc')).toBe('ABC');
    expect(normalizeCode('abcdef2345')).toBe('ABCDEF2345');
  });

  it('maps a generated code to itself', () => {
    const code = generatePairingCode(systemRandom);

    expect(normalizeCode(code)).toBe(code);
  });
});

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
