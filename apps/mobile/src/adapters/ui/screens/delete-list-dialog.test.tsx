import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ListId } from '../../../domain/shopping-list';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { DeleteListDialog } from './DeleteListDialog';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

const barbecue = 'list-barbecue' as ListId;
const TITLE = 'Supprimer « Barbecue » ?';

/** The dialog as a screen holds it: open on "Barbecue" until it closes. */
const Host = ({ onClose }: { onClose: () => void }) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <DeleteListDialog
        list={open ? { id: barbecue, name: 'Barbecue' } : null}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
      <NoticeSnackbar />
    </>
  );
};

const renderDialog = async (scenario: StoryScenario = {}) => {
  const onClose = jest.fn();
  const rendered = await renderWithStore(<Host onClose={onClose} />, {
    seed: fixture,
    ...scenario,
  });
  await screen.findByText(TITLE);
  const stored = () =>
    rendered.unitOfWork.run((repos) => repos.lists.findById(barbecue));
  return { ...rendered, onClose, stored };
};

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

describe('DeleteListDialog', () => {
  it('US2-1 asks "Supprimer « Barbecue » ?" and says the articles stay in the catalog', async () => {
    await renderDialog();

    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(
      screen.getByText(
        'La liste et ses articles seront supprimés. Les articles restent dans le catalogue.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeOnTheScreen();
  });

  it('US2-2 "Annuler" closes the dialog and deletes nothing', async () => {
    const { onClose, stored } = await renderDialog();

    press('Annuler');

    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await stored()).not.toBeNull();
  });

  it('US2-2 dismissing the dialog deletes nothing', async () => {
    const { onClose, stored } = await renderDialog();

    fireEvent.press(screen.getByLabelText('Fermer la boîte de dialogue'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await stored()).not.toBeNull();
  });

  it('US2-3 "Supprimer" deletes the list and closes, with no undo offer', async () => {
    const { onClose, stored, store } = await renderDialog();

    press('Supprimer');

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await stored()).toBeNull();
    expect(store.getState().pendingUndo).toBeNull();
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull();
  });

  it('deletes once and closes once on a fast double tap of "Supprimer"', async () => {
    const { onClose, useCases } = await renderDialog();
    const deleteList = jest.spyOn(useCases, 'deleteList');

    press('Supprimer');
    press('Supprimer');

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(deleteList).toHaveBeenCalledTimes(1);
  });

  it('a failed delete shows "La modification n\'a pas pu être enregistrée." and closes, keeping the list', async () => {
    const { onClose, stored } = await renderDialog({
      failing: ['deleteList'],
    });

    press('Supprimer');

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await stored()).not.toBeNull();
  });

  it('confirming a list that vanished meanwhile closes without a message', async () => {
    const { onClose, store, unitOfWork } = await renderDialog();
    await unitOfWork.run(async (repos) => {
      await repos.lists.remove(barbecue);
    });

    press('Supprimer');

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(store.getState().notice).toBeNull();
  });

  it('closes silently when a pull deletes the list', async () => {
    const { store, onClose } = await renderDialog();

    await act(async () => {
      const { sync } = store.getState();
      store.setState({
        sync: {
          ...sync,
          remote: {
            cycle: sync.remote.cycle + 1,
            effects: {
              deletedArticles: [],
              deletedLists: [barbecue],
              removedItems: [],
              merges: [],
            },
          },
        },
      });
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(store.getState().notice).toBeNull();
  });
});
