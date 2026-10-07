import type {
  ErrorContext,
  ErrorReporter,
} from '../../application/ports/error-reporter';

/**
 * Prints reports to the console. Used when no Sentry DSN is set (development, Jest, Detox), so
 * nothing reaches the real service (research R13).
 */
export class ConsoleErrorReporter implements ErrorReporter {
  private screen: string | undefined;

  report(error: unknown, context: ErrorContext): void {
    console.error(
      'Error report',
      { operation: context.operation, screen: context.screen ?? this.screen },
      error,
    );
  }

  setScreen(screen: string): void {
    this.screen = screen;
  }

  clearScreen(): void {
    this.screen = undefined;
  }

  crashNatively(): void {
    console.error('Native crash requested: no crash without Sentry');
  }
}
