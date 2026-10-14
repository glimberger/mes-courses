import type { Instant } from './instant';

/** What lets a device learn that its account was deleted (research R7). Holds no account data. */
export interface EndedCredentialRepository {
  add(
    credentialHash: string,
    reason: 'accountDeleted',
    at: Instant,
  ): Promise<void>;
  find(credentialHash: string): Promise<{ reason: 'accountDeleted' } | null>;
}
