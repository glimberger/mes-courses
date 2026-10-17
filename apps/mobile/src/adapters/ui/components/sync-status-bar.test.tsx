import { StyleSheet } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '../testing/render-with-store';
import type { AppState } from '../state/app-store';
import { lightTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';
import { SyncStatusBar } from './SyncStatusBar';

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

  it('004 US5-4 says the device is no longer authorized, with "Se reconnecter"', async () => {
    const { show } = await renderBar();
    await show({ connection: 'signedOut', signedOutReason: 'revoked' });

    expect(
      screen.getByText("Cet appareil n'est plus autorisé. Reconnectez-vous."),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Se reconnecter' }),
    ).toBeOnTheScreen();
  });

  it('004 US6-5 says the account was deleted, with "Se connecter"', async () => {
    const { show } = await renderBar();
    await show({ connection: 'signedOut', signedOutReason: 'accountDeleted' });

    expect(screen.getByText('Ce compte a été supprimé.')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Se connecter' }),
    ).toBeOnTheScreen();
  });

  it('004 US5-2 says the account is suspended, with no button and no error color', async () => {
    const { show } = await renderBar();
    await show({ connection: 'suspended' });

    expect(
      screen.getByText(
        'Votre compte est suspendu. Vos listes restent sur cet appareil.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /Se (re)?connecter|Réessayer/ }),
    ).not.toBeOnTheScreen();
    const { backgroundColor } = StyleSheet.flatten(
      screen.getByTestId('sync-status-bar').props.style,
    ) as { backgroundColor?: string };
    expect(backgroundColor).not.toMatch(/error/i);
  });

  it('says only "En attente de synchronisation" when nothing is waiting', async () => {
    const { show } = await renderBar();
    await show({ status: 'waiting', pendingCount: 0 });

    expect(screen.getByText('En attente de synchronisation')).toBeOnTheScreen();
  });

  it('FR-018b says no longer authorized for a server address with no credential', async () => {
    await renderWithStore(<SyncStatusBar />, {
      connected: {
        serverUrl: 'https://courses.example.fr',
        lastSyncAt: null,
        withoutCredential: true,
      },
    });

    expect(
      await screen.findByText(
        "Cet appareil n'est plus autorisé. Reconnectez-vous.",
      ),
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

  describe('accessibility (US3-6)', () => {
    it('is not a live region', async () => {
      const { show } = await renderBar();
      await show({ status: 'failed' });

      expect(
        screen.getByTestId('sync-status-bar').props.accessibilityLiveRegion,
      ).toBeUndefined();
    });
  });
});

describe('SyncStatusBar as the settings strip', () => {
  const renderStrip = async () => {
    const rendered = await renderWithStore(<SyncStatusBar variant="strip" />);
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

  it('is full width on surfaceContainer, padded 11 dp vertically and 20 dp at the sides', async () => {
    const { show } = await renderStrip();
    await show({ status: 'saved' });

    expect(screen.getByTestId('sync-status-bar')).toHaveStyle({
      backgroundColor: lightTheme.colors.surfaceContainer,
      paddingVertical: 11,
      paddingHorizontal: 20,
    });
  });

  it('sets its text in the syncStrip role, in onSurfaceVariant', async () => {
    const { show } = await renderStrip();
    await show({ status: 'saved' });

    expect(screen.getByText('Synchronisé')).toHaveStyle({
      fontFamily: typeOverrides.syncStrip.fontFamily,
      fontSize: typeOverrides.syncStrip.fontSize,
      color: lightTheme.colors.onSurfaceVariant,
    });
  });

  it('draws its status icon at 20 dp', async () => {
    const { show } = await renderStrip();
    await show({ status: 'saved' });

    expect(screen.UNSAFE_getByProps({ source: 'cloud_done' }).props.size).toBe(
      20,
    );
  });

  it('keeps the recovery action of a failed sync, now a button', async () => {
    const { show } = await renderStrip();
    await show({ status: 'failed' });

    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
  });
});
