import type {
  ErrorContext,
  ErrorReporter,
} from '../../application/ports/error-reporter';

/**
 * Forwards everything to `reporter`, and keeps the last screen the navigation recorded, which
 * a failure while drawing names (FR-039a).
 */
export class ScreenTrackingReporter implements ErrorReporter {
  private shown: string | undefined;

  constructor(private readonly reporter: ErrorReporter) {}

  /** The route shown, once the navigation has recorded one. */
  get screen(): string | undefined {
    return this.shown;
  }

  report(error: unknown, context: ErrorContext): void {
    this.reporter.report(error, context);
  }

  setScreen(screen: string): void {
    this.shown = screen;
    this.reporter.setScreen(screen);
  }

  crashNatively(): void {
    this.reporter.crashNatively();
  }
}
