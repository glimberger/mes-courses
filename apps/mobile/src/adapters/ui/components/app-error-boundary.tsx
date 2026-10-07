import { Component, type ReactNode } from 'react';

import { CrashError } from '../screens/CrashError';
import type { ScreenTrackingReporter } from '../screen-tracking-reporter';

type Props = {
  errorReporter: ScreenTrackingReporter;
  /** Starts the app again, as after a startup failure. */
  onRetry: () => void;
  children: ReactNode;
};

/**
 * Catches an error thrown while a screen draws, reports it with the route shown, and shows
 * `CrashError` in place of the whole app (FR-039a, research R13a). It never rethrows.
 */
export class AppErrorBoundary extends Component<Props, { crashed: boolean }> {
  override state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  override componentDidCatch(error: unknown) {
    const { errorReporter } = this.props;
    const screen = errorReporter.screen;
    errorReporter.report(error, {
      operation: 'render',
      ...(screen !== undefined && { screen }),
    });
  }

  override render() {
    return this.state.crashed ? (
      <CrashError onRetry={this.props.onRetry} />
    ) : (
      this.props.children
    );
  }
}
