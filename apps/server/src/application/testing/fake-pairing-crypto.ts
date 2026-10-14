import type { PairingCrypto } from '../ports/pairing-crypto';

/** Deterministic codes and credentials; the "hash" is the input in hex, so it never contains the input itself. */
export const createFakePairingCrypto = (): PairingCrypto => {
  let credentials = 0;
  let temporaryPasswords = 0;
  return {
    generateTemporaryPassword: () => {
      const n = temporaryPasswords++;
      return `TEMP-${String(n).padStart(4, '0')}-ABCD-WXYZ`.toUpperCase();
    },
    generateCredential: () => `credential-${credentials++}`,
    sha256Hex: (input) =>
      [...input].map((c) => c.charCodeAt(0).toString(16)).join(''),
  };
};
