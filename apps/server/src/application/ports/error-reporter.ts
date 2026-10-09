/** Fixed technical identifiers only, never request content (research R15, Principle VIII). */
export type ErrorContext = { operation: string; route: string };

export interface ErrorReporter {
  /** Never throws and never blocks. */
  report(error: unknown, context: ErrorContext): void;
  /** Waits for pending reports to be sent; used before a crash exit. */
  flush?(): Promise<void>;
}
