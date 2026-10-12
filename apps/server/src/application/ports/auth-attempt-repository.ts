import type { AttemptKind } from '../../domain/attempts';
import type { Instant } from './instant';

/** Replaces `PairingFailureRepository`. Keys are hashes: no readable address is stored. */
export interface AuthAttemptRepository {
  add(kind: AttemptKind, keyHash: string, at: Instant): Promise<void>;
  /** Attempts of this kind and key recorded at or after `since`. */
  countSince(
    kind: AttemptKind,
    keyHash: string,
    since: Instant,
  ): Promise<number>;
  earliestSince(
    kind: AttemptKind,
    keyHash: string,
    since: Instant,
  ): Promise<Instant | null>;
  /** Forgets the attempts recorded before `before`, which no window reads any more. */
  pruneBefore(before: Instant): Promise<void>;
  /** Both kinds; used when an account is deleted (research R16). */
  deleteForKey(keyHash: string): Promise<void>;
}
