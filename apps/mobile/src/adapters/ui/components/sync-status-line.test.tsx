import { StyleSheet } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithStore } from '../testing/render-with-store';
import type { AppState } from '../state/app-store';
import { lightTheme } from '../theme/theme';
import { SyncStatusLine, syncLine } from './SyncStatusLine';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

type Sync = AppState['sync'];

const renderLine = async () => {
  const rendered = await renderWithStore(<SyncStatusLine />);
  const show = (sync: Partial<Sync>) =>
    act(() =>
      rendered.store.setState({
        sync: { ...rendered.store.getState().sync, ...sync },
      }),
    );
  return { ...rendered, show };
};

describe('syncLine', () => {
  const base = {
    connection: 'connected',
    signedOutReason: 'revoked',
    status: 'saved',
    pendingCount: 0,
  } as Sync;

  it.each([
    ['failed', 'Échec de la synchronisation', 'cloud_alert', 'error', 'retry'],
  ] as const)('maps connected + %s', (status, text, icon, tone, action) => {
    expect(syncLine({ ...base, status })).toEqual({
      text,
      icon,
      tone,
      action,
    });
  });

  it('maps signed out, revoked and account deleted', () => {
    expect(
      syncLine({
        ...base,
        connection: 'signedOut',
        signedOutReason: 'revoked',
      }),
    ).toEqual({
      text: 'Appareil déconnecté',
      icon: 'cloud_off',
      tone: 'error',
      action: 'reconnect',
    });
    expect(
      syncLine({
        ...base,
        connection: 'signedOut',
        signedOutReason: 'accountDeleted',
      }),
    ).toEqual({
      text: 'Compte supprimé',
      icon: 'cloud_off',
      tone: 'error',
      action: 'reconnect',
    });
  });

  it('maps update required and suspended', () => {
    expect(syncLine({ ...base, connection: 'updateRequired' })).toEqual({
      text: 'Mise à jour requise pour synchroniser',
      icon: 'update',
      tone: 'error',
    });
    expect(syncLine({ ...base, connection: 'suspended' })).toEqual({
      text: 'Compte suspendu · listes conservées',
      icon: 'pause_circle',
      tone: 'neutral',
    });
  });

  it.each(['saved', 'waiting', 'sending'] as const)(
    'maps connected + %s to nothing',
    (status) => {
      expect(syncLine({ ...base, status })).toBeNull();
    },
  );

  it('maps notConnected to nothing', () => {
    expect(syncLine({ ...base, connection: 'notConnected' })).toBeNull();
  });
});

describe('SyncStatusLine', () => {
  it('015 US1-1 shows the failure with its retry action', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    expect(screen.getByTestId('sync-status-line')).toBeOnTheScreen();
    expect(screen.getByText('Échec de la synchronisation')).toBeOnTheScreen();
    expect(screen.getByText('Réessayer')).toBeOnTheScreen();
  });

  it('015 US1-2 shows a revoked device with "Se reconnecter"', async () => {
    const { show } = await renderLine();
    await show({ connection: 'signedOut', signedOutReason: 'revoked' });

    expect(screen.getByText('Appareil déconnecté')).toBeOnTheScreen();
    expect(screen.getByText('Se reconnecter')).toBeOnTheScreen();
  });

  it('015 US1-3 shows a deleted account with "Se connecter"', async () => {
    const { show } = await renderLine();
    await show({ connection: 'signedOut', signedOutReason: 'accountDeleted' });

    expect(screen.getByText('Compte supprimé')).toBeOnTheScreen();
    expect(screen.getByText('Se connecter')).toBeOnTheScreen();
  });

  it('015 US1-4 shows update required without an action', async () => {
    const { show } = await renderLine();
    await show({ connection: 'updateRequired' });

    expect(
      screen.getByText('Mise à jour requise pour synchroniser'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-status-line-action')).toBeNull();
  });

  it('015 US1-5 shows suspended in the neutral tone, without an action', async () => {
    const { show } = await renderLine();
    await show({ connection: 'suspended' });

    expect(
      screen.getByText('Compte suspendu · listes conservées'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-status-line-action')).toBeNull();
  });

  it('015 uses the error color for errors and the neutral one for suspended', async () => {
    const { show } = await renderLine();
    await show({ connection: 'updateRequired' });
    expect(screen.UNSAFE_getByProps({ name: 'update' }).props.color).toBe(
      lightTheme.colors.error,
    );
    await show({ connection: 'suspended' });
    const icon = screen.UNSAFE_getByProps({ name: 'pause_circle' });
    expect(icon.props.color).toBe(lightTheme.colors.onSurfaceVariant);
    expect(icon.props.size).toBe(18);
  });

  it.each(['saved', 'waiting', 'sending'] as const)(
    '015 US1-6 shows nothing when connected and %s',
    async (status) => {
      const { show } = await renderLine();
      await show({ connection: 'connected', status });

      expect(screen.queryByTestId('sync-status-line')).toBeNull();
    },
  );

  it('015 US1-6 shows nothing when never connected', async () => {
    const { show } = await renderLine();
    await show({ connection: 'notConnected' });

    expect(screen.queryByTestId('sync-status-line')).toBeNull();
  });

  it('015 US1-7 disappears when the state recovers', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });
    expect(screen.getByTestId('sync-status-line')).toBeOnTheScreen();

    await show({ status: 'saved' });
    expect(screen.queryByTestId('sync-status-line')).toBeNull();
  });
});

describe('SyncStatusLine actions', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('015 US3-1 "Réessayer" retries the synchronization', async () => {
    const { show, store } = await renderLine();
    const retry = jest.fn(async () => ({ failed: false }));
    act(() => store.setState({ retry }));
    await show({ connection: 'connected', status: 'failed' });

    fireEvent.press(screen.getByText('Réessayer'));

    expect(retry).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each([
    ['revoked', 'Se reconnecter'],
    ['accountDeleted', 'Se connecter'],
  ] as const)(
    '015 US3-2 "%s" action opens SignIn above the Settings root',
    async (signedOutReason, label) => {
      const { show } = await renderLine();
      await show({ connection: 'signedOut', signedOutReason });

      fireEvent.press(screen.getByText(label));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('SettingsTab', {
        screen: 'SignIn',
        initial: false,
      });
    },
  );

  it('015 US3-3 a tap on the line opens the Réglages root', async () => {
    const { show } = await renderLine();
    await show({ connection: 'updateRequired' });

    fireEvent.press(screen.getByTestId('sync-status-line'));

    expect(mockNavigate).toHaveBeenCalledWith('SettingsTab', {
      screen: 'Settings',
      pop: true,
    });
  });

  it('015 US3 the action has a 48 dp touch target inside the 36 dp line', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    const action = screen.getByTestId('sync-status-line-action');
    const { height } = StyleSheet.flatten(action.props.style);
    const slop = action.props.hitSlop;
    expect(height + slop.top + slop.bottom).toBeGreaterThanOrEqual(48);
    expect(
      StyleSheet.flatten(screen.getByTestId('sync-status-line').props.style)
        .height,
    ).toBe(36);
  });
});
