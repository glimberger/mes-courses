import { KeyboardAvoidingView } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { Navigation } from '../navigation';
import { seed as appSeed } from '../seed';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture } from '../testing/story-store';
import { CreateArticleScreen } from './CreateArticleScreen';

const maListe = 'list-ma-liste' as ListId;
const beurre = 'article-beurre' as ArticleId;

/** The fixture with four categories only, so every section of AddArticles fits Jest's rows. */
const fewCategories: Fixture = {
  ...fixture,
  categories: fixture.categories.filter((category) =>
    ['Fruits et légumes', 'Crèmerie', 'Épicerie salée', 'Boissons'].includes(
      category.name,
    ),
  ),
};

/** CreateArticle alone, opened with no name and no category. */
const renderScreen = async (seed: Fixture = fixture) => {
  const rendered = await renderWithStore(<CreateArticleScreen />, { seed });
  await screen.findByRole('radio', { name: 'Boissons' });
  const stored = (articleId: ArticleId) =>
    rendered.unitOfWork.run((repos) => repos.items.find(maListe, articleId));
  return { ...rendered, stored };
};

/** The app, opened on CreateArticle from "Nouvel article" on AddArticles. */
const openFromAddArticles = async (seed: Fixture = fewCategories) => {
  const rendered = await renderWithStore(
    <Navigation errorReporter={new RecordingErrorReporter()} />,
    { seed, asScreen: false },
  );
  fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Nouvel article' }),
  );
  await screen.findByRole('radio', { name: 'Boissons' });
  const stored = (articleId: ArticleId) =>
    rendered.unitOfWork.run((repos) => repos.items.find(maListe, articleId));
  return { ...rendered, stored };
};

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

const choose = (category: string) =>
  fireEvent.press(screen.getByRole('radio', { name: category }));

const create = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Créer et ajouter' }));

describe('CreateArticle', () => {
  it('shows "Nouvel article", the "Nom" field, every category in order, the quantity and "Créer et ajouter"', async () => {
    await renderScreen();

    expect(screen.getByText('Nouvel article')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('');
    expect(
      screen
        // The named items, not the radio each one draws inside it.
        .getAllByRole('radio', { name: /.+/ })
        .map((radio) => radio.props.accessibilityLabel as string),
    ).toEqual(appSeed.categoryNames);
    expect(screen.getByLabelText('Quantité')).toBeOnTheScreen();
    expect(screen.getByLabelText('Unité')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Créer et ajouter' }),
    ).toBeOnTheScreen();
  });

  it('FR-018 chooses no category when opened from "Nouvel article"', async () => {
    await renderScreen();

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
  });

  it('US2-7 creates "Houmous" in "Épicerie salée", adds it, goes back to AddArticles and confirms it', async () => {
    const { stored } = await openFromAddArticles();

    type('Nom', 'Houmous');
    choose('Épicerie salée');
    create();

    expect(await screen.findByText('« Houmous » ajouté')).toBeOnTheScreen();
    expect(screen.queryByText('Nouvel article')).not.toBeOnTheScreen();
    expect(
      await screen.findByRole('button', {
        name: 'Houmous, déjà dans la liste',
      }),
    ).toBeOnTheScreen();
    expect(await stored('id-1' as ArticleId)).toMatchObject({
      inCart: false,
      quantity: null,
    });
  });

  it('US2-7 adds the new article with the quantity typed', async () => {
    const { stored } = await openFromAddArticles();

    type('Nom', 'Houmous');
    choose('Épicerie salée');
    type('Quantité', '2');
    type('Unité', 'pots');
    create();

    await screen.findByText('« Houmous » ajouté');
    expect(await stored('id-1' as ArticleId)).toMatchObject({
      quantity: { amount: 2, unit: 'pots' },
    });
  });

  it('US2-11 asks for a name', async () => {
    await renderScreen();

    type('Nom', '   ');
    choose('Boissons');
    create();

    expect(await screen.findByText('Indiquez un nom.')).toBeOnTheScreen();
  });

  it('FR-022 refuses a name of 61 characters', async () => {
    await renderScreen();

    type('Nom', 'a'.repeat(61));
    choose('Boissons');
    create();

    expect(
      await screen.findByText('Le nom ne peut pas dépasser 60 caractères.'),
    ).toBeOnTheScreen();
  });

  it('asks for a category when none is chosen, creating nothing', async () => {
    const { unitOfWork } = await renderScreen();

    type('Nom', 'Houmous');
    create();

    expect(
      await screen.findByText('Choisissez une catégorie.'),
    ).toBeOnTheScreen();
    expect(await unitOfWork.run((repos) => repos.articles.all())).toHaveLength(
      fixture.articles.length,
    );
  });

  it('FR-016 shows a quantity error, creating nothing', async () => {
    const { unitOfWork } = await renderScreen();

    type('Nom', 'Houmous');
    choose('Boissons');
    type('Unité', 'kg');
    create();

    expect(
      await screen.findByText('Indiquez une quantité pour cette unité.'),
    ).toBeOnTheScreen();
    expect(await unitOfWork.run((repos) => repos.articles.all())).toHaveLength(
      fixture.articles.length,
    );
  });

  it('US2-9 says "« Beurre » existe déjà." and "Ajouter « Beurre »" adds it with the quantity typed', async () => {
    const { stored } = await openFromAddArticles();

    type('Nom', ' beurre ');
    choose('Crèmerie');
    type('Quantité', '500');
    type('Unité', 'g');
    create();

    expect(
      await screen.findByText('« Beurre » existe déjà.'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Ajouter « Beurre »' }));

    expect(await screen.findByText('« Beurre » ajouté')).toBeOnTheScreen();
    expect(await stored(beurre)).toMatchObject({
      inCart: false,
      quantity: { amount: 500, unit: 'g' },
    });
  });

  it('US2-20 FR-011 "Ajouter « Beurre »" opens the already-on-list mode, prefilled with "250 g", adding nothing', async () => {
    const { stored } = await renderScreen({
      ...fixture,
      items: [
        ...fixture.items,
        {
          listId: maListe,
          articleId: beurre,
          inCart: false,
          quantity: { amount: 250, unit: 'g' },
        },
      ],
    });

    type('Nom', 'Beurre');
    choose('Crèmerie');
    type('Quantité', '500');
    type('Unité', 'g');
    create();
    fireEvent.press(
      await screen.findByRole('button', { name: 'Ajouter « Beurre »' }),
    );

    expect(
      await screen.findByText('« Beurre » est déjà dans la liste.'),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getAllByLabelText('Quantité').at(-1)).toHaveDisplayValue(
        '250',
      ),
    );
    expect(screen.getAllByLabelText('Unité').at(-1)).toHaveDisplayValue('g');
    expect(await stored(beurre)).toMatchObject({
      quantity: { amount: 250, unit: 'g' },
    });
  });

  it('keeps "Créer et ajouter" in sight on iOS while the user types', async () => {
    await renderScreen();

    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(
      'padding',
    );
  });

  it('clears the notice shown when it opens, so the snackbar never covers "Créer et ajouter"', async () => {
    const { store } = await renderWithStore(<CreateArticleScreen />, {
      seed: fixture,
      prepare: async (actions) => {
        await actions.loadCurrentList();
        await actions.addArticleToList({ id: beurre, name: 'Beurre' }, null);
      },
    });

    await waitFor(() => expect(store.getState().notice).toBeNull());
  });
});
