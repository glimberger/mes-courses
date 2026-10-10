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

import { focusOn } from '../accessibility/focus';

jest.mock('../accessibility/focus');

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
const openFromCurrentList = async (from: Fixture = seed) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed: from, asScreen: false },
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
  it('003 FR-020 renders the sync status bar under the Appbar', async () => {
    await renderScreen({
      connected: { serverUrl: 'https://courses.example.fr', lastSyncAt: null },
    });

    expect(await screen.findByTestId('sync-status-bar')).toBeOnTheScreen();
  });

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

  it('FR-009 "Effacer la recherche" empties the search and shows the whole catalog again', async () => {
    await renderScreen();
    await screen.findByText('Beurre');
    search('pâ');
    expect(screen.queryByText('Beurre')).not.toBeOnTheScreen();

    fireEvent.press(
      screen.getByRole('button', { name: 'Effacer la recherche' }),
    );

    expect(
      screen.getByPlaceholderText('Rechercher un article'),
    ).toHaveDisplayValue('');
    expect(screen.getByText('Beurre')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Effacer la recherche' }),
    ).not.toBeOnTheScreen();
  });

  it('clears the search when the screen is left, so it opens on the whole catalog the next time', async () => {
    const { store, unmount } = await renderScreen();
    await screen.findByText('Beurre');
    search('xyz');

    unmount();

    expect(store.getState().catalog.query).toBe('');
    expect(store.getState().catalog.view.status).toBe('success');
  });

  describe('"Plus d\'actions" → "Modifier" (002 US1)', () => {
    /** The app on this seed, opened on AddArticles, with the row menu of "Lait" chosen. */
    const chooseModifierFor = (name: string) => {
      fireEvent.press(
        screen.getByRole('button', { name: `Plus d'actions pour « ${name} »` }),
      );
      fireEvent.press(screen.getByText('Modifier'));
    };

    it('FR-001 opens EditArticle for that article while browsing by category', async () => {
      await openFromCurrentList();

      chooseModifierFor('Beurre');

      expect(await screen.findByText("Modifier l'article")).toBeOnTheScreen();
      expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Beurre');
    });

    it('FR-001 opens EditArticle for that article in the search results', async () => {
      await openFromCurrentList();
      search('pât');
      await screen.findByText('Pâte');

      chooseModifierFor('Pâte');

      expect(await screen.findByText("Modifier l'article")).toBeOnTheScreen();
      expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Pâte');
    });

    it('US1-3 after saving, the search results show the new name', async () => {
      await openFromCurrentList();
      search('pât');
      await screen.findByText('Pâte');
      chooseModifierFor('Pâte');
      await screen.findByText("Modifier l'article");

      fireEvent.changeText(screen.getByLabelText('Nom'), 'Pâte brisée');
      fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(await screen.findByText('Pâte brisée')).toBeOnTheScreen();
      expect(screen.queryByText('Pâte')).not.toBeOnTheScreen();
      expect(
        screen.getByPlaceholderText('Rechercher un article'),
      ).toHaveDisplayValue('pât');
    });
  });

  describe('"Plus d\'actions" → "Supprimer" (002 US2)', () => {
    const lait = 'article-lait' as ArticleId;
    const barbecue = 'list-barbecue' as ListId;
    const eau = 'article-eau' as ArticleId;
    const boissons = seed.categories.find(
      (category) => category.name === 'Boissons',
    );
    if (!boissons) throw new Error('No Boissons in the seed');

    /** "Lait" on "Ma liste" and "Barbecue", "Eau" alone in "Boissons" and on no list. */
    const deletionSeed: Fixture = {
      ...seed,
      articles: [
        ...seed.articles,
        { id: eau, name: 'Eau', categoryId: boissons.id },
      ],
      items: [
        ...seed.items,
        { listId: barbecue, articleId: lait, inCart: false, quantity: null },
      ],
    };

    const chooseSupprimerFor = (name: string) => {
      fireEvent.press(
        screen.getByRole('button', { name: `Plus d'actions pour « ${name} »` }),
      );
      fireEvent.press(screen.getByText('Supprimer'));
    };

    it('FR-006 loads the usage and opens the dialog naming the lists', async () => {
      await openFromCurrentList(deletionSeed);

      chooseSupprimerFor('Lait');

      expect(await screen.findByText('Supprimer « Lait » ?')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Il est dans les listes « Barbecue » et « Ma liste » et en sera retiré.',
        ),
      ).toBeOnTheScreen();
    });

    it('reports a failed usage load, shows writeFailed and opens no dialog', async () => {
      const rendered = await renderWithStore(
        <Navigation errorReporter={new RecordingErrorReporter()} />,
        { seed: deletionSeed, asScreen: false, failing: ['getArticleUsage'] },
      );
      fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
      await screen.findByText('Beurre');

      chooseSupprimerFor('Lait');

      expect(
        await screen.findByText("La modification n'a pas pu être enregistrée."),
      ).toBeOnTheScreen();
      expect(screen.queryByText('Supprimer « Lait » ?')).toBeNull();
      expect(rendered.errorReporter.reports).toEqual([
        {
          error: expect.any(Error),
          context: { operation: 'getArticleUsage', screen: 'AddArticles' },
        },
      ]);
    });

    it('SC-002 deletes in 3 taps: the menu, "Supprimer" and the confirmation', async () => {
      const { unitOfWork } = await openFromCurrentList(deletionSeed);

      fireEvent.press(
        screen.getByRole('button', { name: "Plus d'actions pour « Beurre »" }),
      );
      fireEvent.press(screen.getByText('Supprimer'));
      await screen.findByText('Supprimer « Beurre » ?');
      fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

      expect(await screen.findByText('« Beurre » supprimé')).toBeOnTheScreen();
      expect(
        await unitOfWork.run((repos) => repos.articles.all()),
      ).not.toContainEqual(expect.objectContaining({ name: 'Beurre' }));
      expect(screen.queryByText('Beurre')).not.toBeOnTheScreen();
    });

    it('US2-8 shows "Aucun article dans cette catégorie" for the category left empty', async () => {
      await openFromCurrentList(deletionSeed);
      expect(screen.getByText('Eau')).toBeOnTheScreen();
      // "Boissons" holds one article now, so it has no empty state yet.
      expect(
        screen.queryByText('Aucun article dans cette catégorie'),
      ).not.toBeOnTheScreen();

      chooseSupprimerFor('Eau');
      await screen.findByText('Supprimer « Eau » ?');
      fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));

      // Waits on the snackbar: a failed `toBeNull` poll on the whole tree is too slow to retry.
      await screen.findByText('« Eau » supprimé');
      expect(screen.queryByText('Eau')).toBeNull();
      expect(screen.getByText('Boissons')).toBeOnTheScreen();
      expect(
        screen.getByText('Aucun article dans cette catégorie'),
      ).toBeOnTheScreen();
    });

    it('FR-037 moves screen reader focus to the screen title once the article is deleted', async () => {
      jest.mocked(focusOn).mockClear();
      await openFromCurrentList(deletionSeed);
      chooseSupprimerFor('Eau');
      await screen.findByText('Supprimer « Eau » ?');
      fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));
      await screen.findByText('« Eau » supprimé');

      expect(
        screen.getByRole('header', { name: 'Ajouter des articles' }),
      ).toBeOnTheScreen();
      // The last focus move is the one made when the dialog closed: the row is gone, so its
      // target is the title, which is a View marked as a header.
      const target = jest.mocked(focusOn).mock.calls.at(-1)?.[0].current;
      expect(target).not.toBeNull();
      expect(target).toMatchObject({ props: { accessibilityRole: 'header' } });
    });

    it('US2-5 "Annuler" brings the article back in the catalog and on both lists', async () => {
      const { unitOfWork } = await openFromCurrentList(deletionSeed);
      chooseSupprimerFor('Lait');
      await screen.findByText('Supprimer « Lait » ?');
      fireEvent.press(screen.getByRole('button', { name: 'Supprimer' }));
      await screen.findByText('« Lait » supprimé');
      // A boolean, so a failed poll does not format the whole tree and outlast the timeout.
      await waitFor(() =>
        expect(screen.queryByText('Lait') === null).toBe(true),
      );

      fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

      expect(await screen.findByText('Lait')).toBeOnTheScreen();
      for (const listId of [maListe, barbecue]) {
        expect(
          await unitOfWork.run((repos) => repos.items.find(listId, lait)),
        ).not.toBeNull();
      }
    });
  });
});
