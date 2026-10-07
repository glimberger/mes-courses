import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import App from './App';
import { DataFromNewerVersion } from './src/application/ports/data-from-newer-version';
import { RecordingErrorReporter } from './src/application/testing/recording-error-reporter';
import type { AppStore, Notice } from './src/adapters/ui/state/app-store';
import { fixture } from './src/adapters/ui/testing/fixtures';
import { createStoryStore } from './src/adapters/ui/testing/story-store';
import {
  composeApp,
  type ComposedApp,
} from './src/composition/composition-root';

let mockReporter: RecordingErrorReporter;
jest.mock('./src/composition/composition-root', () => ({
  composeApp: jest.fn(),
  createErrorReporter: () => mockReporter,
}));

const compose = jest.mocked(composeApp);

/** A promise the test settles, to see what the app shows while it is pending. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** What the composition root gives on a start that succeeds. */
const started = async (): Promise<ComposedApp & { store: AppStore }> => ({
  store: await createStoryStore({ seed: fixture }),
  close: jest.fn(() => Promise.resolve()),
});

const startupFailed = "L'application n'a pas pu démarrer.";
const tooOld =
  "Cette version de l'application est trop ancienne pour vos données. Mettez-la à jour.";
const crashed = 'Une erreur est survenue.';

const currentList = () => screen.findByText('Ma liste');
const retry = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

beforeEach(() => {
  mockReporter = new RecordingErrorReporter();
  compose.mockReset();
});

describe('App startup', () => {
  it('FR-039 shows LoadingState while the app starts, then CurrentList', async () => {
    const start = deferred<ComposedApp>();
    compose.mockReturnValueOnce(start.promise);

    render(<App />);

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
    await waitFor(() => expect(compose).toHaveBeenCalledTimes(1));
    await act(async () => start.resolve(await started()));
    expect(await currentList()).toBeOnTheScreen();
    expect(mockReporter.reports).toEqual([]);
  });

  it('FR-039 shows StartupError when the start fails, and reports it once', async () => {
    const failure = new Error('database locked');
    compose.mockRejectedValueOnce(failure);

    render(<App />);

    expect(await screen.findByText(startupFailed)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    expect(mockReporter.reports).toEqual([
      { error: failure, context: { operation: 'startup' } },
    ]);
  });

  it('FR-039 starts again on "Réessayer", with LoadingState, and reaches CurrentList', async () => {
    const second = deferred<ComposedApp>();
    compose
      .mockRejectedValueOnce(new Error('database locked'))
      .mockReturnValueOnce(second.promise);
    render(<App />);
    await screen.findByText(startupFailed);

    retry();

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
    await waitFor(() => expect(compose).toHaveBeenCalledTimes(2));
    await act(async () => second.resolve(await started()));
    expect(await currentList()).toBeOnTheScreen();
    expect(mockReporter.reports).toHaveLength(1);
  });

  it('FR-039 shows StartupError again, with a second report, when the new start fails too', async () => {
    compose
      .mockRejectedValueOnce(new Error('database locked'))
      .mockRejectedValueOnce(new Error('database locked'));
    render(<App />);
    await screen.findByText(startupFailed);

    retry();

    expect(await screen.findByText(startupFailed)).toBeOnTheScreen();
    expect(mockReporter.reports.map((report) => report.context)).toEqual([
      { operation: 'startup' },
      { operation: 'startup' },
    ]);
  });

  it('closes the started app when App unmounts', async () => {
    const app = await started();
    compose.mockResolvedValueOnce(app);
    const { unmount } = render(<App />);
    await currentList();

    unmount();

    await waitFor(() => expect(app.close).toHaveBeenCalledTimes(1));
  });

  it('starts again only once the app of the previous run is closed, when the effect runs twice', async () => {
    const steps: string[] = [];
    compose.mockImplementation(async () => {
      const start = steps.filter((step) => step.startsWith('start')).length;
      steps.push(`start ${start}`);
      const app = await started();
      app.close = jest.fn(async () => {
        steps.push(`close ${start}`);
      });
      return app;
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(await currentList()).toBeOnTheScreen();
    expect(steps).toEqual(['start 0', 'close 0', 'start 1']);
  });

  it('FR-040 shows UpdateRequired, with no button and no report, for data from a newer version', async () => {
    compose.mockRejectedValueOnce(new DataFromNewerVersion());

    render(<App />);

    expect(await screen.findByText(tooOld)).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(mockReporter.reports).toEqual([]);
  });
});

describe('App after a failure while drawing', () => {
  const failure = new Error('render failure');

  /** Makes the app shell throw on its next render: the notice cannot be read. */
  const breakRendering = (store: AppStore) =>
    act(() =>
      store.setState({
        notice: {
          get type(): never {
            throw failure;
          },
        } as unknown as Notice,
      }),
    );

  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    // React logs every error a boundary catches.
    consoleError = jest.spyOn(console, 'error').mockImplementation();
  });
  afterEach(() => consoleError.mockRestore());

  const startAndCrash = async () => {
    const first = await started();
    compose.mockResolvedValueOnce(first);
    render(<App />);
    await currentList();
    breakRendering(first.store);
    return first;
  };

  it('FR-039a replaces the app with CrashError and reports the failure with the route shown', async () => {
    await startAndCrash();

    expect(await screen.findByText(crashed)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
    expect(screen.queryByText('Ma liste')).not.toBeOnTheScreen();
    expect(mockReporter.reports).toEqual([
      {
        error: failure,
        context: { operation: 'render', screen: 'CurrentList' },
      },
    ]);
  });

  it('FR-039a starts again on "Réessayer", closing the database and deleting nothing, and reaches CurrentList', async () => {
    const first = await startAndCrash();
    await screen.findByText(crashed);
    const second = deferred<ComposedApp>();
    compose.mockReturnValueOnce(second.promise);

    retry();

    expect(screen.getByLabelText('Chargement')).toBeOnTheScreen();
    await act(async () => second.resolve(await started()));
    expect(await currentList()).toBeOnTheScreen();
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(compose).toHaveBeenCalledTimes(2);
  });

  it('FR-039a reports a startup failure after "Réessayer" without the screen of the app that crashed', async () => {
    await startAndCrash();
    await screen.findByText(crashed);
    const failure = new Error('database locked');
    compose.mockRejectedValueOnce(failure);

    retry();

    expect(await screen.findByText(startupFailed)).toBeOnTheScreen();
    expect(mockReporter.reports.at(-1)).toEqual({
      error: failure,
      context: { operation: 'startup' },
    });
    expect(mockReporter.screens).toEqual(['CurrentList', null]);
  });

  it('FR-039a shows CrashError again, with a second report, when the screen fails again', async () => {
    await startAndCrash();
    await screen.findByText(crashed);
    const second = await started();
    compose.mockResolvedValueOnce(second);

    retry();
    await currentList();
    breakRendering(second.store);

    expect(await screen.findByText(crashed)).toBeOnTheScreen();
    expect(mockReporter.reports.map((report) => report.context)).toEqual([
      { operation: 'render', screen: 'CurrentList' },
      { operation: 'render', screen: 'CurrentList' },
    ]);
  });
});
