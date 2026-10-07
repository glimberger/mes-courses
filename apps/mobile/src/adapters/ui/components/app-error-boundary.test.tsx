import { fireEvent, screen } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { Navigation } from '../navigation';
import { ScreenTrackingReporter } from '../screen-tracking-reporter';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import { AppErrorBoundary } from './app-error-boundary';

const mockFailure = new Error('render failure');
let mockFailingTitle: string | null = null;
jest.mock('../screens/PlaceholderScreen', () => {
  const actual = jest.requireActual<
    typeof import('../screens/PlaceholderScreen')
  >('../screens/PlaceholderScreen');
  return {
    PlaceholderScreen: (
      props: Parameters<typeof actual.PlaceholderScreen>[0],
    ) => {
      if (props.title === mockFailingTitle) throw mockFailure;
      return actual.PlaceholderScreen(props);
    },
  };
});

const crashed = 'Une erreur est survenue.';

describe('AppErrorBoundary', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    // React logs every error a boundary catches.
    consoleError = jest.spyOn(console, 'error').mockImplementation();
  });
  afterEach(() => {
    consoleError.mockRestore();
    mockFailingTitle = null;
  });

  const renderApp = async () => {
    const recording = new RecordingErrorReporter();
    const reporter = new ScreenTrackingReporter(recording);
    await renderWithStore(
      <AppErrorBoundary errorReporter={reporter} onRetry={() => undefined}>
        <Navigation errorReporter={reporter} />
      </AppErrorBoundary>,
      { seed: fixture, asScreen: false },
    );
    await screen.findByText('Ma liste');
    return recording;
  };

  it('FR-039a reports a screen failing on its first render with its own route, not the one shown before', async () => {
    const recording = await renderApp();
    mockFailingTitle = 'Mes listes';

    fireEvent.press(screen.getByRole('button', { name: 'Mes listes' }));

    expect(await screen.findByText(crashed)).toBeOnTheScreen();
    expect(recording.reports).toEqual([
      { error: mockFailure, context: { operation: 'render', screen: 'Lists' } },
    ]);
  });
});
