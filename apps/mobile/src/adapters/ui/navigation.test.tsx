import { Keyboard, Platform } from 'react-native';
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

  describe('while the keyboard is open', () => {
    const listeners = new Map<string, () => void>();
    const emit = (event: string) => act(() => listeners.get(event)?.());

    beforeEach(() => {
      listeners.clear();
      jest
        .spyOn(Keyboard, 'addListener')
        .mockImplementation((event, listener) => {
          listeners.set(event, listener as () => void);
          return { remove: () => listeners.delete(event) } as ReturnType<
            typeof Keyboard.addListener
          >;
        });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('hides the tab bar on Android, and shows it again when the keyboard closes', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await renderNavigation();
      await screen.findByText('Ma liste');

      emit('keyboardDidShow');
      expect(screen.queryByRole('tab', { name: 'Courses' })).toBeNull();

      emit('keyboardDidHide');
      expect(screen.getByRole('tab', { name: 'Courses' })).toBeOnTheScreen();
    });

    it('keeps the tab bar on iOS', async () => {
      jest.replaceProperty(Platform, 'OS', 'ios');
      await renderNavigation();
      await screen.findByText('Ma liste');

      emit('keyboardDidShow');

      expect(screen.getByRole('tab', { name: 'Courses' })).toBeOnTheScreen();
    });
  });

  it('shows no "Retour" on the root of the Listes, Articles and Réglages tabs', async () => {
    await renderNavigation();
    await screen.findByText('Ma liste');

    fireEvent.press(screen.getByRole('tab', { name: 'Listes' }));
    await screen.findByText('Barbecue');
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Articles' }));
    await screen.findByText('Beurre');
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Réglages' }));
    await screen.findByText('Apparence');
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();
  });

  it('shows "Retour" on a screen pushed in a stack, going back to the screen below', async () => {
    await renderNavigation();
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    await screen.findByText('Ajouter des articles');

    fireEvent.press(screen.getByRole('button', { name: 'Retour' }));

    expect(await screen.findByText('Ma liste')).toBeOnTheScreen();
  });

  it('opens SignIn above the Settings root when the Réglages tab was never opened, so back lands on Settings', async () => {
    const { store } = await renderNavigation();
    await screen.findByText('Ma liste');
    act(() =>
      store.setState({
        sync: {
          ...store.getState().sync,
          connection: 'signedOut',
          signedOutReason: 'revoked',
        },
      }),
    );

    fireEvent.press(screen.getByRole('button', { name: 'Se reconnecter' }));
    await screen.findByLabelText('Adresse e-mail');
    fireEvent.press(screen.getByRole('button', { name: 'Retour' }));

    expect(await screen.findByText('Apparence')).toBeOnTheScreen();
  });

  it('keeps the search of the Articles tab apart from the one of AddArticles', async () => {
    await renderNavigation();
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    await screen.findByText('Beurre');
    fireEvent.changeText(
      screen.getByPlaceholderText('Rechercher un article'),
      'Lait',
    );
    await waitFor(() => expect(screen.queryByText('Beurre')).toBeNull());

    fireEvent.press(screen.getByRole('tab', { name: 'Articles' }));
    expect(await screen.findByText('Beurre')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Rechercher un article')).toHaveProp(
      'value',
      '',
    );
    fireEvent.changeText(
      screen.getByPlaceholderText('Rechercher un article'),
      'Farine',
    );
    await waitFor(() => expect(screen.queryByText('Beurre')).toBeNull());

    fireEvent.press(screen.getByRole('tab', { name: 'Courses' }));
    expect(await screen.findByText('Lait')).toBeOnTheScreen();
    expect(screen.queryByText('Farine')).toBeNull();
    expect(screen.queryByText('Beurre')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: 'Articles' }));
    expect(await screen.findByText('Farine')).toBeOnTheScreen();
    expect(screen.queryByText('Lait')).toBeNull();
  });

  it('clears the search of AddArticles when it is left, without clearing the one of the Articles tab', async () => {
    await renderNavigation();
    await screen.findByText('Ma liste');
    fireEvent.press(screen.getByRole('tab', { name: 'Articles' }));
    await screen.findByText('Beurre');
    fireEvent.changeText(
      screen.getByPlaceholderText('Rechercher un article'),
      'Farine',
    );
    await waitFor(() => expect(screen.queryByText('Beurre')).toBeNull());

    fireEvent.press(screen.getByRole('tab', { name: 'Courses' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByText('Beurre')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    await screen.findByText('Ma liste');

    fireEvent.press(screen.getByRole('tab', { name: 'Articles' }));
    expect(await screen.findByText('Farine')).toBeOnTheScreen();
    expect(screen.queryByText('Beurre')).toBeNull();
  });
});
