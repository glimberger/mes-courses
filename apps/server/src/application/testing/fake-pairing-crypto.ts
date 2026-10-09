import type { PairingCrypto } from '../ports/pairing-crypto';

/** Deterministic codes and credentials; the "hash" is the input in hex, so it never contains the input itself. */
export const createFakePairingCrypto = (): PairingCrypto => {
  let codes = 0;
  let credentials = 0;
  return {
    generateCode: () => `ABCD-EF2${'ABCDEFGHJK'[codes++ % 10] ?? 'A'}`,
    normalizeCode: (input) => {
      const compact = input.toUpperCase().replace(/[\s-]/g, '');
      return compact.length === 8
        ? `${compact.slice(0, 4)}-${compact.slice(4)}`
        : compact;
    },
    generateCredential: () => `credential-${credentials++}`,
    sha256Hex: (input) =>
      [...input].map((c) => c.charCodeAt(0).toString(16)).join(''),
  };
};
