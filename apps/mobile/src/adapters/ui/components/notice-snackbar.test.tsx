import { AccessibilityInfo } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { act, screen } from '@testing-library/react-native';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import type { Notice } from '../state/app-store';
import { renderWithStore } from '../testing/render-with-store';
import { ABOVE_SCREEN_FAB } from './ScreenFab';
import { ABOVE_UNDO_OFFER } from './UndoSnackbar';
import { NoticeSnackbar } from './NoticeSnackbar';

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => announce.mockReset());
afterAll(() => announce.mockRestore());

const renderSnackbar = async () => {
  const rendered = await renderWithStore(<NoticeSnackbar />);
  const show = (notice: Notice) =>
    act(() => rendered.store.setState({ notice }));
  return { ...rendered, show };
};

describe('NoticeSnackbar', () => {
  it('shows nothing and announces nothing without a notice', async () => {
    await renderSnackbar();

    expect(
      screen.queryByText("La modification n'a pas pu être enregistrée."),
    ).not.toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: 'writeFailed' }, "La modification n'a pas pu être enregistrée."],
    [
      { type: 'storageFull' },
      'Espace de stockage insuffisant. Libérez de la place sur votre téléphone.',
    ],
    [{ type: 'articleAdded', name: 'Lait' }, '« Lait » ajouté'],
  ] as [Notice, string][])(
    'FR-038 shows the %o notice as "%s" and announces it as it appears',
    async (notice, text) => {
      const { show } = await renderSnackbar();

      show(notice);

      expect(await screen.findByText(text)).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(text);
    },
  );

  it('FR-038 announces a new notice even when it reads the same as the one before', async () => {
    const { show } = await renderSnackbar();

    show({ type: 'writeFailed' });
    show({ type: 'writeFailed' });

    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('FR-038 is announced once, with no live region reading it again on Android', async () => {
    const { show } = await renderSnackbar();

    show({ type: 'writeFailed' });

    const liveRegions: unknown[] = [];
    for (
      let node = screen.getByText(
        "La modification n'a pas pu être enregistrée.",
      ).parent;
      node;
      node = node.parent
    ) {
      if (node.props.accessibilityLiveRegion !== undefined) {
        liveRegions.push(node.props.accessibilityLiveRegion);
      }
    }
    expect(liveRegions.every((region) => region === 'none')).toBe(true);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('gives a notice that replaces a visible one its own full display time', async () => {
    jest.useFakeTimers();
    try {
      const { show, store } = await renderSnackbar();
      show({ type: 'writeFailed' });
      act(() => jest.advanceTimersByTime(6000));

      show({ type: 'articleAdded', name: 'Lait' });
      act(() => jest.advanceTimersByTime(2000));

      expect(store.getState().notice).toEqual({
        type: 'articleAdded',
        name: 'Lait',
      });
      expect(screen.getByText('« Lait » ajouté')).toBeOnTheScreen();

      act(() => jest.runAllTimers());
      expect(store.getState().notice).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps its text while it fades out after a dismissal', async () => {
    jest.useFakeTimers();
    try {
      const { show, store } = await renderSnackbar();
      show({ type: 'writeFailed' });
      act(() => jest.advanceTimersByTime(1000));

      act(() => store.getState().dismissNotice());

      expect(
        screen.getByText("La modification n'a pas pu être enregistrée."),
      ).toBeOnTheScreen();
      act(() => jest.runAllTimers());
      expect(
        screen.queryByText("La modification n'a pas pu être enregistrée."),
      ).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('calls dismissNotice when it is dismissed', async () => {
    jest.useFakeTimers();
    try {
      const { show, store } = await renderSnackbar();
      const dismissNotice = jest.spyOn(store.getState(), 'dismissNotice');
      show({ type: 'writeFailed' });

      act(() => jest.runAllTimers());

      expect(dismissNotice).toHaveBeenCalledTimes(1);
      expect(store.getState().notice).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows above the FAB of the screen, never covering it', async () => {
    await renderSnackbar();

    expect(screen.UNSAFE_getByType(Snackbar).props.wrapperStyle).toEqual(
      ABOVE_SCREEN_FAB,
    );
  });

  it('shows above the undo offer while one is pending, never covering "Annuler"', async () => {
    const { store, show } = await renderSnackbar();
    act(() =>
      store.setState({
        pendingUndo: {
          kind: 'removedItem',
          removed: {
            listId: 'list-1' as ListId,
            articleId: 'article-1' as ArticleId,
            inCart: false,
            quantity: null,
          },
          name: 'Lait',
        },
      }),
    );

    show({ type: 'writeFailed' });

    expect(screen.UNSAFE_getByType(Snackbar).props.wrapperStyle).toEqual(
      ABOVE_UNDO_OFFER,
    );
  });
});
