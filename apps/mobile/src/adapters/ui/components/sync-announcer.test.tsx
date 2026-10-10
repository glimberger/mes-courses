import { AccessibilityInfo } from 'react-native';
import { act } from '@testing-library/react-native';

import { renderWithStore } from '../testing/render-with-store';
import type { AppState } from '../state/app-store';
import { SyncAnnouncer } from './SyncAnnouncer';
import { SyncStatusBar } from './SyncStatusBar';

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => announce.mockReset());
afterAll(() => announce.mockRestore());

// Two bars, as when several screens are open in the stack.
const renderAnnouncer = async () => {
  const rendered = await renderWithStore(
    <>
      <SyncAnnouncer />
      <SyncStatusBar />
      <SyncStatusBar />
    </>,
  );
  const show = (sync: Partial<AppState['sync']>) =>
    act(() =>
      rendered.store.setState({
        sync: {
          ...rendered.store.getState().sync,
          connection: 'connected',
          ...sync,
        },
      }),
    );
  return { ...rendered, show };
};

describe('SyncAnnouncer (003 US3-6, FR-023)', () => {
  it('announces entering failed once, then the first saved after the failure', async () => {
    const { show } = await renderAnnouncer();
    await show({ status: 'saved' });
    await show({ status: 'failed' });
    expect(announce).toHaveBeenLastCalledWith('Échec de la synchronisation');

    await show({ status: 'sending' });
    await show({ status: 'saved' });

    expect(announce).toHaveBeenLastCalledWith('Synchronisé');
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('announces nothing for waiting, sending and saved cycles or a new count', async () => {
    const { show } = await renderAnnouncer();

    await show({ status: 'saved' });
    await show({ status: 'waiting', pendingCount: 1 });
    await show({ status: 'waiting', pendingCount: 2 });
    await show({ status: 'sending' });
    await show({ status: 'saved', pendingCount: 0 });

    expect(announce).not.toHaveBeenCalled();
  });
});
