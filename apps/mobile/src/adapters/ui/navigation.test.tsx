import { act, fireEvent, screen } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../application/testing/recording-error-reporter';
import { Navigation } from './navigation';
import { fixture } from './testing/fixtures';
import { renderWithStore } from './testing/render-with-store';

const renderNavigation = async () => {
  const errorReporter = new RecordingErrorReporter();
  const rendered = await renderWithStore(
    <Navigation errorReporter={errorReporter} />,
    { seed: fixture, asScreen: false },
  );
  return { ...rendered, errorReporter };
};

describe('Navigation', () => {
  it('opens on CurrentList, showing the current list', async () => {
    await renderNavigation();

    expect(await screen.findByText('Ma liste')).toBeOnTheScreen();
  });

  it('shows a notice of the store in the root NoticeSnackbar', async () => {
    const { store } = await renderNavigation();

    act(() => store.setState({ notice: { type: 'writeFailed' } }));

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
  });

  it('FR-030 gives the reporter CurrentList once the navigation is ready, then each route shown', async () => {
    const { errorReporter } = await renderNavigation();
    await screen.findByText('Ma liste');

    expect(errorReporter.screens).toEqual(['CurrentList']);

    fireEvent.press(screen.getByRole('button', { name: 'Mes listes' }));

    await screen.findByText('Mes listes');
    expect(errorReporter.screens).toEqual(['CurrentList', 'Lists']);
  });
});
