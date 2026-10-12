export interface PasswordHasher {
  /** Normalizes the password to NFC, then hashes it. */
  hash(password: string): Promise<string>;
  /**
   * Normalizes to NFC, then verifies. `null` verifies a fixed dummy hash and returns `false`, so
   * an unknown account costs the same time as a known one (research R3).
   */
  verify(password: string, stored: string | null): Promise<boolean>;
}
