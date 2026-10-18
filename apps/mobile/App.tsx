import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from 'react-native-paper';
import * as Font from 'expo-font';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { KvAppearanceStore } from './src/adapters/preferences/kv-appearance-store';
import { DataFromNewerVersion } from './src/application/ports/data-from-newer-version';
import { AppErrorBoundary } from './src/adapters/ui/components/app-error-boundary';
import { Navigation } from './src/adapters/ui/navigation';
import { ScreenTrackingReporter } from './src/adapters/ui/screen-tracking-reporter';
import { StartupError } from './src/adapters/ui/screens/StartupError';
import { StartupSplash } from './src/adapters/ui/screens/StartupSplash';
import { UpdateRequired } from './src/adapters/ui/screens/UpdateRequired';
import { AppStoreProvider } from './src/adapters/ui/state/app-store-provider';
import { nunitoFontFiles } from './src/adapters/ui/theme/fonts';
import { ThemeProvider } from './src/adapters/ui/theme/theme-provider';
import {
  composeApp,
  createErrorReporter,
  type ComposedApp,
} from './src/composition/composition-root';

type Startup =
  | { status: 'starting' }
  | { status: 'ready'; app: ComposedApp }
  | { status: 'failed' }
  | { status: 'tooOld' };

// Read synchronously by the ThemeProvider on its first render, before the database opens.
const appearanceStore = new KvAppearanceStore();

/** The status bar icons follow the theme in use, not only the system scheme. */
const ThemedStatusBar = () => (
  <StatusBar style={useTheme().dark ? 'light' : 'dark'} />
);

/**
 * The composition root is the only readiness gate: starting lasts until
 * composeApp() settles, then the app is ready or one of the two existing
 * failure presentations is selected. Retry returns to starting and runs the
 * same composition flow again; there is no timer, navigation route, or
 * network readiness check in this state machine.
 */

/**
 * Starts the app and shows where it is (contracts/ui-screens.md#app-startup-fr-039): loading,
 * the app, or a full-screen error. "Réessayer" runs the composition root again from the start,
 * after closing the database; nothing is deleted or reset (research R18a, R13a). Each start
 * closes its app when it ends (a retry, an unmount, StrictMode or Fast Refresh running the effect
 * again), and the next start waits for that close, so one connection at a time holds the file.
 */
export default function App() {
  // Bundle Nunito for the brand typeface and the Material Symbols icons; load lazily so the startup splash
  // and the starting/ready/failed/tooOld lifecycle keep their existing gate.
  useEffect(() => {
    Font.loadAsync({
      ...nunitoFontFiles,
    }).catch(() => undefined);
  }, []);

  // Built first, so a failure at startup can be reported.
  const [reporter] = useState(
    () => new ScreenTrackingReporter(createErrorReporter()),
  );
  const [startup, setStartup] = useState<Startup>({ status: 'starting' });

  // Bumped by "Réessayer" to run the composition root again.
  const [attempt, setAttempt] = useState(0);
  // Settles once the app of the previous start, if any, is closed.
  const previousClosed = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    const starting = previousClosed.current.then(() => composeApp(reporter));
    starting.then(
      (app) => {
        if (live) setStartup({ status: 'ready', app });
      },
      (error: unknown) => {
        if (!live) return;
        if (error instanceof DataFromNewerVersion) {
          // Expected, and nothing a retry changes (FR-040): shown, not reported.
          setStartup({ status: 'tooOld' });
        } else {
          reporter.report(error, { operation: 'startup' });
          setStartup({ status: 'failed' });
        }
      },
    );
    return () => {
      live = false;
      // A failure to close is no reason not to start again.
      previousClosed.current = starting
        .then((app) => app.close())
        .catch(() => undefined);
    };
  }, [reporter, attempt]);

  const restart = () => {
    // The screen of the app that ends is not the one of a failure of the next start.
    reporter.clearScreen();
    setStartup({ status: 'starting' });
    setAttempt((count) => count + 1);
  };

  return (
    <ThemeProvider appearanceStore={appearanceStore}>
      <ThemedStatusBar />
      {renderStartup(startup, reporter, restart)}
    </ThemeProvider>
  );
}

const renderStartup = (
  startup: Startup,
  reporter: ScreenTrackingReporter,
  restart: () => void,
) => {
  // Keep these branches mutually exclusive so the startup lifecycle remains
  // starting -> ready, failed, or tooOld without changing the existing retry
  // and update-required behavior.
  switch (startup.status) {
    case 'starting':
      return <StartupSplash />;
    case 'failed':
      return <StartupError onRetry={restart} />;
    case 'tooOld':
      return <UpdateRequired />;
    case 'ready':
      return (
        <AppStoreProvider store={startup.app.store}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <AppErrorBoundary errorReporter={reporter} onRetry={restart}>
              <Navigation errorReporter={reporter} />
            </AppErrorBoundary>
          </SafeAreaProvider>
        </AppStoreProvider>
      );
  }
};
