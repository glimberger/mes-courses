/** Releases the lock; safe to call twice. */
export type ReleaseLock = () => Promise<void>;

export interface AgentLock {
  /** The release function when this process now holds the lock, `null` when another one does. */
  tryAcquire(): Promise<ReleaseLock | null>;
}
