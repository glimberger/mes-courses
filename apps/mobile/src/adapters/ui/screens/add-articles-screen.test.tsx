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
    await screen.findByText('Beurre');
  });

  it('shows "Ajouter des articles" in the Appbar and the search field "Rechercher un article"', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

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

    // "Lait", "Pommes" and "Farine" were on the list when the screen opened: hidden, and "Fruits
    // et légumes", left with none, is not shown.
    expect(
      shownInOrder([
        ...shownCategories,
        'Pommes',
        'Beurre',
        'Lait',
        'Farine',
        'Pâte',
      ]),
    ).toEqual(['Crèmerie', 'Beurre', 'Épicerie salée', 'Pâte', 'Boissons']);
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

    for (const query of ['p', 'pâ', 'pât']) {
      search(query);
      expect(screen.queryByLabelText('Chargement')).not.toBeOnTheScreen();
      expect(screen.getByText('Pâte')).toBeOnTheScreen();
    }

    expect(run).not.toHaveBeenCalled();
  });

  it('AC3 hides the articles on the list when the screen opened', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    for (const name of ['Lait', 'Pommes', 'Farine']) {
      expect(screen.queryByText(name)).not.toBeOnTheScreen();
    }
    expect(
      screen.getByRole('button', { name: 'Ajouter Beurre' }),
    ).toBeOnTheScreen();
  });

  it('AC1 a tap adds the article with no quantity and no dialog, and marks the row', async () => {
    const { unitOfWork } = await renderScreen();

    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter Beurre' }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'Beurre ajoutée, toucher pour retirer',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ajouter' })).toBeNull();
    expect(screen.getByText('Ajouter des articles')).toBeOnTheScreen();
    expect(
      await unitOfWork.run((repos) =>
        repos.items.find(maListe, 'article-beurre' as ArticleId),
      ),
    ).toMatchObject({ inCart: false, quantity: null });
  });

  it('AC1 adds several articles in a row, the screen staying open', async () => {
    const { unitOfWork } = await renderScreen();

    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter Beurre' }),
    );
    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter Pâte' }),
    );

    await screen.findByRole('button', {
      name: 'Pâte ajoutée, toucher pour retirer',
    });
    expect(
      await unitOfWork.run((repos) => repos.items.forList(maListe)),
    ).toHaveLength(fixture.items.length + 2);
  });

  it('AC2 a second tap takes the article off the list, quietly, and the row stays shown', async () => {
    const { unitOfWork, store } = await renderScreen();
    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter Beurre' }),
    );
    fireEvent.press(
      await screen.findByRole('button', {
        name: 'Beurre ajoutée, toucher pour retirer',
      }),
    );

    expect(
      await screen.findByRole('button', { name: 'Ajouter Beurre' }),
    ).toBeOnTheScreen();
    expect(
      await unitOfWork.run((repos) =>
        repos.items.find(maListe, 'article-beurre' as ArticleId),
      ),
    ).toBeNull();
    expect(store.getState().pendingUndo).toBeNull();
    expect(screen.queryByText(/retiré de la liste/)).toBeNull();

    // And it can be added once more.
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter Beurre' }));
    expect(
      await screen.findByRole('button', {
        name: 'Beurre ajoutée, toucher pour retirer',
      }),
    ).toBeOnTheScreen();
  });

  it('AC5 announces "Ajouter Beurre", then "Beurre ajoutée, toucher pour retirer" for the same row', async () => {
    await renderScreen();

    const row = await screen.findByRole('button', { name: 'Ajouter Beurre' });
    expect(row).toHaveAccessibleName('Ajouter Beurre');
    fireEvent.press(row);

    expect(
      await screen.findByRole('button', {
        name: 'Beurre ajoutée, toucher pour retirer',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ajouter Beurre' })).toBeNull();
  });

  it('AC5 every row of the catalog has one announced label, "Ajouter <name>" until added', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    expect(
      screen
        .getAllByRole('button', { name: /^Ajouter / })
        .map((node) => node.props.accessibilityLabel as string),
    ).toEqual(['Ajouter Beurre', 'Ajouter Pâte']);
  });

  it('AC3 a search matching only a hidden article says it is already on the list, with no action', async () => {
    await renderScreen();
    await screen.findByText('Beurre');

    search('lait');

    expect(
      screen.getByText('« Lait » est déjà dans la liste'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Aucun article ne correspond/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Créer «/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Lait/ })).toBeNull();
  });

  it('AC3 a search matching a shown and a hidden article lists the shown one only', async () => {
    const withLaitier = {
      ...seed,
      articles: [
        ...seed.articles,
        {
          id: 'article-lait-ribot' as ArticleId,
          name: 'Lait ribot',
          categoryId: farine.categoryId,
        },
      ],
    };
    await renderScreen({ seed: withLaitier });
    await screen.findByText('Beurre');

    search('lait');

    expect(screen.getByText('Lait ribot')).toBeOnTheScreen();
    expect(screen.queryByText(/déjà dans la liste/)).toBeNull();
  });

  it('AC3 an article added during the visit stays shown when searched', async () => {
    await renderScreen();
    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter Beurre' }),
    );
    await screen.findByRole('button', {
      name: 'Beurre ajoutée, toucher pour retirer',
    });

    search('beur');

    expect(
      screen.getByRole('button', {
        name: 'Beurre ajoutée, toucher pour retirer',
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/déjà dans la liste/)).toBeNull();
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

  describe('creating an article from the add screen', () => {
    const createKefir = async () => {
      const rendered = await openFromCurrentList();
      search('kéfir');
      fireEvent.press(screen.getByRole('button', { name: 'Créer « kéfir »' }));
      await screen.findByLabelText('Nom');
      return rendered;
    };

    it('AC4 opens CreateArticle with the name filled in, to create and add', async () => {
      await createKefir();

      expect(screen.getByLabelText('Nom')).toHaveDisplayValue('kéfir');
      expect(
        screen.getByRole('button', { name: 'Créer et ajouter' }),
      ).toBeOnTheScreen();
    });

    it('AC4 on return, the new article is shown marked as added, and a tap takes it off the list', async () => {
      const { unitOfWork } = await createKefir();
      fireEvent.press(screen.getByRole('radio', { name: 'Crèmerie' }));
      fireEvent.press(screen.getByRole('button', { name: 'Créer et ajouter' }));

      const added = await screen.findByRole('button', {
        name: 'kéfir ajoutée, toucher pour retirer',
      });
      expect(screen.getByText('Ajouter des articles')).toBeOnTheScreen();
      expect(
        await unitOfWork.run((repos) => repos.items.forList(maListe)),
      ).toHaveLength(fixture.items.length + 1);

      fireEvent.press(added);

      expect(
        await screen.findByRole('button', { name: 'Ajouter kéfir' }),
      ).toBeOnTheScreen();
      expect(
        await unitOfWork.run((repos) => repos.items.forList(maListe)),
      ).toHaveLength(fixture.items.length);
    });

    it('AC3 going back from the creation without saving changes nothing', async () => {
      const { unitOfWork } = await createKefir();

      fireEvent.press(screen.getByRole('button', { name: 'Retour' }));

      expect(await screen.findByText('Ajouter des articles')).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Créer « kéfir »' }),
      ).toBeOnTheScreen();
      expect(
        await unitOfWork.run((repos) => repos.items.forList(maListe)),
      ).toHaveLength(fixture.items.length);
    });
  });

  describe('with no network (Principle VII)', () => {
    const realFetch = global.fetch;
    const offlineFetch = jest.fn(() => {
      throw new TypeError('Network request failed');
    });
    beforeEach(() => {
      offlineFetch.mockClear();
      global.fetch = offlineFetch as unknown as typeof fetch;
    });
    afterEach(() => {
      global.fetch = realFetch;
    });

    it('AC1 AC2 adds and removes an article with no error shown, reported or fetched', async () => {
      const { unitOfWork, errorReporter } = await renderScreen({
        connected: {
          serverUrl: 'https://courses.example.fr',
          lastSyncAt: null,
        },
      });

      fireEvent.press(
        await screen.findByRole('button', { name: 'Ajouter Beurre' }),
      );
      const added = await screen.findByRole('button', {
        name: 'Beurre ajoutée, toucher pour retirer',
      });
      expect(
        await unitOfWork.run((repos) =>
          repos.items.find(maListe, 'article-beurre' as ArticleId),
        ),
      ).not.toBeNull();
      fireEvent.press(added);
      expect(
        await screen.findByRole('button', { name: 'Ajouter Beurre' }),
      ).toBeOnTheScreen();

      expect(
        screen.queryByText("La modification n'a pas pu être enregistrée."),
      ).toBeNull();
      expect(errorReporter.reports).toEqual([]);
      expect(offlineFetch).not.toHaveBeenCalled();
    });
  });

  it('AC1 AC2 a list made current while the add screen is open resets the Courses stack, and the screen opens again on that list', async () => {
    await openFromCurrentList();
    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter Beurre' }),
    );
    await screen.findByRole('button', {
      name: 'Beurre ajoutée, toucher pour retirer',
    });

    fireEvent.press(screen.getByRole('tab', { name: 'Listes' }));
    fireEvent.press(
      await screen.findByRole('button', { name: /^Barbecue, 0/ }),
    );

    expect(await screen.findByText('Votre liste est vide')).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        screen.queryAllByPlaceholderText('Rechercher un article', {
          includeHiddenElements: true,
        }),
      ).toHaveLength(0),
    );
    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter des articles' }),
    );
    // The list is empty: nothing is hidden, and the earlier addition is not carried over.
    expect(
      await screen.findByRole('button', { name: 'Ajouter Lait' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Ajouter Beurre' }),
    ).toBeOnTheScreen();
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

  it('AC6 offers no "Modifier" and no "Supprimer": rows have no menu', async () => {
    await openFromCurrentList();

    expect(
      screen.queryByRole('button', { name: /Plus d'actions pour/ }),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /Actions pour/ }),
    ).not.toBeOnTheScreen();
  });
});
