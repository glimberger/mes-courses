import type { RefObject } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { focusOn } from '../accessibility/focus';
import { NoticeSnackbar } from '../components/NoticeSnackbar';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { CurrentListScreen } from './CurrentListScreen';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

beforeEach(() => jest.mocked(focusOn).mockReset());

const title = 'Terminer les courses ?';
const message = 'Tous les articles seront décochés et resteront dans la liste.';

/** The text of an element and of everything inside it. */
const textOf = (children: unknown): string => {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) return children.map(textOf).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return textOf(
      (children as { props: { children?: unknown } }).props.children,
    );
  }
  return '';
};

/** What each focus move went to: the element's label, or its text when it has none. */
const focusTargets = () =>
  jest.mocked(focusOn).mock.calls.map(([target]) => {
    const props = (target as RefObject<{ props: Record<string, unknown> }>)
      .current?.props;
    return (
      (props?.accessibilityLabel as string | undefined) ??
      textOf(props?.children)
    );
  });

/** The fixture's "Ma liste", Pommes in the cart, with the snackbar every screen shares. */
const renderScreen = async (scenario: StoryScenario = {}) => {
  const rendered = await renderWithStore(
    <>
      <CurrentListScreen />
      <NoticeSnackbar />
    </>,
    { seed: fixture, ...scenario },
  );
  await screen.findByRole('checkbox', { name: 'Pommes, dans le caddie' });
  return rendered;
};

const finishAction = () =>
  screen.getByRole('button', { name: 'Terminer les courses' });

const openDialog = async () => {
  fireEvent.press(finishAction());
  return screen.findByText(title);
};

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

const checkedStates = () =>
  screen
    .getAllByRole('checkbox')
    .map((row) => Boolean(row.props.accessibilityState?.checked));

describe('FinishShoppingDialog', () => {
  it('US1-8 asks to confirm, with "Annuler" and "Terminer"', async () => {
    await renderScreen();

    expect(await openDialog()).toBeOnTheScreen();
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Terminer' })).toBeOnTheScreen();
  });

  it('US1-8 "Terminer" unticks every item, keeping the items and their quantities', async () => {
    await renderScreen();
    await openDialog();

    press('Terminer');

    expect(
      await screen.findByRole('checkbox', {
        name: 'Pommes, pas dans le caddie',
      }),
    ).toBeOnTheScreen();
    expect(checkedStates()).toEqual([false, false, false, false]);
    expect(screen.getByText('2 L')).toBeOnTheScreen();
    expect(screen.getByText('1,5 kg')).toBeOnTheScreen();
    expect(screen.queryByText(title)).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Terminer les courses' }),
    ).not.toBeOnTheScreen();
  });

  it('US1-9 "Annuler" closes the dialog and changes nothing', async () => {
    await renderScreen();
    await openDialog();

    press('Annuler');

    await waitFor(() =>
      expect(screen.queryByText(title)).not.toBeOnTheScreen(),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Pommes, dans le caddie' }),
    ).toBeChecked();
    expect(finishAction()).toBeOnTheScreen();
  });

  it('FR-007 R9a when finishing fails, keeps every item as it was, closes the dialog and shows the failed save', async () => {
    const { errorReporter } = await renderScreen({
      failing: ['finishShopping'],
    });
    await openDialog();

    press('Terminer');

    expect(
      await screen.findByText("La modification n'a pas pu être enregistrée."),
    ).toBeOnTheScreen();
    expect(screen.queryByText(title)).not.toBeOnTheScreen();
    expect(
      screen.getByRole('checkbox', { name: 'Pommes, dans le caddie' }),
    ).toBeChecked();
    expect(finishAction()).toBeOnTheScreen();
    // The app's reporter adds the screen shown, CurrentList (contracts/driven-ports.md).
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'finishShopping' } },
    ]);
    expect(focusTargets().at(-1)).toBe('Terminer les courses');
  });

  describe('FR-037 screen reader focus', () => {
    it('goes to the dialog title when the dialog opens', async () => {
      await renderScreen();

      await openDialog();

      await waitFor(() => expect(focusTargets()).toEqual([title]));
    });

    it('goes back to "Terminer les courses" when "Annuler" closes the dialog', async () => {
      await renderScreen();
      await openDialog();

      press('Annuler');

      await waitFor(() =>
        expect(focusTargets()).toEqual([title, 'Terminer les courses']),
      );
    });

    it('goes to the Appbar title once "Terminer" has hidden "Terminer les courses"', async () => {
      await renderScreen();
      await openDialog();

      press('Terminer');

      await waitFor(() => expect(focusTargets()).toEqual([title, 'Ma liste']));
    });
  });
});
