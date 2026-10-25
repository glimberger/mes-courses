import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { CurrentListScreen } from './CurrentListScreen';
import { DeleteArticleDialog } from './DeleteArticleDialog';

const maListe = 'list-ma-liste' as ListId;
const lait = 'article-lait' as ArticleId;

/** What the dialog is opened with: the article and the number of lists holding it. */
const usageOn = (count: number) => ({
  article: { id: lait, name: 'Lait' },
  count,
});
type Usage = ReturnType<typeof usageOn>;

/** The dialog as a screen holds it: open on `usage` until it closes. */
const Host = ({ usage, onClose }: { usage: Usage; onClose: () => void }) => {
  const [open, setOpen] = useState(true);
  return (
    <DeleteArticleDialog
      article={open ? usage.article : null}
      count={usage.count}
      onClose={() => {
        setOpen(false);
        onClose();
      }}
    />
  );
};

/** The dialog over the fixture's "Ma liste", with the snackbar every screen shares. */
const renderDialog = async (usage: Usage, scenario: StoryScenario = {}) => {
  const onClose = jest.fn();
  const rendered = await renderWithStore(
    <>
      <CurrentListScreen />
      <Host usage={usage} onClose={onClose} />
      <NoticeSnackbar />
    </>,
    { seed: fixture, ...scenario },
  );
  await screen.findByText('Supprimer « Lait » ?');
  const stored = () =>
    rendered.unitOfWork.run((repos) => repos.articles.findById(lait));
  return { ...rendered, onClose, stored };
};

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

describe('DeleteArticleDialog', () => {
  it('shows the title "Supprimer « Lait » ?"', async () => {
    await renderDialog(usageOn(0));

    expect(screen.getByText('Supprimer « Lait » ?')).toBeOnTheScreen();
  });

  it('AC4 for no list, says the article is in none', async () => {
    await renderDialog(usageOn(0));

    expect(
      screen.getByText('L’article n’est dans aucune liste.'),
    ).toBeOnTheScreen();
  });

  it('AC4 for one list, says it leaves 1 liste', async () => {
    await renderDialog(usageOn(1));

    expect(
      screen.getByText('L’article sera retiré de 1 liste.'),
    ).toBeOnTheScreen();
  });

  it('AC4 for several lists, says how many it leaves', async () => {
    await renderDialog(usageOn(3));

    expect(
      screen.getByText('L’article sera retiré de 3 listes.'),
    ).toBeOnTheScreen();
  });

  it('US2-2 "Annuler" closes the dialog and changes nothing', async () => {
    const { onClose, stored, store } = await renderDialog(usageOn(0));

    press('Annuler');

    await waitFor(() =>
      expect(screen.queryByText('Supprimer « Lait » ?')).toBeNull(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await stored()).not.toBeNull();
    expect(store.getState().pendingUndo).toBeNull();
  });

  it('US2-1 US2-4 "Supprimer" deletes the article and closes the dialog', async () => {
    const { onClose, stored, store } = await renderDialog(usageOn(1));

    press('Supprimer');

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await stored()).toBeNull();
    expect(store.getState().pendingUndo?.kind).toBe('deletedArticle');
    await waitFor(() =>
      expect(screen.queryByText('Supprimer « Lait » ?')).toBeNull(),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('checkbox', { name: /^Lait, / }),
      ).not.toBeOnTheScreen(),
    );
  });

  it('an unexpected delete failure closes the dialog, changes nothing and shows "La modification n\'a pas pu être enregistrée."', async () => {
    const { onClose, stored, errorReporter } = await renderDialog(usageOn(1), {
      failing: ['deleteArticle'],
    });

    press('Supprimer');

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await stored()).not.toBeNull();
    expect(errorReporter.reports).toEqual([
      {
        error: expect.any(Error),
        context: expect.objectContaining({ operation: 'deleteArticle' }),
      },
    ]);
  });

  it('keeps the list in storage untouched on Annuler', async () => {
    const { unitOfWork } = await renderDialog(usageOn(1));

    press('Annuler');

    expect(
      await unitOfWork.run((repos) => repos.items.find(maListe, lait)),
    ).not.toBeNull();
  });
});
