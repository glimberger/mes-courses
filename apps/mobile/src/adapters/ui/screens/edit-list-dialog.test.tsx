import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ListId } from '../../../domain/shopping-list';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { EditListDialog } from './EditListDialog';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

const barbecue = 'list-barbecue' as ListId;

/** The dialog as a screen holds it: open on "Barbecue" until it closes. */
const Host = ({
  onClose,
  id = barbecue,
}: {
  onClose: () => void;
  id?: ListId;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <EditListDialog
        list={open ? { id, name: 'Barbecue' } : null}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
      <NoticeSnackbar />
    </>
  );
};

const renderDialog = async (
  scenario: StoryScenario = {},
  id: ListId = barbecue,
) => {
  const onClose = jest.fn();
  const rendered = await renderWithStore(<Host onClose={onClose} id={id} />, {
    seed: fixture,
    ...scenario,
  });
  await screen.findByText('Modifier la liste');
  const storedName = () =>
    rendered.unitOfWork.run(
      async (repos) => (await repos.lists.findById(barbecue))?.name,
    );
  return { ...rendered, onClose, storedName };
};

const type = (text: string) =>
  fireEvent.changeText(screen.getByLabelText('Nom'), text);

const save = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

describe('EditListDialog', () => {
  it('is titled "Modifier la liste", shows the name pre-filled, with "Annuler" and "Enregistrer"', async () => {
    await renderDialog();

    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Barbecue');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Enregistrer' }),
    ).toBeOnTheScreen();
  });

  it('US1-1 "Enregistrer" renames the list and closes the dialog', async () => {
    const { storedName, onClose } = await renderDialog();

    type('Barbecue dimanche');
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await storedName()).toBe('Barbecue dimanche');
    expect(screen.queryByText('Modifier la liste')).toBeNull();
  });

  it('US1-4 a name another list has shows "Une liste porte déjà ce nom." and the dialog stays open', async () => {
    const { storedName, onClose } = await renderDialog();

    type(' ma liste ');
    save();

    expect(
      await screen.findByText('Une liste porte déjà ce nom.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue(' ma liste ');
    expect(onClose).not.toHaveBeenCalled();
    expect(await storedName()).toBe('Barbecue');
  });

  it('US1-6 says "Indiquez un nom." for a blank name', async () => {
    const { storedName } = await renderDialog();

    type('   ');
    save();

    expect(await screen.findByText('Indiquez un nom.')).toBeOnTheScreen();
    expect(await storedName()).toBe('Barbecue');
  });

  it('"Annuler" closes the dialog and keeps the name', async () => {
    const { storedName, onClose } = await renderDialog();

    type('Autre');
    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await storedName()).toBe('Barbecue');
  });

  it('keeps the dialog open as typed, with the failed save notice, when the save throws', async () => {
    const { errorReporter, onClose } = await renderDialog({
      failing: ['renameList'],
    });

    type('Autre');
    save();

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Autre');
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(errorReporter.reports).toEqual([
        { error: expect.any(Error), context: { operation: 'renameList' } },
      ]),
    );
  });

  it('closes without a message when the list is gone', async () => {
    // The list the dialog was opened on vanished before the save.
    const { onClose } = await renderDialog({}, 'list-gone' as ListId);

    type('Autre');
    save();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText("La modification n'a pas pu être enregistrée."),
    ).toBeNull();
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
