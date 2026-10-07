import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import { DataFromNewerVersion } from './src/application/ports/data-from-newer-version';
import { AppErrorBoundary } from './src/adapters/ui/components/app-error-boundary';
import { LoadingState } from './src/adapters/ui/components/LoadingState';
import { Navigation } from './src/adapters/ui/navigation';
import { ScreenTrackingReporter } from './src/adapters/ui/screen-tracking-reporter';
import { FullScreen } from './src/adapters/ui/screens/FullScreen';
import { StartupError } from './src/adapters/ui/screens/StartupError';
import { UpdateRequired } from './src/adapters/ui/screens/UpdateRequired';
import { AppStoreProvider } from './src/adapters/ui/state/app-store-provider';
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

/**
 * Starts the app and shows where it is (contracts/ui-screens.md#app-startup-fr-039): loading,
 * the app, or a full-screen error. "Réessayer" runs the composition root again from the start,
 * after closing the database; nothing is deleted or reset (research R18a, R13a). Each start
 * closes its app when it ends (a retry, an unmount, StrictMode or Fast Refresh running the effect
 * again), and the next start waits for that close, so one connection at a time holds the file.
 */
export default function App() {
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
    setStartup({ status: 'starting' });
    setAttempt((count) => count + 1);
  };

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      {renderStartup(startup, reporter, restart)}
    </ThemeProvider>
  );
}

const renderStartup = (
  startup: Startup,
  reporter: ScreenTrackingReporter,
  restart: () => void,
) => {
  switch (startup.status) {
    case 'starting':
      return (
        <FullScreen>
          <LoadingState />
        </FullScreen>
      );
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
