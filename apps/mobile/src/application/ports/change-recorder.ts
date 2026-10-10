import type { Change, EntityKind } from '@mes-courses/sync-core';

/** A change waiting in the outbox; `seq` is its place in the push order. */
export type PendingChange = Change & { seq: number };

/**
 * The outbox. It is part of `Repositories`, so a change is recorded in the transaction of the
 * write it describes (FR-005).
 */
export interface ChangeRecorder {
  /**
   * Stamps the change with the next HLC from the `Clock` and appends it to the outbox. With
   * `heldBy`, the entry is held back until released, discarded or acknowledged.
   */
  record(
    kind: EntityKind,
    id: string,
    fields: object,
    options?: { heldBy?: string },
  ): Promise<void>;
  /** At most `limit` entries, held ones excluded unless `includeHeld`, in `seq` order. */
  pending(
    limit: number,
    options?: { includeHeld?: boolean },
  ): Promise<PendingChange[]>;
  /** Removes the entries the server applied. */
  acknowledge(changeIds: string[]): Promise<void>;
  /** Held entries of this undo offer become pending. */
  release(heldBy: string): Promise<void>;
  /** At startup: every held entry becomes pending (the app was killed during an offer). */
  releaseAll(): Promise<void>;
  /** Undo: deletes the held entries, so the server never sees them. */
  discard(heldBy: string): Promise<void>;
  /** The number of pending entries, held ones excluded. */
  count(): Promise<number>;
}
