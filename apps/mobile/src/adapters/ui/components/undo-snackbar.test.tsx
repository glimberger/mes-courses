import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Snackbar } from 'react-native-paper';

import { RecordingErrorReporter } from '../../../application/testing/recording-error-reporter';
import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { Navigation } from '../navigation';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import type { StoryScenario } from '../testing/story-store';
import { ABOVE_SCREEN_FAB } from './ScreenFab';
import { UndoSnackbar } from './UndoSnackbar';

const lait = 'article-lait' as ArticleId;
const removedText = '« Lait » retiré de la liste';

let appStateListener: ((state: AppStateStatus) => void) | undefined;
let screenReaderListener: ((enabled: boolean) => void) | undefined;
let screenReaderOn = false;

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => {
  jest.useFakeTimers();
  announce.mockReset();
  screenReaderOn = false;
  appStateListener = undefined;
  screenReaderListener = undefined;
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    // Answers on the next timer, so the test lets it answer inside act().
    .mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(screenReaderOn), 0)),
    );
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    // Typed loosely: the method has one overload per event.
    .mockImplementation(((event: string, listener: unknown) => {
      if (event === 'screenReaderChanged') {
        screenReaderListener = listener as (enabled: boolean) => void;
      }
      return { remove: jest.fn() };
    }) as never);
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((event, listener) => {
      if (event === 'change') appStateListener = listener;
      return { remove: jest.fn() } as never;
    });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** "Lait" removed from the fixture's "Ma liste": the offer is pending. */
const removeLait: StoryScenario['prepare'] = async (store) => {
  await store.loadCurrentList();
  await store.removeItem(lait);
};

const renderSnackbar = async () => {
  const rendered = await renderWithStore(<UndoSnackbar />, {
    seed: fixture,
    prepare: removeLait,
  });
  // Lets the snackbar read the screen reader setting.
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  const offered = () => rendered.store.getState().pendingUndo !== null;
  const stored = () =>
    rendered.unitOfWork.run((repos) =>
      repos.items.find('list-ma-liste' as ListId, lait),
    );
  return { ...rendered, offered, stored };
};

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

/** Moves the clock without running any timer, as while the app is in the background. */
const moveClock = (ms: number) => jest.setSystemTime(Date.now() + ms);

const setScreenReader = (enabled: boolean) =>
  act(() => screenReaderListener?.(enabled));

describe('UndoSnackbar', () => {
  it('US2-6 FR-038 shows the removed item with "Annuler", and announces it as it appears', async () => {
    await renderSnackbar();

    expect(screen.getByText(removedText)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(`${removedText}, Annuler`);
  });

  it('US2-16 "Annuler" puts the item back and ends the offer', async () => {
    const { offered, stored } = await renderSnackbar();

    fireEvent.press(screen.getByRole('button', { name: 'Annuler' }));
    await act(async () => {});

    expect(offered()).toBe(false);
    expect(await stored()).toMatchObject({ articleId: lait });
  });

  it('FR-010 ends the offer after 5 s, and not before', async () => {
    const { offered, stored } = await renderSnackbar();

    await advance(4900);
    expect(offered()).toBe(true);

    await advance(100);
    expect(offered()).toBe(false);
    expect(await stored()).toBeNull();
  });

  it('FR-010 ends at once an offer whose 5 s went by while the app was in the background', async () => {
    const { offered } = await renderSnackbar();

    act(() => appStateListener?.('background'));
    moveClock(6000);
    expect(offered()).toBe(true);
    act(() => appStateListener?.('active'));

    expect(offered()).toBe(false);
  });

  it('FR-010 keeps an offer whose 5 s are not over when the app comes back', async () => {
    const { offered } = await renderSnackbar();

    act(() => appStateListener?.('background'));
    moveClock(3000);
    act(() => appStateListener?.('active'));

    expect(offered()).toBe(true);
  });

  describe('with a screen reader on', () => {
    beforeEach(() => {
      screenReaderOn = true;
    });

    it('FR-010 keeps the offer past 5 s, until the next write', async () => {
      const { offered, store } = await renderSnackbar();

      await advance(60000);
      expect(offered()).toBe(true);

      await act(() =>
        store.getState().toggleItem('article-farine' as ArticleId),
      );
      expect(offered()).toBe(false);
    });

    it('FR-010 ends at once an offer 8 s old when the screen reader is turned off', async () => {
      const { offered } = await renderSnackbar();

      await advance(8000);
      expect(offered()).toBe(true);
      setScreenReader(false);

      expect(offered()).toBe(false);
    });

    it('FR-010 counts the 5 s from the removal when the screen reader is turned off 2 s after it', async () => {
      const { offered } = await renderSnackbar();

      await advance(2000);
      setScreenReader(false);
      expect(offered()).toBe(true);

      await advance(2900);
      expect(offered()).toBe(true);
      await advance(100);
      expect(offered()).toBe(false);
    });

    it('FR-010 keeps the offer when the screen reader is turned on during it', async () => {
      screenReaderOn = false;
      const { offered } = await renderSnackbar();

      await advance(2000);
      setScreenReader(true);
      await advance(10000);

      expect(offered()).toBe(true);
    });
  });

  it('FR-010 stays on screen across navigation, rendered once at the root', async () => {
    const { store } = await renderWithStore(
      <Navigation errorReporter={new RecordingErrorReporter()} />,
      { seed: fixture, asScreen: false },
    );
    await act(async () => {});
    await act(() => store.getState().removeItem(lait));
    expect(screen.getByText(removedText)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    await act(async () => {});

    expect(screen.getByText('Ajouter des articles')).toBeOnTheScreen();
    expect(screen.getByText(removedText)).toBeOnTheScreen();
  });

  it('shows above the FAB of the screen, never covering it', async () => {
    await renderSnackbar();

    expect(screen.UNSAFE_getByType(Snackbar).props.wrapperStyle).toEqual(
      ABOVE_SCREEN_FAB,
    );
  });
});
