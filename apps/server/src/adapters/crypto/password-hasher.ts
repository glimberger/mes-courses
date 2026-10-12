import { scrypt, timingSafeEqual } from 'node:crypto';

import type { PasswordHasher } from '../../application/ports/password-hasher';
import type { Random } from '../../application/ports/random';

/** research R3: `scrypt$N$r$p$salt$hash`, base64url, parameters read back from the string. */
const DEFAULT_COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 3;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** Parameters of a fixed hash for `verify(password, null)`, so an unknown account costs the same. */
const DUMMY_HASH = `scrypt$${DEFAULT_COST}$${BLOCK_SIZE}$${PARALLELISM}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

const derive = (
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
  keyBytes: number,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFC'),
      salt,
      keyBytes,
      {
        N: cost,
        r: blockSize,
        p: parallelism,
        // scrypt needs about 128 * N * r bytes; Node's default limit (32 MiB) is the real cost.
        maxmem: 128 * cost * blockSize * 2,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });

const parse = (stored: string) => {
  const [scheme, n, r, p, salt, hash, ...rest] = stored.split('$');
  if (
    scheme !== 'scrypt' ||
    salt === undefined ||
    hash === undefined ||
    rest.length > 0
  ) {
    return null;
  }
  const cost = Number(n);
  const blockSize = Number(r);
  const parallelism = Number(p);
  if (![cost, blockSize, parallelism].every(Number.isInteger)) return null;
  return {
    cost,
    blockSize,
    parallelism,
    salt: Buffer.from(salt, 'base64url'),
    hash: Buffer.from(hash, 'base64url'),
  };
};

/** scrypt over `node:crypto`. `cost` (N) is lowered by adapter tests only. */
export const createPasswordHasher = (
  random: Random,
  { cost = DEFAULT_COST }: { cost?: number } = {},
): PasswordHasher => ({
  hash: async (password) => {
    const salt = Buffer.from(random.bytes(SALT_BYTES));
    const key = await derive(
      password,
      salt,
      cost,
      BLOCK_SIZE,
      PARALLELISM,
      KEY_BYTES,
    );
    return `scrypt$${cost}$${BLOCK_SIZE}$${PARALLELISM}$${salt.toString('base64url')}$${key.toString('base64url')}`;
  },
  verify: async (password, stored) => {
    // No account, or a damaged hash: do the work of a real check and say no.
    const parsed = stored === null ? null : parse(stored);
    const target = parsed ?? parse(DUMMY_HASH);
    if (target === null) return false;
    const key = await derive(
      password,
      target.salt,
      target.cost,
      target.blockSize,
      target.parallelism,
      target.hash.length,
    );
    return (
      parsed !== null &&
      key.length === target.hash.length &&
      timingSafeEqual(key, target.hash)
    );
  },
});
