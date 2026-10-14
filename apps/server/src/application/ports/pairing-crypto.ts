/** Code and credential generation and hashing, implemented over Node's crypto by an adapter. */
export interface PairingCrypto {
  /** A new temporary password, `XXXX-XXXX-XXXX-XXXX` (004 research R3). */
  generateTemporaryPassword(): string;
  /** A new device credential, 256 bits in base64url. */
  generateCredential(): string;
  /** Lower-case hex SHA-256. */
  sha256Hex(input: string): string;
}
