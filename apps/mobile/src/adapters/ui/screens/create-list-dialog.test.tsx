import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { focusOn } from '../accessibility/focus';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { fixture } from '../testing/fixtures';
import { recordFocusTargets } from '../testing/focus-targets';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { ListsScreen } from './ListsScreen';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

/** What each focus move went to (`recordFocusTargets`). */
let focusTargets: string[] = [];

beforeEach(() => {
  jest.mocked(focusOn).mockReset();
  focusTargets = recordFocusTargets(jest.mocked(focusOn));
});

/** Lists on the fixture: "Barbecue" and "Ma liste" (current). */
const renderScreen = async (scenario: StoryScenario = {}) => {
  const rendered = await renderWithStore(
    <>
      <ListsScreen />
      <NoticeSnackbar />
    </>,
    { seed: fixture, ...scenario },
  );
  await screen.findByText('Barbecue');
  return rendered;
};

/** The dialog's title; the FAB reads "Nouvelle liste" too, but is no header. */
const dialogTitle = () =>
  // Paper's title is a header inside the header the focus moves to.
  screen.queryAllByRole('header', { name: 'Nouvelle liste' })[0] ?? null;

const openDialog = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Nouvelle liste' }));
  await waitFor(() => expect(dialogTitle()).toBeOnTheScreen());
};

const typeName = (text: string) =>
  fireEvent.changeText(screen.getByLabelText('Nom'), text);

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

/** The row labels, in screen order. */
const rows = () =>
  screen
    .getAllByRole('button', { name: /articles?/ })
    .map((button) => button.props.accessibilityLabel as string);

describe('CreateListDialog', () => {
  it('opens from the FAB "Nouvelle liste", titled "Nouvelle liste", with "Annuler" and "Créer"', async () => {
    await renderScreen();

    await openDialog();

    expect(screen.getByLabelText('Nom')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Créer' })).toBeOnTheScreen();
  });

  it('US3-2 FR-024 creates the list empty, in its alphabetical place, and stays on Lists with "Ma liste" current', async () => {
    const { unitOfWork } = await renderScreen();
    await openDialog();
    typeName('Fête');

    press('Créer');

    await waitFor(() => expect(dialogTitle()).not.toBeOnTheScreen());
    expect(await screen.findByText('Fête')).toBeOnTheScreen();
    expect(rows()).toEqual([
      'Barbecue, 0 articles',
      'Fête, 0 articles',
      'Ma liste, 4 articles, liste actuelle',
    ]);
    expect(
      (await unitOfWork.run((repos) => repos.lists.all())).map((l) => l.name),
    ).toContain('Fête');
  });

  it('US3-5 shows "Une liste porte déjà ce nom." for "barbecue", keeping the dialog open', async () => {
    await renderScreen();
    await openDialog();
    typeName('barbecue');

    press('Créer');

    expect(
      await screen.findByText('Une liste porte déjà ce nom.'),
    ).toBeOnTheScreen();
    expect(dialogTitle()).toBeOnTheScreen();
    expect(rows()).toHaveLength(2);
  });

  it('US3-6 shows "Indiquez un nom." for a blank name, creating nothing', async () => {
    const { useCases } = await renderScreen();
    const createList = jest.spyOn(useCases, 'createList');
    await openDialog();
    typeName('   ');

    press('Créer');

    expect(await screen.findByText('Indiquez un nom.')).toBeOnTheScreen();
    expect(createList).not.toHaveBeenCalled();
  });

  it('FR-022 shows the length error for a name of 61 characters', async () => {
    await renderScreen();
    await openDialog();
    typeName('a'.repeat(61));

    press('Créer');

    expect(
      await screen.findByText('Le nom ne peut pas dépasser 60 caractères.'),
    ).toBeOnTheScreen();
  });

  it('creates one list on a double tap of "Créer"', async () => {
    const { useCases } = await renderScreen();
    const createList = jest.spyOn(useCases, 'createList');
    await openDialog();
    typeName('Fête');

    press('Créer');
    press('Créer');

    expect(await screen.findByText('Fête')).toBeOnTheScreen();
    expect(createList).toHaveBeenCalledTimes(1);
  });

  it('offers no "Annuler" while the list is being saved, so the outcome is always shown', async () => {
    await renderScreen({ pending: ['createList'] });
    await openDialog();
    typeName('Fête');

    press('Créer');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled();
  });

  it('"Annuler" closes the dialog and creates nothing', async () => {
    await renderScreen();
    await openDialog();
    typeName('Fête');

    press('Annuler');

    await waitFor(() => expect(dialogTitle()).not.toBeOnTheScreen());
    expect(rows()).toHaveLength(2);
  });

  it('keeps the dialog open, as typed, when the save fails, and the snackbar says so', async () => {
    await renderScreen({ failing: ['createList'] });
    await openDialog();
    typeName('Fête');

    press('Créer');

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(dialogTitle()).toBeOnTheScreen();
    expect(screen.getByLabelText('Nom').props.value).toBe('Fête');
  });

  it('opens empty again after a list was created', async () => {
    await renderScreen();
    await openDialog();
    typeName('Fête');
    press('Créer');
    await screen.findByText('Fête');

    await openDialog();

    expect(screen.getByLabelText('Nom').props.value).toBe('');
  });

  describe('FR-037 screen reader focus', () => {
    it('goes to the dialog title when the dialog opens', async () => {
      await renderScreen();

      await openDialog();

      await waitFor(() => expect(focusTargets).toEqual(['Nouvelle liste']));
    });

    it('goes back to the FAB "Nouvelle liste" when the dialog closes', async () => {
      await renderScreen();
      await openDialog();
      await waitFor(() => expect(focusTargets).toHaveLength(1));

      press('Annuler');

      // The dialog's title is gone by then: the second "Nouvelle liste" is the FAB.
      await waitFor(() =>
        expect(focusTargets).toEqual(['Nouvelle liste', 'Nouvelle liste']),
      );
    });
  });
});
