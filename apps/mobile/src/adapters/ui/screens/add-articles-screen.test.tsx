import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture, StoryScenario } from '../testing/story-store';
import { AddArticlesScreen } from './AddArticlesScreen';

const maListe = 'list-ma-liste' as ListId;

const shownCategories = [
  'Fruits et légumes',
  'Crèmerie',
  'Épicerie salée',
  'Boissons',
];

/**
 * The fixture with four categories only, so every section fits the rows Jest draws: "Boissons"
 * is empty, "Lait", "Pommes" and "Farine" are on "Ma liste", "Beurre" and "Pâte" are not.
 */
const farine = fixture.articles.find((article) => article.name === 'Farine');
if (!farine) throw new Error('No Farine in the fixture');

const seed: Fixture = {
  ...fixture,
  categories: fixture.categories.filter((category) =>
    shownCategories.includes(category.name),
  ),
  articles: [
    ...fixture.articles,
    {
      id: 'article-pate' as ArticleId,
      name: 'Pâte',
      categoryId: farine.categoryId,
    },
  ],
};

const renderScreen = (scenario: StoryScenario = {}) =>
  renderWithStore(
    <>
      <AddArticlesScreen />
      <NoticeSnackbar />
    </>,
    { seed, ...scenario },
  );

/** The app on this seed, opened on AddArticles from the FAB of the current list. */
const openFromCurrentList = async () => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed, asScreen: false },
  );
  fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
  await screen.findByText('Beurre');
  return rendered;
};

const search = (text: string) =>
  fireEvent.changeText(
    screen.getByPlaceholderText('Rechercher un article'),
    text,
  );

/** The article names and section headings shown, in screen order. */
const shownInOrder = (texts: string[]) =>
  screen
    .getAllByText(new RegExp(`^(${texts.join('|')})$`))
    .map((node) => node.props.children as string);

describe('AddArticles', () => {
  it('shows "Ajouter des articles" in the Appbar and the search field "Rechercher un article"', async () => {
    await renderScreen();

    expect(screen.getByText('Ajouter des articles')).toBeOnTheScreen();
    expect(
      screen.getByPlaceholderText('Rechercher un article'),
    ).toBeOnTheScreen();
  });

  it('US2-17 FR-029 shows LoadingState while the catalog loads, requested when the screen opens', async () => {
    await renderScreen({ pending: ['getCatalog'] });

    expect(await screen.findByLabelText('Chargement')).toBeOnTheScreen();
  });

  it('US2-18 shows the error with "Réessayer", reports it, and loads again when retried', async () => {
    const { errorReporter } = await renderScreen({ failing: ['getCatalog'] });

    expect(
      await screen.findByText('Impossible de charger les articles.'),
    ).toBeOnTheScreen();
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'getCatalog' } },
    ]);

    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(errorReporter.reports).toHaveLength(2));
  });

  it('US2-15 shows every category with its articles, and an empty one with "Créer un article"', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    expect(
      shownInOrder([...shownCategories, 'Pommes', 'Beurre', 'Lait', 'Farine']),
    ).toEqual([
      'Fruits et légumes',
      'Pommes',
      'Crèmerie',
      'Beurre',
      'Lait',
      'Épicerie salée',
      'Farine',
      'Boissons',
    ]);
    expect(
      screen.getByText('Aucun article dans cette catégorie'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Créer un article' }),
    ).toBeOnTheScreen();
  });

  it('US2-15 FR-018 "Créer un article" opens CreateArticle with that category chosen', async () => {
    await openFromCurrentList();

    fireEvent.press(screen.getByRole('button', { name: 'Créer un article' }));

    expect(await screen.findByText('Nouvel article')).toBeOnTheScreen();
    expect(
      await screen.findByRole('radio', { name: 'Boissons' }),
    ).toBeChecked();
  });

  it('US2-10 shows the matches grouped by category as the user types', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    search('pâ');

    expect(shownInOrder([...shownCategories, 'Pâte', 'Beurre'])).toEqual([
      'Épicerie salée',
      'Pâte',
    ]);
  });

  it('US2-10 FR-009 shows the full catalog, not the no-match state, for a search of spaces', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    search('   ');

    expect(screen.getByText('Beurre')).toBeOnTheScreen();
    expect(screen.getByText('Boissons')).toBeOnTheScreen();
    expect(screen.queryByText(/Aucun article ne correspond/)).toBeNull();
  });

  it('US2-14 says nothing matches, offering to create the article', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    search('xyz');

    expect(
      screen.getByText('Aucun article ne correspond à « xyz »'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Créer « xyz »' }),
    ).toBeOnTheScreen();
  });

  it('SC-011 FR-029 R11a filters each letter typed with no LoadingState and no use case called', async () => {
    const { unitOfWork } = await renderScreen();
    await screen.findByText('Beurre');
    const run = jest.spyOn(unitOfWork, 'run');

    for (const query of ['p', 'po', 'pom']) {
      search(query);
      expect(screen.queryByLabelText('Chargement')).not.toBeOnTheScreen();
      expect(screen.getByText('Pommes')).toBeOnTheScreen();
    }

    expect(run).not.toHaveBeenCalled();
  });

  it('US2-8 marks the articles already on the list', async () => {
    await renderScreen();

    expect(
      await screen.findByRole('button', { name: 'Lait, déjà dans la liste' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Beurre' })).toBeOnTheScreen();
  });

  it('US2-8 FR-011 tapping an article on the list opens the already-on-list mode, adding nothing', async () => {
    const { unitOfWork } = await renderScreen();

    fireEvent.press(
      await screen.findByRole('button', { name: 'Lait, déjà dans la liste' }),
    );

    expect(
      await screen.findByText('« Lait » est déjà dans la liste.'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(
      await unitOfWork.run((repos) => repos.items.forList(maListe)),
    ).toHaveLength(fixture.items.length);
  });

  it('US2-1 SC-003 adds an article with a tap and "Ajouter", staying open and confirming it', async () => {
    const { unitOfWork } = await renderScreen();

    fireEvent.press(await screen.findByRole('button', { name: 'Beurre' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('« Beurre » ajouté')).toBeOnTheScreen();
    expect(
      await screen.findByRole('button', { name: 'Beurre, déjà dans la liste' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Ajouter des articles')).toBeOnTheScreen();
    expect(
      await unitOfWork.run((repos) =>
        repos.items.find(maListe, 'article-beurre' as ArticleId),
      ),
    ).toMatchObject({ inCart: false, quantity: null });
  });

  describe('"Nouvel article"', () => {
    it('US2-19 is offered with and without matches', async () => {
      await renderScreen();
      await screen.findByText('Beurre');
      expect(
        screen.getByRole('button', { name: 'Nouvel article' }),
      ).toBeOnTheScreen();

      search('pom');
      expect(
        screen.getByRole('button', { name: 'Nouvel article' }),
      ).toBeOnTheScreen();

      search('xyz');
      expect(
        screen.getByRole('button', { name: 'Nouvel article' }),
      ).toBeOnTheScreen();
    });

    it('US2-19 FR-008 FR-022 with "Pâte" found by " pâté ", opens CreateArticle named "pâté", with no category chosen', async () => {
      await openFromCurrentList();

      search(' pâté ');
      expect(screen.getByText('Pâte')).toBeOnTheScreen();
      fireEvent.press(screen.getByRole('button', { name: 'Nouvel article' }));

      expect(await screen.findByLabelText('Nom')).toHaveDisplayValue('pâté');
      for (const radio of screen.getAllByRole('radio')) {
        expect(radio).not.toBeChecked();
      }
    });

    it('US2-14 "Créer « xyz »" opens CreateArticle named "xyz"', async () => {
      await openFromCurrentList();

      search('xyz');
      fireEvent.press(screen.getByRole('button', { name: 'Créer « xyz »' }));

      expect(await screen.findByLabelText('Nom')).toHaveDisplayValue('xyz');
    });
  });

  it('clears the search when the screen is left, so it opens on the whole catalog the next time', async () => {
    const { store, unmount } = await renderScreen();
    await screen.findByText('Beurre');
    search('xyz');

    unmount();

    expect(store.getState().catalog.query).toBe('');
    expect(store.getState().catalog.view.status).toBe('success');
  });
});
