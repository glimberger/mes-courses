export interface Random {
  /** Cryptographically secure random bytes. */
  bytes(length: number): Uint8Array;
}
