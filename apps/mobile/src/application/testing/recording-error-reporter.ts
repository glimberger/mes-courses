import type { ErrorContext, ErrorReporter } from '../ports/error-reporter';

/**
 * Keeps in memory, in order, everything given to it, so tests can assert it. It records every
 * report: dropping repeats is the Sentry adapter's job. `screens` holds each screen given, and
 * `null` for each `clearScreen`.
 */
export class RecordingErrorReporter implements ErrorReporter {
  readonly reports: { error: unknown; context: ErrorContext }[] = [];
  readonly screens: (string | null)[] = [];
  nativeCrashes = 0;

  report(error: unknown, context: ErrorContext): void {
    this.reports.push({ error, context });
  }

  setScreen(screen: string): void {
    this.screens.push(screen);
  }

  clearScreen(): void {
    this.screens.push(null);
  }

  crashNatively(): void {
    this.nativeCrashes += 1;
  }
}
