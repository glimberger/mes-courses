import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture, StoryScenario } from '../testing/story-store';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { Navigation } from '../navigation';
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
  renderWithStore(
    <>
      <CatalogScreen />
      <UndoSnackbar />
    </>,
    { seed, ...scenario },
  );

const lait = 'article-lait' as ArticleId;

const chooseFor = async (name: string, entry: 'Modifier' | 'Supprimer') => {
  fireEvent.press(
    await screen.findByRole('button', { name: `Actions pour ${name}` }),
  );
  fireEvent.press(screen.getByText(entry));
};

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

  it('has the extended button "Nouvel article"', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    expect(
      screen.getByRole('button', { name: 'Nouvel article' }),
    ).toBeOnTheScreen();
  });

  it('"Nouvel article" creates in the catalog only: the new article shows with no badge, the current list is unchanged', async () => {
    const { unitOfWork } = await renderWithStore(
      <Navigation errorReporter={new RecordingErrorReporter()} />,
      { seed, asScreen: false },
    );
    fireEvent.press(await screen.findByRole('tab', { name: 'Articles' }));
    fireEvent.press(
      await screen.findByRole('button', { name: 'Nouvel article' }),
    );

    expect(screen.queryByLabelText('Quantité')).not.toBeOnTheScreen();
    fireEvent.changeText(await screen.findByLabelText('Nom'), 'Cumin');
    fireEvent.press(screen.getByRole('radio', { name: 'Boissons' }));
    fireEvent.press(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByText('Cumin')).toBeOnTheScreen();
    expect(screen.getByLabelText('Cumin')).toBeOnTheScreen();
    expect(
      await unitOfWork.run((repos) =>
        repos.items.forList('list-ma-liste' as ListId),
      ),
    ).toHaveLength(fixture.items.length);
  });
});

describe('Catalog row menu', () => {
  it('AC3 AC4 opens a menu with "Modifier" and "Supprimer" from the ⋮ button of a row', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    fireEvent.press(screen.getByRole('button', { name: 'Actions pour Lait' }));

    expect(screen.getByText('Modifier')).toBeOnTheScreen();
    expect(screen.getByText('Supprimer')).toBeOnTheScreen();
  });

  it('AC3 "Modifier" opens the edit dialog for that article, saying it is on 2 listes', async () => {
    await renderScreen();
    await screen.findByLabelText('Lait, dans 2 listes');

    await chooseFor('Lait', 'Modifier');

    expect(await screen.findByText("Modifier l'article")).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Lait');
    expect(
      screen.getByText('Ce changement s’applique à 2 listes.'),
    ).toBeOnTheScreen();
  });

  it('AC3 the edit dialog says the article is in no list for an unused article', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    await chooseFor('Beurre', 'Modifier');

    expect(
      await screen.findByText('Cet article n’est dans aucune liste.'),
    ).toBeOnTheScreen();
  });

  it('AC3 saving a new name shows it on the row, which keeps its badge', async () => {
    const { unitOfWork } = await renderScreen();
    await screen.findByLabelText('Lait, dans 2 listes');
    await chooseFor('Lait', 'Modifier');

    fireEvent.changeText(await screen.findByLabelText('Nom'), 'Lait entier');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(
      await screen.findByLabelText('Lait entier, dans 2 listes'),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Modifier l'article")).not.toBeOnTheScreen();
    expect(
      (await unitOfWork.run((repos) => repos.articles.findById(lait)))?.name,
    ).toBe('Lait entier');
  });

  it('AC4 "Supprimer" asks first, saying the article leaves 2 listes', async () => {
    await renderScreen();
    await screen.findByLabelText('Lait, dans 2 listes');

    await chooseFor('Lait', 'Supprimer');

    expect(await screen.findByText('Supprimer « Lait » ?')).toBeOnTheScreen();
    expect(
      screen.getByText('L’article sera retiré de 2 listes.'),
    ).toBeOnTheScreen();
  });

  it('AC4 "Annuler" in the dialog deletes nothing', async () => {
    const { unitOfWork } = await renderScreen();
    await screen.findByLabelText('Lait, dans 2 listes');
    await chooseFor('Lait', 'Supprimer');
    await screen.findByText('Supprimer « Lait » ?');

    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() =>
      expect(screen.queryByText('Supprimer « Lait » ?')).toBeNull(),
    );
    expect(
      await unitOfWork.run((repos) => repos.articles.findById(lait)),
    ).not.toBeNull();
  });

  it('AC4 confirming deletes the article, then "Annuler" in the snackbar restores it with its badge', async () => {
    const { unitOfWork } = await renderScreen();
    await screen.findByLabelText('Lait, dans 2 listes');
    await chooseFor('Lait', 'Supprimer');
    await screen.findByText('Supprimer « Lait » ?');

    fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    expect(await screen.findByText('« Lait » supprimé')).toBeOnTheScreen();
    // A boolean, so a failed poll does not format the whole tree and outlast the timeout.
    await waitFor(() =>
      expect(screen.queryByLabelText(/^Lait, dans/) === null).toBe(true),
    );
    expect(
      await unitOfWork.run((repos) => repos.articles.findById(lait)),
    ).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    expect(
      await screen.findByLabelText('Lait, dans 2 listes'),
    ).toBeOnTheScreen();
    expect(
      await unitOfWork.run((repos) => repos.articles.findById(lait)),
    ).not.toBeNull();
  });

  it('AC4 the category of a deleted article is hidden once empty', async () => {
    await renderScreen();
    await screen.findByText('Beurre');
    await chooseFor('Pommes', 'Supprimer');
    await screen.findByText('Supprimer « Pommes » ?');

    fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

    await screen.findByText('« Pommes » supprimé');
    expect(screen.queryByText('Pommes')).not.toBeOnTheScreen();
    expect(screen.queryByText('Fruits et légumes')).not.toBeOnTheScreen();
  });
});
