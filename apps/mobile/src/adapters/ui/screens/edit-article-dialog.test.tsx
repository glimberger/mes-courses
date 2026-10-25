import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ServerRow } from '@mes-courses/sync-core';

import type { UnitOfWork } from '../../../application/ports/unit-of-work';
import type { ArticleId } from '../../../domain/article';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { fixture } from '../testing/fixtures';
import {
  OTHER_DEVICE_HLC,
  pullingSyncServer,
} from '../testing/pulling-sync-server';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture, StoryScenario } from '../testing/story-store';
import { EditArticleDialog } from './EditArticleDialog';

const lait = 'article-lait' as ArticleId;

/** The fixture with four categories only, so every radio fits the rows Jest draws. */
const seed: Fixture = {
  ...fixture,
  categories: fixture.categories.filter((category) =>
    ['Fruits et légumes', 'Crèmerie', 'Épicerie salée', 'Boissons'].includes(
      category.name,
    ),
  ),
};

const laitInFixture = seed.articles.find((article) => article.id === lait);
if (!laitInFixture) throw new Error('No Lait in the fixture');
const article = {
  id: lait,
  name: 'Lait',
  categoryId: laitInFixture.categoryId,
};

/** The dialog as a screen holds it: open on `article` until it closes. */
const Host = ({ count, onClose }: { count: number; onClose: () => void }) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <EditArticleDialog
        article={open ? article : null}
        count={count}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
      <NoticeSnackbar />
    </>
  );
};

const renderDialog = async (count = 2, scenario: StoryScenario = {}) => {
  const onClose = jest.fn();
  const rendered = await renderWithStore(
    <Host count={count} onClose={onClose} />,
    { seed, ...scenario },
  );
  await screen.findByText("Modifier l'article");
  const storedName = () =>
    rendered.unitOfWork.run(
      async (repos) => (await repos.articles.findById(lait))?.name,
    );
  const storedCategory = (unitOfWork: UnitOfWork = rendered.unitOfWork) =>
    unitOfWork.run(async (repos) => {
      const found = await repos.articles.findById(lait);
      if (!found) throw new Error('The article is gone');
      return (await repos.categories.findById(found.categoryId))?.name;
    });
  return { ...rendered, onClose, storedName, storedCategory };
};

const type = (text: string) =>
  fireEvent.changeText(screen.getByLabelText('Nom'), text);

const save = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

describe('EditArticleDialog', () => {
  it('shows the "Nom" field prefilled, the categories with the current one selected, and the buttons', async () => {
    await renderDialog();

    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Lait');
    expect(
      await screen.findByRole('radio', { name: 'Crèmerie' }),
    ).toBeChecked();
    for (const other of ['Fruits et légumes', 'Épicerie salée', 'Boissons']) {
      expect(screen.getByRole('radio', { name: other })).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Enregistrer' }),
    ).toBeOnTheScreen();
  });

  it('AC3 says the change applies to n lists', async () => {
    await renderDialog(2);

    expect(
      screen.getByText('Ce changement s’applique à 2 listes.'),
    ).toBeOnTheScreen();
  });

  it('AC3 says the change applies to 1 liste', async () => {
    await renderDialog(1);

    expect(
      screen.getByText('Ce changement s’applique à 1 liste.'),
    ).toBeOnTheScreen();
  });

  it('AC3 says the article is in no list', async () => {
    await renderDialog(0);

    expect(
      screen.getByText('Cet article n’est dans aucune liste.'),
    ).toBeOnTheScreen();
  });

  it('AC3 saving renames the article and closes the dialog', async () => {
    const { storedName, onClose } = await renderDialog();

    type('Lait demi-écrémé');
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await storedName()).toBe('Lait demi-écrémé');
    expect(screen.queryByText("Modifier l'article")).toBeNull();
    expect(
      screen.queryByText("La modification n'a pas pu être enregistrée."),
    ).toBeNull();
  });

  it('AC3 saving another category moves the article', async () => {
    const { storedCategory, storedName, onClose } = await renderDialog();

    fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' }));
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await storedCategory()).toBe('Boissons');
    expect(await storedName()).toBe('Lait');
  });

  it('refuses a taken name, shows « Beurre » existe déjà, and keeps what was typed', async () => {
    const { storedName, onClose } = await renderDialog();

    type(' beurre ');
    save();

    expect(
      await screen.findByText('Un article « Beurre » existe déjà.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue(' beurre ');
    expect(onClose).not.toHaveBeenCalled();
    expect(await storedName()).toBe('Lait');
  });

  it('a taken name with a new category changes neither', async () => {
    const { storedCategory, storedName } = await renderDialog();

    fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' }));
    type('beurre');
    save();

    await screen.findByText('Un article « Beurre » existe déjà.');
    expect(await storedCategory()).toBe('Crèmerie');
    expect(await storedName()).toBe('Lait');
  });

  it('says "Indiquez un nom." for a blank name', async () => {
    const { storedName } = await renderDialog();

    type('   ');
    save();

    expect(await screen.findByText('Indiquez un nom.')).toBeOnTheScreen();
    expect(await storedName()).toBe('Lait');
  });

  it('refuses a name over the limit', async () => {
    await renderDialog();

    type('a'.repeat(61));
    save();

    expect(
      await screen.findByText('Le nom ne peut pas dépasser 60 caractères.'),
    ).toBeOnTheScreen();
  });

  it('"Annuler" closes the dialog and changes nothing', async () => {
    const { storedName, onClose } = await renderDialog();

    type('Lait demi-écrémé');
    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await storedName()).toBe('Lait');
  });

  it('keeps the dialog open with "La modification n\'a pas pu être enregistrée." when the save throws', async () => {
    const { errorReporter, onClose } = await renderDialog(2, {
      failing: ['editArticle'],
    });

    type('Lait demi-écrémé');
    save();

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Modifier l'article")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(errorReporter.reports).toEqual([
        { error: expect.any(Error), context: { operation: 'editArticle' } },
      ]),
    );
  });

  it('AC5 a category created from "Nouvelle catégorie" is offered and selected at once', async () => {
    await renderDialog();
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
    await renderDialog(2, { pending: ['editArticle'] });

    fireEvent.press(await screen.findByRole('radio', { name: 'Boissons' }));
    save();

    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: 'Fruits et légumes' }),
      ).toBeDisabled(),
    );
    expect(screen.getByLabelText('Nom')).toBeDisabled();
  });

  describe('a pull while the dialog is open (FR-020a)', () => {
    const stamp = OTHER_DEVICE_HLC;
    const server = pullingSyncServer();
    const connectedScenario: StoryScenario = {
      connected: { serverUrl: 'https://courses.example.fr', lastSyncAt: null },
      syncServer: server.syncServer,
    };
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
      const { store, storedName } = await renderDialog(2, connectedScenario);
      type('Lait entier');

      await act(async () => {
        server.send([articleRow(false, 'Lait demi-écrémé')]);
        await store.getState().syncNow();
      });

      expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Lait entier');
      save();
      await waitFor(async () => expect(await storedName()).toBe('Lait entier'));
    });

    it('closes with "Cet article a été supprimé sur un autre appareil." when the pull deletes the article', async () => {
      const { store, onClose } = await renderDialog(2, connectedScenario);
      type('Lait entier');

      await act(async () => {
        server.send([articleRow(true)]);
        await store.getState().syncNow();
      });

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(
        await screen.findByText(
          'Cet article a été supprimé sur un autre appareil.',
        ),
      ).toBeOnTheScreen();
    });
  });
});
