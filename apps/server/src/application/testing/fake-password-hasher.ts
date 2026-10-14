import type { PasswordHasher } from '../ports/password-hasher';

/** A cheap, deterministic digest (not secure): the hash never contains the password. */
const digest = (text: string): string => {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

/** Normalizes to NFC like the real hasher, so the same rules can be tested without the cost. */
export const createFakePasswordHasher = (): PasswordHasher => ({
  hash: async (password) =>
    `fake$${digest(password.normalize('NFC'))}$${password.normalize('NFC').length}`,
  verify: async (password, stored) =>
    stored !== null &&
    stored ===
      `fake$${digest(password.normalize('NFC'))}$${password.normalize('NFC').length}`,
});
