/**
 * The device credential, in the operating system's secure storage (research R11, R12a). It never
 * goes to SQLite, logs or reports.
 */
export interface CredentialStore {
  /** `null` when none is stored, or when a restored value cannot be decrypted. */
  read(): Promise<string | null>;
  write(credential: string): Promise<void>;
  clear(): Promise<void>;
}
