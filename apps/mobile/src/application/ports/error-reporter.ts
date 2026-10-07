/** Fixed technical identifiers only, never names, quantities or list content (Principle VIII). */
export type ErrorContext = { operation: string; screen?: string };

export interface ErrorReporter {
  /** Never throws and never blocks. */
  report(error: unknown, context: ErrorContext): void;
  /** Records the route shown, carried by later reports that name no screen. */
  setScreen(screen: string): void;
  /** Forgets the route recorded: later reports that name no screen carry none, until `setScreen`. */
  clearScreen(): void;
  /** Crashes the app in native code; used only by the smoke test of a release build. */
  crashNatively(): void;
}
