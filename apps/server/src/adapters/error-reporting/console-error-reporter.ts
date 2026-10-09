import type {
  ErrorContext,
  ErrorReporter,
} from '../../application/ports/error-reporter';

/** Prints reports to the console. Used when no `SENTRY_DSN` is set (research R15). */
export class ConsoleErrorReporter implements ErrorReporter {
  report(error: unknown, context: ErrorContext): void {
    console.error(
      'Error report',
      { operation: context.operation, route: context.route },
      error,
    );
  }
}
