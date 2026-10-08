import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import { focusOn } from '../accessibility/focus';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { Navigation } from '../navigation';
import { fixture, LONG_ARTICLE_NAME } from '../testing/fixtures';
import { recordFocusTargets } from '../testing/focus-targets';
import { renderWithStore } from '../testing/render-with-store';
import type { Fixture } from '../testing/story-store';
import { CurrentListScreen } from './CurrentListScreen';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

/** The names of the rows drawn, in order, each time a row renders (SC-008). */
const rowRenders: string[] = [];

// The real row behind a memo that records each render, as the real one compares its props.
jest.mock('../components/ListItemRow', () => {
  const { createElement, memo } =
    jest.requireActual<typeof import('react')>('react');
  const actual = jest.requireActual<typeof import('../components/ListItemRow')>(
    '../components/ListItemRow',
  );
  return {
    ListItemRow: memo(function RecordedListItemRow(
      props: import('../components/ListItemRow').ListItemRowProps,
    ) {
      rowRenders.push(props.name);
      return createElement(actual.ListItemRow, props);
    }),
  };
});

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

describe('CurrentList, editing the list (User Story 2)', () => {
  const beurre = 'article-beurre' as ArticleId;

  /** The fixture's "Ma liste" with "Beurre" ticked, with "2 kg", in Crèmerie after "Lait". */
  const withBeurre: Fixture = {
    ...fixture,
    items: [
      ...fixture.items,
      {
        listId: 'list-ma-liste' as ListId,
        articleId: beurre,
        inCart: true,
        quantity: { amount: 2, unit: 'kg' },
      },
    ],
  };

  let focusTargets: string[] = [];

  beforeEach(() => {
    focusTargets = recordFocusTargets(jest.mocked(focusOn));
  });

  /** The screen with the undo snackbar every screen shares. */
  const renderEditable = async (seed: Fixture = withBeurre) => {
    const rendered = await renderWithStore(
      <>
        <CurrentListScreen />
        <UndoSnackbar />
      </>,
      { seed },
    );
    await screen.findByText('Ma liste');
    const stored = (articleId: ArticleId) =>
      rendered.unitOfWork.run((repos) =>
        repos.items.find('list-ma-liste' as ListId, articleId),
      );
    return { ...rendered, stored };
  };

  /** Runs one of the row's accessibility actions, as a screen reader does. */
  const runAction = async (
    label: string,
    actionName: 'editQuantity' | 'remove',
  ) =>
    fireEvent(await row(label), 'accessibilityAction', {
      nativeEvent: { actionName },
    });

  it('FR-032 offers "Modifier la quantité" and "Retirer de la liste" as accessibility actions of each row', async () => {
    await renderEditable();

    expect(
      (await row('Beurre, 2 kg, dans le caddie')).props.accessibilityActions,
    ).toEqual([
      { name: 'editQuantity', label: 'Modifier la quantité' },
      { name: 'remove', label: 'Retirer de la liste' },
    ]);
  });

  it('US2-3 the action "Modifier la quantité" opens QuantityDialog prefilled, and saving shows the new quantity', async () => {
    await renderEditable();

    await runAction('Lait, 2 L, pas dans le caddie', 'editQuantity');

    expect(
      (await screen.findAllByRole('header', { name: 'Lait' })).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Quantité')).toHaveDisplayValue('2');
    expect(screen.getByLabelText('Unité')).toHaveDisplayValue('L');
    fireEvent.changeText(screen.getByLabelText('Quantité'), '3');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await row('Lait, 3 L, pas dans le caddie')).toBeOnTheScreen();
  });

  it('US2-4 the row button "Modifier la quantité" opens the dialog, where the quantity can be cleared', async () => {
    await renderEditable({ ...withBeurre, items: withBeurre.items.slice(-1) });

    fireEvent.press(
      // Hidden from screen readers, which reach it as the row's action.
      screen.getByLabelText('Modifier la quantité', {
        includeHiddenElements: true,
      }),
    );
    fireEvent.press(
      await screen.findByRole('button', { name: 'Effacer la quantité' }),
    );

    expect(await row('Beurre, dans le caddie')).toBeOnTheScreen();
  });

  it('US2-6 the row button "Retirer de la liste" removes the item at once and offers "Annuler"', async () => {
    const { stored } = await renderEditable({
      ...withBeurre,
      items: withBeurre.items.slice(-1),
    });

    fireEvent.press(
      // Hidden from screen readers, which reach it as the row's action.
      screen.getByLabelText('Retirer de la liste', {
        includeHiddenElements: true,
      }),
    );

    expect(
      await screen.findByText('« Beurre » retiré de la liste'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(await stored(beurre)).toBeNull();
  });

  it('US2-6 the action "Retirer de la liste" removes the item and offers "Annuler"', async () => {
    await renderEditable();

    await runAction('Beurre, 2 kg, dans le caddie', 'remove');

    expect(
      await screen.findByText('« Beurre » retiré de la liste'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('checkbox', { name: 'Beurre, 2 kg, dans le caddie' }),
    ).not.toBeOnTheScreen();
  });

  it('US2-16 "Annuler" puts the item back, ticked, with "2 kg"', async () => {
    await renderEditable();
    await runAction('Beurre, 2 kg, dans le caddie', 'remove');

    fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));

    const back = await row('Beurre, 2 kg, dans le caddie');
    expect(back).toBeChecked();
    await waitFor(() =>
      expect(
        screen.queryByText('« Beurre » retiré de la liste'),
      ).not.toBeOnTheScreen(),
    );
  });

  it('FR-010 ends the offer after 5 s', async () => {
    const { store } = await renderEditable();
    jest.useFakeTimers();
    try {
      await runAction('Beurre, 2 kg, dans le caddie', 'remove');
      await act(async () => {});
      expect(store.getState().pendingUndo).not.toBeNull();

      await act(() => jest.advanceTimersByTime(5000));

      expect(store.getState().pendingUndo).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  describe('FR-037 screen reader focus after a removal', () => {
    it('goes to the next row', async () => {
      await renderEditable();

      await runAction('Lait, 2 L, pas dans le caddie', 'remove');

      await waitFor(() =>
        expect(focusTargets).toEqual([
          `${LONG_ARTICLE_NAME}, pas dans le caddie`,
        ]),
      );
    });

    it('goes to the previous row when the removed row was the last one', async () => {
      await renderEditable();

      await runAction('Farine, 1,5 kg, pas dans le caddie', 'remove');

      await waitFor(() =>
        expect(focusTargets).toEqual(['Beurre, 2 kg, dans le caddie']),
      );
    });

    it('goes to the EmptyState when the list becomes empty', async () => {
      await renderEditable({
        ...withBeurre,
        items: withBeurre.items.slice(-1),
      });

      await runAction('Beurre, 2 kg, dans le caddie', 'remove');

      await waitFor(() =>
        expect(focusTargets).toEqual(['Votre liste est vide']),
      );
    });
  });

  it('FR-037 gives focus back to the row when QuantityDialog closes', async () => {
    await renderEditable();

    await runAction('Lait, 2 L, pas dans le caddie', 'editQuantity');
    fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));

    await waitFor(() =>
      expect(focusTargets).toEqual(['Lait', 'Lait, 2 L, pas dans le caddie']),
    );
  });

  it('the FAB "Ajouter" opens AddArticles, and coming back shows the items added', async () => {
    await renderWithStore(
      <Navigation errorReporter={new RecordingErrorReporter()} />,
      { seed: fixture, asScreen: false },
    );

    fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Beurre' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Ajouter' }));
    await screen.findByText('« Beurre » ajouté');
    fireEvent.press(screen.getByLabelText('Retour'));

    expect(await row('Beurre, pas dans le caddie')).toBeOnTheScreen();
  });
});

describe('CurrentList at full data size', () => {
  const pommes = 'article-pommes' as ArticleId;
  const crèmerie = fixture.categories[2];
  const fruits = fixture.categories[0];
  if (crèmerie?.name !== 'Crèmerie' || fruits?.name !== 'Fruits et légumes') {
    throw new Error('Unexpected default categories');
  }
  const numbered = Array.from({ length: 199 }, (_, index) => ({
    id: `article-${index + 1}` as ArticleId,
    name: `Article ${index + 1}`,
    categoryId: crèmerie.id,
  }));
  const maListe = 'list-ma-liste' as ListId;

  /**
   * "Ma liste" with 200 unticked items: "Pommes" alone in the first category, so it keeps its
   * place when ticked (FR-005), and "Article 1" … "Article 199" in "Crèmerie".
   */
  const twoHundredItems: Fixture = {
    ...fixture,
    articles: [
      { id: pommes, name: 'Pommes', categoryId: fruits.id },
      ...numbered,
    ],
    items: [{ id: pommes }, ...numbered].map(({ id }) => ({
      listId: maListe,
      articleId: id,
      inCart: false,
      quantity: null,
    })),
  };

  it('SC-008 ticking an item of a 200-item list draws again only its row', async () => {
    const { unitOfWork } = await renderWithStore(<CurrentListScreen />, {
      seed: twoHundredItems,
    });
    await row('Pommes, pas dans le caddie');
    rowRenders.length = 0;

    fireEvent.press(await row('Pommes, pas dans le caddie'));
    expect(await row('Pommes, dans le caddie')).toBeChecked();
    // Saved, and the list loaded again from storage.
    await waitFor(async () =>
      expect(
        (await unitOfWork.run((repos) => repos.items.find(maListe, pommes)))
          ?.inCart,
      ).toBe(true),
    );
    await screen.findByText('199 articles restants');

    expect(rowRenders).toEqual(['Pommes']);
  });

  it('SC-008 ticking the last item of a 200-item list draws none of the rows shown again', async () => {
    const { store } = await renderWithStore(<CurrentListScreen />, {
      seed: twoHundredItems,
    });
    await row('Pommes, pas dans le caddie');
    rowRenders.length = 0;

    // The last row is past the rows Jest draws: it is ticked as its row would tick it.
    await act(() => store.getState().toggleItem('article-199' as ArticleId));
    expect(await screen.findByText('199 articles restants')).toBeOnTheScreen();

    expect(rowRenders).toEqual([]);
  });
});
