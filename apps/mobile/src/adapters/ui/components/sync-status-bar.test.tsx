import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '../testing/render-with-store';
import type { AppState } from '../state/app-store';
import { SyncStatusBar } from './SyncStatusBar';

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => announce.mockReset());
afterAll(() => announce.mockRestore());

const renderBar = async () => {
  const rendered = await renderWithStore(<SyncStatusBar />);
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

describe('SyncStatusBar', () => {
  it('003 US3-1 says "Synchronisé" when saved', async () => {
    const { show } = await renderBar();
    await show({ status: 'saved' });

    expect(screen.getByText('Synchronisé')).toBeOnTheScreen();
  });

  it('003 US3-2 says how many changes wait, without an error color', async () => {
    const { show, store } = await renderBar();
    await show({ status: 'waiting', pendingCount: 3 });

    expect(
      screen.getByText('En attente de synchronisation (3)'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/3 modifications/)).toBeOnTheScreen();
    expect(store.getState().sync.status).toBe('waiting');
    const { backgroundColor } = StyleSheet.flatten(
      screen.getByTestId('sync-status-bar').props.style,
    ) as { backgroundColor?: string };
    expect(backgroundColor).not.toMatch(/error/i);
  });

  it('003 US3-2 says "1 modification" for one change', async () => {
    const { show } = await renderBar();
    await show({ status: 'waiting', pendingCount: 1 });

    expect(screen.getByLabelText(/1 modification$/)).toBeOnTheScreen();
  });

  it('003 US3-3 says "Synchronisation…" while sending', async () => {
    const { show } = await renderBar();
    await show({ status: 'sending' });

    expect(screen.getByText('Synchronisation…')).toBeOnTheScreen();
  });

  it('003 US3-4 offers "Réessayer" when failed, and retries', async () => {
    const { show, store } = await renderBar();
    const retry = jest.fn(async () => ({ failed: false }));
    act(() => store.setState({ retry }));
    await show({ status: 'failed' });

    expect(screen.getByText('Échec de la synchronisation')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('is hidden when the device was never connected', async () => {
    const { show } = await renderBar();
    await show({ connection: 'notConnected', status: 'saved' });

    expect(screen.queryByText('Synchronisé')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('sync-status-bar')).not.toBeOnTheScreen();
  });

  it('asks for an update when the server requires one', async () => {
    const { show } = await renderBar();
    await show({ connection: 'updateRequired' });

    expect(
      screen.getByText("Mettez à jour l'application pour synchroniser."),
    ).toBeOnTheScreen();
  });

  it('US4-10 says the device is disconnected, with "Se reconnecter"', async () => {
    const { show } = await renderBar();
    await show({ connection: 'disconnectedByServer' });

    expect(
      screen.getByText("Cet appareil n'est plus connecté au serveur."),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Se reconnecter' }),
    ).toBeOnTheScreen();
  });

  it('says only "En attente de synchronisation" when nothing is waiting', async () => {
    const { show } = await renderBar();
    await show({ status: 'waiting', pendingCount: 0 });

    expect(screen.getByText('En attente de synchronisation')).toBeOnTheScreen();
  });

  it('FR-018b says disconnected for a server address with no credential', async () => {
    await renderWithStore(<SyncStatusBar />, {
      connected: {
        serverUrl: 'https://courses.example.fr',
        lastSyncAt: null,
        withoutCredential: true,
      },
    });

    expect(
      await screen.findByText("Cet appareil n'est plus connecté au serveur."),
    ).toBeOnTheScreen();
  });

  it('keeps a button at least 48 dp high', async () => {
    const { show } = await renderBar();
    await show({ status: 'failed' });

    const { minHeight } = StyleSheet.flatten(
      screen.getByRole('button', { name: 'Réessayer' }).props.style,
    ) as { minHeight?: number };
    expect(minHeight ?? 48).toBeGreaterThanOrEqual(48);
  });

  describe('announcements (US3-6, FR-023)', () => {
    it('is not a live region', async () => {
      const { show } = await renderBar();
      await show({ status: 'failed' });

      expect(
        screen.getByTestId('sync-status-bar').props.accessibilityLiveRegion,
      ).toBeUndefined();
    });

    it('announces entering failed, then the first saved after the failure', async () => {
      const { show } = await renderBar();
      await show({ status: 'saved' });
      await show({ status: 'failed' });
      expect(announce).toHaveBeenLastCalledWith('Échec de la synchronisation');

      await show({ status: 'sending' });
      await show({ status: 'saved' });

      expect(announce).toHaveBeenLastCalledWith('Synchronisé');
      expect(announce).toHaveBeenCalledTimes(2);
    });

    it('announces nothing for waiting, sending and saved cycles or a new count', async () => {
      const { show } = await renderBar();

      await show({ status: 'saved' });
      await show({ status: 'waiting', pendingCount: 1 });
      await show({ status: 'waiting', pendingCount: 2 });
      await show({ status: 'sending' });
      await show({ status: 'saved', pendingCount: 0 });

      expect(announce).not.toHaveBeenCalled();
    });
  });
});
