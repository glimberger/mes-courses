import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { IdGenerator } from '../../application/ports/id-generator';
import type { PairingCrypto } from '../../application/ports/pairing-crypto';
import type { Random } from '../../application/ports/random';

export const systemRandom: Random = {
  bytes: (length) => new Uint8Array(randomBytes(length)),
};

/** No `0 O 1 I L`: they are confused when typed from a screen (research R11). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TEMPORARY_PASSWORD_LENGTH = 16;
/** Bytes from this value up are skipped, so every character is equally likely. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

const randomCharacters = (random: Random, length: number): string => {
  let text = '';
  while (text.length < length) {
    for (const byte of random.bytes(length - text.length)) {
      if (byte < UNBIASED_LIMIT) text += ALPHABET[byte % ALPHABET.length];
    }
  }
  return text;
};

/**
 * A temporary password (004 research R3): 16 characters from the same unambiguous alphabet, about
 * 79 bits, shown `XXXX-XXXX-XXXX-XXXX`. Typed back in any case, with or without dashes.
 */
export const generateTemporaryPassword = (random: Random): string =>
  randomCharacters(random, TEMPORARY_PASSWORD_LENGTH).replace(
    /(.{4})(?=.)/g,
    '$1-',
  );

/** A device credential: 32 random bytes (256 bits) in base64url. */
export const generateCredential = (random: Random): string =>
  Buffer.from(random.bytes(32)).toString('base64url');

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

export const systemIdGenerator: IdGenerator = { next: () => randomUUID() };

export const createPairingCrypto = (random: Random): PairingCrypto => ({
  generateTemporaryPassword: () => generateTemporaryPassword(random),
  generateCredential: () => generateCredential(random),
  sha256Hex,
});
