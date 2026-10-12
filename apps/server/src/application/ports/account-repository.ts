import type { AccountRecord } from '../../domain/account';
import type { Instant } from './instant';

export interface AccountRepository {
  /** Rejects a second account with the same email. */
  add(record: AccountRecord): Promise<void>;
  get(id: string): Promise<AccountRecord | null>;
  /** The email must already be normalized. */
  findByEmail(normalizedEmail: string): Promise<AccountRecord | null>;
  /** Replaces the row with the same id. */
  update(record: AccountRecord): Promise<void>;
  /** By creation time, then id. */
  all(): Promise<AccountRecord[]>;
  /** The cascade removes its devices and all its data. */
  delete(id: string): Promise<void>;
  /** Active (not suspended, password chosen) administrators other than the given account. */
  countOtherActiveAdministrators(id: string): Promise<number>;
  /** The latest `lastSyncAt` of its devices. */
  lastSyncAt(id: string): Promise<Instant | null>;
}
