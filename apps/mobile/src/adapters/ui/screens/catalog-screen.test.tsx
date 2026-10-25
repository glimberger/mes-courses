import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture, StoryScenario } from '../testing/story-store';
import { CatalogScreen } from './CatalogScreen';

const shownCategories = [
  'Fruits et légumes',
  'Crèmerie',
  'Épicerie salée',
  'Boissons',
];

/**
 * The fixture with four categories, so every section fits the rows Jest draws: "Boissons" is
 * empty; "Lait", "Pommes" and "Farine" are on "Ma liste", "Beurre" is on no list.
 */
const seed: Fixture = {
  ...fixture,
  categories: fixture.categories.filter((category) =>
    shownCategories.includes(category.name),
  ),
  // "Lait" is on the second list too.
  items: [
    ...fixture.items,
    {
      listId: 'list-barbecue' as ListId,
      articleId: 'article-lait' as ArticleId,
      inCart: false,
      quantity: null,
    },
  ],
};

const renderScreen = (scenario: StoryScenario = {}) =>
  renderWithStore(<CatalogScreen />, { seed, ...scenario });

const search = (text: string) =>
  fireEvent.changeText(
    screen.getByPlaceholderText('Rechercher un article'),
    text,
  );

describe('Catalog', () => {
  it('AC1 groups the articles under their category headers, empty categories hidden', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    expect(
      screen.getAllByTestId('category-header').map((header) => header.props),
    ).toHaveLength(3);
    expect(screen.getByText('Crèmerie')).toBeOnTheScreen();
    expect(screen.getByText('Fruits et légumes')).toBeOnTheScreen();
    expect(screen.getByText('Épicerie salée')).toBeOnTheScreen();
    expect(screen.queryByText('Boissons')).not.toBeOnTheScreen();
    expect(
      screen.queryByText('Aucun article dans cette catégorie'),
    ).not.toBeOnTheScreen();
  });

  it('AC1 filters the articles as the user types', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    search('beur');

    expect(screen.getByText('Beurre')).toBeOnTheScreen();
    expect(screen.queryByText('Pommes')).not.toBeOnTheScreen();
    expect(screen.queryByText('Crèmerie')).toBeOnTheScreen();
    expect(screen.queryByText('Fruits et légumes')).not.toBeOnTheScreen();
  });

  it('AC1 says no article matches, with no offer to add it to a list', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    search('xyz');

    expect(
      await screen.findByText('Aucun article ne correspond à « xyz »'),
    ).toBeOnTheScreen();
  });

  it('AC2 shows the number of lists on each row and hides the badge at 0', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    expect(
      await screen.findByLabelText('Lait, dans 2 listes'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Pommes, dans 1 liste')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Beurre, dans/)).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Beurre')).toBeOnTheScreen();
  });

  it('AC2 reads the counts with one batch read, not one read per article', async () => {
    const { store } = await renderScreen();
    await screen.findByLabelText('Lait, dans 2 listes');

    expect(store.getState().usageCounts.status).toBe('success');
  });

  it('shows LoadingState while the catalog loads', async () => {
    await renderScreen({ pending: ['getCatalog'] });

    expect(await screen.findByLabelText('Chargement')).toBeOnTheScreen();
  });

  it('shows the error with "Réessayer" when the catalog cannot be read', async () => {
    const { errorReporter } = await renderScreen({ failing: ['getCatalog'] });

    expect(
      await screen.findByText('Impossible de charger les articles.'),
    ).toBeOnTheScreen();
    expect(errorReporter.reports.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
  });

  it('shows the rows without badges when the counts cannot be read', async () => {
    await renderScreen({ failing: ['getArticleUsageCounts'] });

    expect(await screen.findByText('Beurre')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.queryByLabelText(/, dans \d/)).not.toBeOnTheScreen(),
    );
  });

  it('says the catalog is empty when it holds no article', async () => {
    await renderScreen({
      seed: {
        ...seed,
        articles: [],
        items: [],
        currentListId: seed.currentListId,
      },
    });

    expect(await screen.findByText('Aucun article')).toBeOnTheScreen();
  });
});
