import { act, fireEvent, screen } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { ListsScreen } from './ListsScreen';

const barbecue = 'list-barbecue' as ListId;
const lait = 'article-lait' as ArticleId;

const renderScreen = (scenario: StoryScenario = {}) =>
  renderWithStore(<ListsScreen />, { seed: fixture, ...scenario });

/** The app on the fixture, opened on CurrentList. */
const renderApp = async () => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: fixture, asScreen: false },
  );
  await screen.findByText('Ma liste');
  return rendered;
};

const row = (name: string) => screen.findByRole('button', { name });

describe('Lists', () => {
  it('shows "Mes listes" in the Appbar', async () => {
    await renderScreen();

    expect(screen.getByText('Mes listes')).toBeOnTheScreen();
  });

  it('US3-7 FR-029 shows LoadingState while the lists load, requested when the screen opens', async () => {
    await renderScreen({ pending: ['getLists'] });

    expect(await screen.findByLabelText('Chargement')).toBeOnTheScreen();
  });

  it('US3-7 shows the error with "Réessayer", reports it, and loads again when retried', async () => {
    const { errorReporter } = await renderScreen({ failing: ['getLists'] });

    expect(
      await screen.findByText('Impossible de charger vos listes.'),
    ).toBeOnTheScreen();
    // The app's reporter adds the screen shown, Lists (contracts/driven-ports.md).
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'getLists' } },
    ]);

    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await screen.findByText('Impossible de charger vos listes.');
    expect(errorReporter.reports).toHaveLength(2);
  });

  it('US3-8 shows each list with its name and item count, the current one marked "Liste actuelle"', async () => {
    await renderScreen();

    expect(await screen.findByText('Barbecue')).toBeOnTheScreen();
    expect(screen.getByText('0 articles')).toBeOnTheScreen();
    expect(screen.getByText('Ma liste')).toBeOnTheScreen();
    expect(screen.getByText('4 articles')).toBeOnTheScreen();
    expect(screen.getAllByText('Liste actuelle')).toHaveLength(1);
  });

  it('US3-8 says "1 article" for a list holding one item', async () => {
    await renderScreen({
      seed: { ...fixture, items: fixture.items.slice(0, 1) },
    });

    expect(await screen.findByText('1 article')).toBeOnTheScreen();
  });

  it('US3-8 lists the lists by name: "Barbecue" before "Ma liste"', async () => {
    await renderScreen();
    await screen.findByText('Barbecue');

    expect(
      screen
        .getAllByRole('button', { name: /articles?/ })
        .map((button) => button.props.accessibilityLabel as string),
    ).toEqual(['Barbecue, 0 articles', 'Ma liste, 4 articles, liste actuelle']);
  });

  it('FR-032 reads each row as one label: "Barbecue, 0 articles, liste actuelle"', async () => {
    await renderScreen({ seed: { ...fixture, currentListId: barbecue } });

    expect(await row('Barbecue, 0 articles, liste actuelle')).toBeOnTheScreen();
    expect(await row('Ma liste, 4 articles')).toBeOnTheScreen();
  });

  it('US3-3 FR-002 tapping a list makes it current and goes back to CurrentList, which shows it', async () => {
    const { unitOfWork } = await renderApp();
    fireEvent.press(screen.getByRole('button', { name: 'Mes listes' }));

    fireEvent.press(await row('Barbecue, 0 articles'));

    expect(await screen.findByText('Votre liste est vide')).toBeOnTheScreen();
    expect(screen.getByText('Barbecue')).toBeOnTheScreen();
    expect(screen.queryByText('Nouvelle liste')).not.toBeOnTheScreen();
    expect(
      await unitOfWork.run((repos) => repos.appState.currentListId()),
    ).toBe(barbecue);
  });

  it('FR-025 tapping the current list goes back to CurrentList, saving nothing, and the "Annuler" offer stays', async () => {
    const { store, useCases } = await renderApp();
    const setCurrentList = jest.spyOn(useCases, 'setCurrentList');
    await act(() => store.getState().removeItem(lait));
    await screen.findByText('« Lait » retiré de la liste');
    fireEvent.press(screen.getByRole('button', { name: 'Mes listes' }));

    fireEvent.press(await row('Ma liste, 3 articles, liste actuelle'));

    expect(
      await screen.findByRole('button', { name: 'Ajouter' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Nouvelle liste')).not.toBeOnTheScreen();
    expect(setCurrentList).not.toHaveBeenCalled();
    expect(store.getState().pendingUndo).not.toBeNull();
    expect(screen.getByText('« Lait » retiré de la liste')).toBeOnTheScreen();
  });

  it('SC-005 chooses another list in two taps from CurrentList: "Mes listes", then the list', async () => {
    await renderApp();

    fireEvent.press(screen.getByRole('button', { name: 'Mes listes' }));
    fireEvent.press(await row('Barbecue, 0 articles'));

    expect(await screen.findByText('Votre liste est vide')).toBeOnTheScreen();
    expect(screen.getByText('Barbecue')).toBeOnTheScreen();
  });
});
