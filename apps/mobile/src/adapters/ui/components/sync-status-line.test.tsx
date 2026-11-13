import * as ReactNative from 'react-native';
import { StyleSheet } from 'react-native';
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithStore } from '../testing/render-with-store';
import type { AppState } from '../state/app-store';
import { darkTheme, lightTheme } from '../theme/theme';
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
      StyleSheet.flatten(screen.getByTestId('sync-status-line-bar').props.style)
        .height,
    ).toBe(36);
  });

  it('review: the action is not nested in the accessible line, so a screen reader reaches it', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    const bar = screen.getByTestId('sync-status-line-bar');
    expect(within(bar).getByTestId('sync-status-line')).toBeTruthy();
    expect(within(bar).getByTestId('sync-status-line-action')).toBeTruthy();
    // Neither one holds the other.
    expect(
      within(screen.getByTestId('sync-status-line')).queryByTestId(
        'sync-status-line-action',
      ),
    ).toBeNull();
  });
});

describe('SyncStatusLine accessibility and separator', () => {
  it('015 US5-1 is a button labeled with its full text', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    const line = screen.getByRole('button', {
      name: 'Échec de la synchronisation',
    });
    expect(line).toBe(screen.getByTestId('sync-status-line'));
  });

  it.each([
    ['signedOut', 'revoked', 'Appareil déconnecté'],
    ['updateRequired', 'revoked', 'Mise à jour requise pour synchroniser'],
    ['suspended', 'revoked', 'Compte suspendu · listes conservées'],
  ] as const)(
    '015 US5-1 labels the %s line',
    async (connection, reason, text) => {
      const { show } = await renderLine();
      await show({ connection, signedOutReason: reason });

      expect(screen.getByRole('button', { name: text })).toBeOnTheScreen();
    },
  );

  it('015 US5-1 the action has its own label', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    // The line's own label is its text: the action is a separate button with its own.
    const action = screen.getByTestId('sync-status-line-action');
    expect(action.props.accessibilityRole).toBe('button');
    expect(action.props.accessibilityLabel).toBe('Réessayer');
  });

  it('015 US5-2 sets no live region on the line or inside it', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    const live = screen.UNSAFE_root.findAll(
      (node) =>
        node.props.accessibilityLiveRegion !== undefined ||
        node.props['aria-live'] !== undefined,
    );
    expect(live).toEqual([]);
  });

  it('015 US5-3 separates the line from the tab bar with 1 dp tokens', async () => {
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    const style = StyleSheet.flatten(
      screen.getByTestId('sync-status-line-bar').props.style,
    );
    expect(style).toMatchObject({
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: lightTheme.colors.surfaceContainerHigh,
      borderBottomColor: lightTheme.colors.outlineVariant,
      backgroundColor: lightTheme.colors.surfaceContainer,
    });
  });

  it('015 US5-3 uses the dark theme tokens in the dark theme', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    const { show } = await renderLine();
    await show({ connection: 'connected', status: 'failed' });

    const style = StyleSheet.flatten(
      screen.getByTestId('sync-status-line-bar').props.style,
    );
    expect(style.borderBottomColor).toBe(darkTheme.colors.outlineVariant);
    expect(style.borderTopColor).toBe(darkTheme.colors.surfaceContainerHigh);
    expect(style.backgroundColor).toBe(darkTheme.colors.surfaceContainer);
    jest.restoreAllMocks();
  });
});
