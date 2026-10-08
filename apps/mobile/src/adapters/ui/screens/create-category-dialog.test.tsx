import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { focusOn } from '../accessibility/focus';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { fixture } from '../testing/fixtures';
import { recordFocusTargets } from '../testing/focus-targets';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { CreateArticleScreen } from './CreateArticleScreen';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

/** What each focus move went to (`recordFocusTargets`). */
let focusTargets: string[] = [];

beforeEach(() => {
  jest.mocked(focusOn).mockReset();
  focusTargets = recordFocusTargets(jest.mocked(focusOn));
});

/** CreateArticle on the fixture, which holds the 11 default categories. */
const renderScreen = async (scenario: StoryScenario = {}) => {
  const rendered = await renderWithStore(
    <>
      <CreateArticleScreen />
      <NoticeSnackbar />
    </>,
    { seed: fixture, ...scenario },
  );
  await screen.findByRole('radio', { name: 'Boissons' });
  return rendered;
};

/** The dialog's title; the button that opens it reads "Nouvelle catégorie" too, but is no header. */
const dialogTitle = () =>
  // Paper's title is a header inside the header the focus moves to.
  screen.queryAllByRole('header', { name: 'Nouvelle catégorie' })[0] ?? null;

const openDialog = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Nouvelle catégorie' }));
  await waitFor(() => expect(dialogTitle()).toBeOnTheScreen());
};

/** The dialog's "Nom" field: the form's own comes first. */
const dialogNameField = () => {
  const field = screen.getAllByLabelText('Nom').at(-1);
  if (!field) throw new Error('No "Nom" field');
  return field;
};

const typeName = (text: string) =>
  fireEvent.changeText(dialogNameField(), text);

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

/** The categories offered, in screen order. */
const offered = () =>
  screen
    .getAllByRole('radio', { name: /.+/ })
    .map((radio) => radio.props.accessibilityLabel as string);

describe('CreateCategoryDialog', () => {
  it('opens from "Nouvelle catégorie", titled "Nouvelle catégorie", with "Annuler" and "Créer"', async () => {
    await renderScreen();

    await openDialog();

    expect(screen.getAllByLabelText('Nom')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Créer' })).toBeOnTheScreen();
  });

  it('US4-2 FR-019 creates the category, closes and offers it last in the picker', async () => {
    const { unitOfWork } = await renderScreen();
    await openDialog();
    typeName('Bébé');

    press('Créer');

    await waitFor(() => expect(dialogTitle()).not.toBeOnTheScreen());
    await waitFor(() => expect(offered().at(-1)).toBe('Bébé'));
    expect(
      (await unitOfWork.run((repos) => repos.categories.all())).map(
        (category) => category.name,
      ),
    ).toContain('Bébé');
  });

  it('US4-3 shows "Cette catégorie existe déjà." for "boissons", keeping the dialog open', async () => {
    await renderScreen();
    await openDialog();
    typeName('boissons');

    press('Créer');

    expect(
      await screen.findByText('Cette catégorie existe déjà.'),
    ).toBeOnTheScreen();
    expect(dialogTitle()).toBeOnTheScreen();
    expect(offered()).toHaveLength(11);
  });

  it('US4-4 shows "Indiquez un nom." for a blank name, creating nothing', async () => {
    const { useCases } = await renderScreen();
    const createCategory = jest.spyOn(useCases, 'createCategory');
    await openDialog();
    typeName('   ');

    press('Créer');

    expect(await screen.findByText('Indiquez un nom.')).toBeOnTheScreen();
    expect(createCategory).not.toHaveBeenCalled();
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

  it('creates one category on a double tap of "Créer"', async () => {
    const { useCases } = await renderScreen();
    const createCategory = jest.spyOn(useCases, 'createCategory');
    await openDialog();
    typeName('Bébé');

    press('Créer');
    press('Créer');

    await waitFor(() => expect(offered().at(-1)).toBe('Bébé'));
    expect(createCategory).toHaveBeenCalledTimes(1);
  });

  it('offers no "Annuler" while the category is being saved, so the outcome is always shown', async () => {
    await renderScreen({ pending: ['createCategory'] });
    await openDialog();
    typeName('Bébé');

    press('Créer');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled();
  });

  it('"Annuler" closes the dialog, creating nothing and keeping the category chosen', async () => {
    await renderScreen();
    fireEvent.press(screen.getByRole('radio', { name: 'Boissons' }));
    await openDialog();
    typeName('Bébé');

    press('Annuler');

    await waitFor(() => expect(dialogTitle()).not.toBeOnTheScreen());
    expect(offered()).toHaveLength(11);
    expect(screen.getByRole('radio', { name: 'Boissons' })).toBeChecked();
  });

  it('keeps the dialog open, as typed, when the save fails, and the snackbar says so', async () => {
    await renderScreen({ failing: ['createCategory'] });
    await openDialog();
    typeName('Bébé');

    press('Créer');

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(dialogTitle()).toBeOnTheScreen();
    expect(dialogNameField().props.value).toBe('Bébé');
  });

  describe('FR-037 screen reader focus', () => {
    it('goes to the dialog title when the dialog opens', async () => {
      await renderScreen();

      await openDialog();

      await waitFor(() => expect(focusTargets).toEqual(['Nouvelle catégorie']));
    });

    it('goes back to "Nouvelle catégorie" when the dialog closes', async () => {
      await renderScreen();
      await openDialog();
      await waitFor(() => expect(focusTargets).toHaveLength(1));

      press('Annuler');

      // The dialog's title is gone by then: the second "Nouvelle catégorie" is the button.
      await waitFor(() =>
        expect(focusTargets).toEqual([
          'Nouvelle catégorie',
          'Nouvelle catégorie',
        ]),
      );
    });
  });
});
