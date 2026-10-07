import { AccessibilityInfo } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { focusOn } from '../accessibility/focus';
import { fixture, LONG_ARTICLE_NAME } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture } from '../testing/story-store';
import { CurrentListScreen } from './CurrentListScreen';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => {
  announce.mockReset();
  jest.mocked(focusOn).mockReset();
});
afterAll(() => announce.mockRestore());

/** The fixture's "Ma liste" with nothing in the cart. */
const nothingInCart: Fixture = {
  ...fixture,
  items: fixture.items.map((item) => ({ ...item, inCart: false })),
};

/** The fixture's "Ma liste" with no item. */
const emptyList: Fixture = { ...fixture, items: [] };

const renderScreen = async (
  scenario: Parameters<typeof renderWithStore>[1] = { seed: fixture },
) => renderWithStore(<CurrentListScreen />, scenario);

/** Waits for the list, then returns the row of the item with the given label. */
const row = (label: string) => screen.findByRole('checkbox', { name: label });

const tap = async (label: string) => fireEvent.press(await row(label));

/** The texts shown among `texts`, in screen order. */
const shownInOrder = (texts: string[]) =>
  screen
    .getAllByText(new RegExp(`^(${texts.join('|')})$`))
    .map((node) => node.props.children as string);

/** Every live region from the node up, so a text read again by Android shows up. */
const liveRegionsAbove = (node: ReactTestInstance) => {
  const regions: unknown[] = [];
  for (let at: ReactTestInstance | null = node; at; at = at.parent) {
    if (at.props.accessibilityLiveRegion !== undefined) {
      regions.push(at.props.accessibilityLiveRegion);
    }
  }
  return regions;
};

describe('CurrentList', () => {
  it('US1-1 shows the list name in the Appbar and the items under their category headings, with their quantities', async () => {
    await renderScreen();
    await row('Lait, 2 L, pas dans le caddie');

    expect(screen.getByText('Ma liste')).toBeOnTheScreen();
    expect(
      shownInOrder([
        'Fruits et légumes',
        'Crèmerie',
        'Épicerie salée',
        'Pommes',
        'Lait',
        'Farine',
      ]),
    ).toEqual([
      'Fruits et légumes',
      'Pommes',
      'Crèmerie',
      'Lait',
      'Épicerie salée',
      'Farine',
    ]);
    expect(screen.getByText('2 L')).toBeOnTheScreen();
    expect(screen.getByText('1,5 kg')).toBeOnTheScreen();
  });

  it('US4-5 shows no heading for a category holding no item of the list', async () => {
    await renderScreen();
    await row('Lait, 2 L, pas dans le caddie');

    expect(screen.queryByText('Boulangerie')).not.toBeOnTheScreen();
    expect(screen.queryByText('Surgelés')).not.toBeOnTheScreen();
  });

  it('US1-2 ticks an item at once when it is tapped', async () => {
    await renderScreen();

    await tap('Lait, 2 L, pas dans le caddie');

    expect(
      screen.getByRole('checkbox', { name: 'Lait, 2 L, dans le caddie' }),
    ).toBeChecked();
  });

  it('US1-3 unticks a ticked item at once when it is tapped', async () => {
    await renderScreen();

    await tap('Pommes, dans le caddie');

    expect(
      screen.getByRole('checkbox', { name: 'Pommes, pas dans le caddie' }),
    ).not.toBeChecked();
  });

  it('US1-4 saves the tick', async () => {
    const { unitOfWork } = await renderScreen();

    await tap('Lait, 2 L, pas dans le caddie');

    await waitFor(async () => {
      const stored = await unitOfWork.run(async (repos) =>
        repos.items.find(
          'list-ma-liste' as ListId,
          'article-lait' as ArticleId,
        ),
      );
      expect(stored?.inCart).toBe(true);
    });
  });

  it('US1-6 FR-005 moves a ticked item after the unticked items of its category', async () => {
    await renderScreen();
    await row('Lait, 2 L, pas dans le caddie');
    expect(shownInOrder(['Lait', LONG_ARTICLE_NAME])).toEqual([
      'Lait',
      LONG_ARTICLE_NAME,
    ]);

    await tap('Lait, 2 L, pas dans le caddie');

    expect(shownInOrder(['Lait', LONG_ARTICLE_NAME])).toEqual([
      LONG_ARTICLE_NAME,
      'Lait',
    ]);
  });

  it.each([
    [nothingInCart, [], '4 articles restants'],
    [fixture, [], '3 articles restants'],
    [
      fixture,
      ['Lait, 2 L, pas dans le caddie', 'Farine, 1,5 kg, pas dans le caddie'],
      '1 article restant',
    ],
  ] as [Fixture, string[], string][])(
    'US1-7 FR-006 reads the remaining count in the subtitle (%#: "%s")',
    async (seed, taps, subtitle) => {
      await renderScreen({ seed });
      for (const label of taps) await tap(label);

      expect(await screen.findByText(subtitle)).toBeOnTheScreen();
    },
  );

  it('US1-7 FR-006 says everything is in the cart when nothing remains', async () => {
    await renderScreen();
    await tap('Lait, 2 L, pas dans le caddie');
    await tap('Farine, 1,5 kg, pas dans le caddie');

    await tap(`${LONG_ARTICLE_NAME}, pas dans le caddie`);

    expect(
      await screen.findByText('Tout est dans le caddie'),
    ).toBeOnTheScreen();
  });

  it('US1-10 shows an empty list with its name, and offers to add articles', async () => {
    await renderScreen({ seed: emptyList });

    expect(await screen.findByText('Votre liste est vide')).toBeOnTheScreen();
    expect(screen.getByText('Ma liste')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Ajouter des articles' }),
    ).toBeOnTheScreen();
  });

  it('US1-11 FR-029 shows LoadingState while the list loads', async () => {
    await renderScreen({ seed: fixture, pending: ['getCurrentList'] });

    expect(await screen.findByLabelText('Chargement')).toBeOnTheScreen();
  });

  it('US1-12 shows the error with "Réessayer", reports it, and loads again when retried', async () => {
    const { errorReporter } = await renderScreen({
      seed: fixture,
      failing: ['getCurrentList'],
    });

    expect(
      await screen.findByText('Impossible de charger la liste.'),
    ).toBeOnTheScreen();
    // The app's reporter adds the screen shown, CurrentList (contracts/driven-ports.md).
    expect(errorReporter.reports).toEqual([
      { error: expect.any(Error), context: { operation: 'getCurrentList' } },
    ]);

    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(errorReporter.reports).toHaveLength(2));
    expect(
      await screen.findByText('Impossible de charger la liste.'),
    ).toBeOnTheScreen();
  });

  it('FR-007 offers "Terminer les courses" only once an item is in the cart', async () => {
    await renderScreen({ seed: nothingInCart });
    await row('Lait, 2 L, pas dans le caddie');

    expect(
      screen.queryByRole('button', { name: 'Terminer les courses' }),
    ).not.toBeOnTheScreen();

    await tap('Lait, 2 L, pas dans le caddie');

    expect(
      screen.getByRole('button', { name: 'Terminer les courses' }),
    ).toBeOnTheScreen();
  });

  it('offers "Mes listes" and "Ajouter"', async () => {
    await renderScreen();
    await row('Lait, 2 L, pas dans le caddie');

    expect(
      screen.getByRole('button', { name: 'Mes listes' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeOnTheScreen();
  });

  it('FR-037 keeps the row, and screen reader focus on it, when ticking moves it below the unticked rows', async () => {
    await renderScreen();
    const lait = await row('Lait, 2 L, pas dans le caddie');

    fireEvent.press(lait);

    // The same native view, now ticked: it was moved, not drawn again.
    expect(lait).toBeOnTheScreen();
    expect(lait).toBeChecked();
    expect(focusOn).not.toHaveBeenCalled();
  });

  it('FR-038 does not announce the remaining count when it changes', async () => {
    await renderScreen();

    await tap('Lait, 2 L, pas dans le caddie');

    const subtitle = await screen.findByText('2 articles restants');
    expect(announce).not.toHaveBeenCalled();
    expect(
      liveRegionsAbove(subtitle).every((region) => region === 'none'),
    ).toBe(true);
  });
});
