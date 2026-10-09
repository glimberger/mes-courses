/** Code and credential generation and hashing, implemented over Node's crypto by an adapter. */
export interface PairingCrypto {
  /** A new pairing code, `XXXX-XXXX`. */
  generateCode(): string;
  /** Canonical form of a typed code: case, spaces and dash forgiven. */
  normalizeCode(input: string): string;
  /** A new device credential, 256 bits in base64url. */
  generateCredential(): string;
  /** Lower-case hex SHA-256. */
  sha256Hex(input: string): string;
}
