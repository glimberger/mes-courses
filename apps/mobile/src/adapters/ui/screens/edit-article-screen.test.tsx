import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ServerRow } from '@mes-courses/sync-core';

import type { UnitOfWork } from '../../../application/ports/unit-of-work';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import { EditArticleScreen } from './EditArticleScreen';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import {
  OTHER_DEVICE_HLC,
  pullingSyncServer,
} from '../testing/pulling-sync-server';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture, StoryScenario } from '../testing/story-store';

const lait = 'article-lait' as ArticleId;

/** The fixture with four categories only, so every section of AddArticles fits Jest's rows. */
const seed: Fixture = {
  ...fixture,
  categories: fixture.categories.filter((category) =>
    ['Fruits et légumes', 'Crèmerie', 'Épicerie salée', 'Boissons'].includes(
      category.name,
    ),
  ),
};

/** The app, opened on EditArticle for "Lait" through the row menu of AddArticles. */
const openEditLait = async (scenario: StoryScenario = {}) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed, asScreen: false, ...scenario },
  );
  fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
  await screen.findByText('Beurre');
  fireEvent.press(
    screen.getByRole('button', { name: "Plus d'actions pour « Lait »" }),
  );
  fireEvent.press(screen.getByText('Modifier'));
  await screen.findByText("Modifier l'article");
  const storedName = () =>
    rendered.unitOfWork.run(
      async (repos) => (await repos.articles.findById(lait))?.name,
    );
  return { ...rendered, storedName };
};

const type = (text: string) =>
  fireEvent.changeText(screen.getByLabelText('Nom'), text);

const save = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

describe('EditArticle', () => {
  it('shows "Modifier l\'article" with a back action, the "Nom" field prefilled and "Enregistrer"', async () => {
    await openEditLait();

    expect(screen.getByText("Modifier l'article")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retour' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Lait');
    expect(
      screen.getByRole('button', { name: 'Enregistrer' }),
    ).toBeOnTheScreen();
  });

  it('US1-1 on success goes back to AddArticles with no snackbar, and the row shows the new name', async () => {
    const { storedName } = await openEditLait();

    type('Lait demi-écrémé');
    save();

    expect(await screen.findByText('Ajouter des articles')).toBeOnTheScreen();
    expect(await screen.findByText('Lait demi-écrémé')).toBeOnTheScreen();
    expect(screen.queryByText("Modifier l'article")).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
    expect(
      screen.queryByText("La modification n'a pas pu être enregistrée."),
    ).toBeNull();
    expect(await storedName()).toBe('Lait demi-écrémé');
  });

  it('US1-4 says "Un article « Beurre » existe déjà." for " beurre ", and keeps what was typed', async () => {
    const { storedName } = await openEditLait();

    type(' beurre ');
    save();

    expect(
      await screen.findByText('Un article « Beurre » existe déjà.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue(' beurre ');
    expect(await storedName()).toBe('Lait');
  });

  it('US1-6 says "Indiquez un nom." for a blank name, and keeps what was typed', async () => {
    const { storedName } = await openEditLait();

    type('   ');
    save();

    expect(await screen.findByText('Indiquez un nom.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('   ');
    expect(await storedName()).toBe('Lait');
  });

  it('US1-6 refuses a name over the limit and keeps what was typed', async () => {
    const { storedName } = await openEditLait();
    const tooLong = 'a'.repeat(61);

    type(tooLong);
    save();

    expect(
      await screen.findByText('Le nom ne peut pas dépasser 60 caractères.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue(tooLong);
    expect(await storedName()).toBe('Lait');
  });

  it('US1-7 changes nothing when the user goes back without saving', async () => {
    const { storedName } = await openEditLait();

    type('Lait demi-écrémé');
    fireEvent.press(screen.getByRole('button', { name: 'Retour' }));

    expect(await screen.findByText('Ajouter des articles')).toBeOnTheScreen();
    expect(screen.getByText('Lait')).toBeOnTheScreen();
    expect(await storedName()).toBe('Lait');
  });

  it('keeps the screen open with "La modification n\'a pas pu être enregistrée." and reports it when the save throws', async () => {
    const { errorReporter } = await openEditLait({ failing: ['editArticle'] });

    type('Lait demi-écrémé');
    save();

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Modifier l'article")).toBeOnTheScreen();
    await waitFor(() =>
      expect(errorReporter.reports).toEqual([
        { error: expect.any(Error), context: { operation: 'editArticle' } },
      ]),
    );
  });

  it('keeps the screen open with the same message when the article is gone (ArticleNotFound)', async () => {
    const { unitOfWork } = await openEditLait();
    await unitOfWork.run(async (repos) => {
      await repos.items.removeAllForArticle(lait);
      await repos.articles.remove(lait);
    });

    type('Lait demi-écrémé');
    save();

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Modifier l'article")).toBeOnTheScreen();
  });
});

describe('EditArticle category (US3)', () => {
  const storedCategory = (rendered: { unitOfWork: UnitOfWork }) =>
    rendered.unitOfWork.run(async (repos) => {
      const article = await repos.articles.findById(lait);
      if (!article) throw new Error('The article is gone');
      return (await repos.categories.findById(article.categoryId))?.name;
    });

  it('shows every category with the current one selected', async () => {
    await openEditLait();

    expect(
      await screen.findByRole('radio', { name: 'Crèmerie' }),
    ).toBeChecked();
    for (const other of ['Fruits et légumes', 'Épicerie salée', 'Boissons']) {
      expect(screen.getByRole('radio', { name: other })).not.toBeChecked();
    }
  });

  it('US3-1 saving another category moves the article', async () => {
    const rendered = await openEditLait();

    fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' }));
    save();

    expect(await screen.findByText('Ajouter des articles')).toBeOnTheScreen();
    expect(await storedCategory(rendered)).toBe('Boissons');
    expect(await rendered.storedName()).toBe('Lait');
  });

  it('US3-3 a taken name with a new category shows the name error and changes neither', async () => {
    const rendered = await openEditLait();

    fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' }));
    type('beurre');
    save();

    expect(
      await screen.findByText('Un article « Beurre » existe déjà.'),
    ).toBeOnTheScreen();
    expect(await storedCategory(rendered)).toBe('Crèmerie');
    expect(await rendered.storedName()).toBe('Lait');
  });

  it('US3-4 a category created from "Nouvelle catégorie" is offered and preselected', async () => {
    await openEditLait();
    await screen.findByRole('radio', { name: 'Crèmerie' });

    fireEvent.press(screen.getByRole('button', { name: 'Nouvelle catégorie' }));
    await waitFor(() =>
      expect(screen.getAllByLabelText('Nom')).toHaveLength(2),
    );
    for (const dialogField of screen.getAllByLabelText('Nom').slice(1)) {
      fireEvent.changeText(dialogField, 'Bébé');
    }
    fireEvent.press(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByRole('radio', { name: 'Bébé' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Crèmerie' })).not.toBeChecked();
  });

  it('locks the name and the categories while the save is in flight', async () => {
    await openEditLait({ pending: ['editArticle'] });

    fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' }));
    save();

    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: 'Fruits et légumes' }),
      ).toBeDisabled(),
    );
    expect(screen.getByLabelText('Nom')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Nouvelle catégorie' }),
    ).toBeDisabled();
  });

  it('SC-007 changes the category in 4 taps from the catalog', async () => {
    const rendered = await renderWithStore(
      <Navigation errorReporter={new RecordingErrorReporter()} />,
      { seed, asScreen: false },
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
    await screen.findByText('Beurre');

    fireEvent.press(
      screen.getByRole('button', { name: "Plus d'actions pour « Lait »" }),
    ); // 1
    fireEvent.press(screen.getByText('Modifier')); // 2
    fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' })); // 3
    save(); // 4

    await screen.findByText('Ajouter des articles');
    expect(await storedCategory(rendered)).toBe('Boissons');
  });
});

describe('EditArticle opened before the catalog is loaded', () => {
  it('shows no dead form, then the form once the article is found', async () => {
    const { store } = await renderWithStore(<EditArticleScreen />, {
      seed,
      routeParams: { articleId: lait },
    });

    expect(screen.getByText('Chargement…')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();

    await store.getState().loadCatalog();

    expect(await screen.findByLabelText('Nom')).toHaveDisplayValue('Lait');
  });

  it('says the article is not found when the catalog has no such article', async () => {
    const { store } = await renderWithStore(<EditArticleScreen />, {
      seed,
      routeParams: { articleId: 'article-unknown' as ArticleId },
    });
    await store.getState().loadCatalog();

    expect(
      await screen.findByText('Cet article est introuvable.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  });
});

describe('EditArticle and the "ajouté" notice', () => {
  it('clears the notice shown when it opens, so the snackbar never covers the form', async () => {
    const { store } = await renderWithStore(<EditArticleScreen />, {
      seed,
      routeParams: { articleId: lait },
      prepare: async (actions) => {
        await actions.loadCurrentList();
        await actions.loadCatalog();
        await actions.addArticleToList(
          { id: 'article-beurre' as ArticleId, name: 'Beurre' },
          null,
        );
      },
    });

    await waitFor(() => expect(store.getState().notice).toBeNull());
  });

  describe('a pull while the form is open (FR-020a)', () => {
    const stamp = OTHER_DEVICE_HLC;
    const server = pullingSyncServer();
    const connectedScenario: StoryScenario = {
      connected: { serverUrl: 'https://courses.example.fr', lastSyncAt: null },
      syncServer: server.syncServer,
    };
    const pull = (
      store: { getState: () => { syncNow: () => Promise<unknown> } },
      sent: ServerRow[],
    ) =>
      act(async () => {
        server.send(sent);
        await store.getState().syncNow();
      });
    const articleRow = (deleted: boolean, name = 'Lait'): ServerRow => ({
      kind: 'article',
      id: lait,
      seq: 1,
      fields: {
        name: { value: name, hlc: stamp },
        categoryId: { value: 'category-0', hlc: stamp },
      },
      createdHlc: stamp,
      deletedHlc: deleted ? stamp : null,
      mergedInto: null,
    });

    it('keeps the typed name when the pull changes the article', async () => {
      const { store, storedName } = await openEditLait(connectedScenario);
      type('Lait entier');

      await pull(store, [articleRow(false, 'Lait demi-écrémé')]);

      expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Lait entier');
      save();
      await waitFor(async () => expect(await storedName()).toBe('Lait entier'));
    });

    it('closes with "Cet article a été supprimé sur un autre appareil." when the pull deletes the article', async () => {
      const { store } = await openEditLait(connectedScenario);
      type('Lait entier');

      await pull(store, [articleRow(true)]);

      await waitFor(() =>
        expect(screen.queryByText("Modifier l'article")).toBeNull(),
      );
      expect(
        await screen.findByText(
          'Cet article a été supprimé sur un autre appareil.',
        ),
      ).toBeOnTheScreen();
    });
  });
});
