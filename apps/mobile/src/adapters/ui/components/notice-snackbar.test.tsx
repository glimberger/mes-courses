import { AccessibilityInfo } from 'react-native';
import { act, screen } from '@testing-library/react-native';

import type { Notice } from '../state/app-store';
import { renderWithStore } from '../testing/render-with-store';
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
});
