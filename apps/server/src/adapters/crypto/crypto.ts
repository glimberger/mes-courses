import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { IdGenerator } from '../../application/ports/id-generator';
import type { PairingCrypto } from '../../application/ports/pairing-crypto';
import type { Random } from '../../application/ports/random';

export const systemRandom: Random = {
  bytes: (length) => new Uint8Array(randomBytes(length)),
};

/** No `0 O 1 I L`: they are confused when typed from a screen (research R11). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
/** Bytes from this value up are skipped, so every character is equally likely. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

/** 8 characters from the alphabet, formatted `XXXX-XXXX`. */
export const generatePairingCode = (random: Random): string => {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random.bytes(CODE_LENGTH - code.length)) {
      if (byte < UNBIASED_LIMIT) code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
};

/**
 * Upper case, without spaces or dashes, then `XXXX-XXXX` when it has 8 characters. Any other
 * length is returned upper-cased and stripped but not dashed, so it can never match a stored code.
 */
export const normalizeCode = (input: string): string => {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  return compact.length === CODE_LENGTH
    ? `${compact.slice(0, 4)}-${compact.slice(4)}`
    : compact;
};

/** A device credential: 32 random bytes (256 bits) in base64url. */
export const generateCredential = (random: Random): string =>
  Buffer.from(random.bytes(32)).toString('base64url');

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

export const systemIdGenerator: IdGenerator = { next: () => randomUUID() };

export const createPairingCrypto = (random: Random): PairingCrypto => ({
  generateCode: () => generatePairingCode(random),
  normalizeCode,
  generateCredential: () => generateCredential(random),
  sha256Hex,
});
