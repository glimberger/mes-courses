import { Component, createContext, type ReactNode } from 'react';

import { CrashError } from '../screens/CrashError';
import type { ScreenTrackingReporter } from '../screen-tracking-reporter';

/** Reports a failure while a screen draws, with that screen's route, and shows `CrashError`. */
type Crash = (error: unknown, screen: string) => void;

const CrashContext = createContext<Crash | null>(null);

type Props = {
  errorReporter: ScreenTrackingReporter;
  /** Starts the app again, as after a startup failure. */
  onRetry: () => void;
  children: ReactNode;
};

/**
 * Catches an error thrown while the app draws, reports it with the route shown, and shows
 * `CrashError` in place of the whole app (FR-039a, research R13a). It never rethrows. A screen
 * wrapped in `ScreenErrorBoundary` reports with its own route instead, even when it fails on its
 * first render, before the navigation records it as shown.
 */
export class AppErrorBoundary extends Component<Props, { crashed: boolean }> {
  override state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  private readonly crash: Crash = (error, screen) => {
    this.props.errorReporter.report(error, { operation: 'render', screen });
    this.setState({ crashed: true });
  };

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
      <CrashContext.Provider value={this.crash}>
        {this.props.children}
      </CrashContext.Provider>
    );
  }
}

type ScreenFailure = { failure: { error: unknown } | null };

/**
 * Catches an error thrown while the screen `screen` draws and hands it to the `AppErrorBoundary`
 * above, which reports it with that route. Without one above, it rethrows.
 */
export class ScreenErrorBoundary extends Component<
  { screen: string; children: ReactNode },
  ScreenFailure
> {
  static override contextType = CrashContext;

  override state: ScreenFailure = { failure: null };

  static getDerivedStateFromError(error: unknown): ScreenFailure {
    return { failure: { error } };
  }

  private get crash() {
    return this.context as Crash | null;
  }

  override componentDidCatch(error: unknown) {
    this.crash?.(error, this.props.screen);
  }

  override render() {
    const { failure } = this.state;
    if (failure === null) return this.props.children;
    if (this.crash === null) throw failure.error;
    return null;
  }
}
