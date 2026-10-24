import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

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
  it('opens on CurrentList, showing the current list, on the Courses tab', async () => {
    await renderNavigation();

    expect(await screen.findByText('Ma liste')).toBeOnTheScreen();
    expect(
      screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel),
    ).toEqual(['Courses', 'Listes', 'Articles', 'Réglages']);
    expect(screen.getByRole('tab', { name: 'Courses' })).toBeSelected();
  });

  it('opens each tab on the root of its stack', async () => {
    await renderNavigation();
    await screen.findByText('Ma liste');

    fireEvent.press(screen.getByRole('tab', { name: 'Listes' }));
    expect(await screen.findByText('Barbecue')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Listes' })).toBeSelected();

    fireEvent.press(screen.getByRole('tab', { name: 'Articles' }));
    expect(await screen.findByText('Beurre')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Articles' })).toBeSelected();

    fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));
    expect(await screen.findByText('Apparence')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Réglages' })).toBeSelected();
  });

  it('keeps the history of a tab when another tab is shown, then back', async () => {
    await renderNavigation();
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    await screen.findByText('Ajouter des articles');

    fireEvent.press(screen.getByRole('tab', { name: 'Listes' }));
    await screen.findByText('Barbecue');
    fireEvent.press(screen.getByRole('tab', { name: 'Courses' }));

    expect(await screen.findByText('Ajouter des articles')).toBeOnTheScreen();
  });

  it('returns to the root of the stack when the selected tab is pressed again', async () => {
    await renderNavigation();
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    await screen.findByText('Ajouter des articles');

    fireEvent.press(screen.getByRole('tab', { name: 'Courses' }));

    await waitFor(() =>
      expect(screen.queryByText('Ajouter des articles')).not.toBeOnTheScreen(),
    );
    expect(screen.getByText('Ma liste')).toBeOnTheScreen();
  });

  it('shows a notice of the store in the root NoticeSnackbar', async () => {
    const { store } = await renderNavigation();

    act(() => store.setState({ notice: { type: 'writeFailed' } }));

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
  });

  it('FR-030 gives the reporter the screen shown, not its tab, once the navigation is ready, then each route shown', async () => {
    const { errorReporter } = await renderNavigation();
    await screen.findByText('Ma liste');

    expect(errorReporter.screens).toEqual(['CurrentList']);

    fireEvent.press(screen.getByRole('tab', { name: 'Listes' }));
    await screen.findByText('Barbecue');
    expect(errorReporter.screens).toEqual(['CurrentList', 'Lists']);

    fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));
    await screen.findByText('Apparence');
    expect(errorReporter.screens).toEqual(['CurrentList', 'Lists', 'Settings']);
  });
});
