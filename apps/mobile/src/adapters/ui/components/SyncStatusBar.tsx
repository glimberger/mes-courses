import { StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

import type { AppNavigation } from '../routes';
import type { SyncSlice } from '../state/store-kit';
import { useAppStore } from '../state/use-app-store';
import type { AppTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';
import { Button } from './Button';

type Display = {
  icon: string;
  text: string;
  /** Read instead of `text` when the screen reader focuses the bar. */
  label?: string;
  action?: { label: string; target: 'retry' | 'reconnect' };
};

const modifications = (count: number) =>
  count === 1 ? '1 modification' : `${count} modifications`;

/** What the bar shows for the slice, or null when a never-connected device has nothing to show. */
const display = ({
  connection,
  signedOutReason,
  status,
  pendingCount,
}: SyncSlice): Display | null => {
  switch (connection) {
    case 'notConnected':
      return null;
    case 'signedOut':
      return signedOutReason === 'accountDeleted'
        ? {
            icon: 'cloud_off',
            text: 'Ce compte a été supprimé.',
            action: { label: 'Se connecter', target: 'reconnect' },
          }
        : {
            icon: 'cloud_off',
            text: "Cet appareil n'est plus autorisé. Reconnectez-vous.",
            action: { label: 'Se reconnecter', target: 'reconnect' },
          };
    case 'suspended':
      // Not an error: the lists stay on the phone and keep working (Principle VII).
      return {
        icon: 'pause_circle',
        text: 'Votre compte est suspendu. Vos listes restent sur cet appareil.',
      };
    case 'updateRequired':
      return {
        icon: 'update',
        text: "Mettez à jour l'application pour synchroniser.",
      };
    case 'connected':
      break;
  }
  switch (status) {
    case 'saved':
      return { icon: 'cloud_done', text: 'Synchronisé' };
    case 'waiting':
      return {
        icon: 'cloud_upload',
        // Offline with nothing to send: waiting for the server, with no count to give.
        text:
          pendingCount === 0
            ? 'En attente de synchronisation'
            : `En attente de synchronisation (${pendingCount})`,
        label:
          pendingCount === 0
            ? 'En attente de synchronisation'
            : `En attente de synchronisation, ${modifications(pendingCount)}`,
      };
    case 'sending':
      return { icon: 'cloud_sync', text: 'Synchronisation…' };
    case 'failed':
      return {
        icon: 'cloud_alert',
        text: 'Échec de la synchronisation',
        action: { label: 'Réessayer', target: 'retry' },
      };
  }
};

/**
 * The full state of the synchronization, as the strip of the Réglages screen (FR-020, 015). The
 * other screens show only the problem states, through `SyncStatusLine` above the tab bar. Not a
 * live region: the failure and the recovery are announced by `SyncAnnouncer`, once for all.
 */
export const SyncStatusBar = () => {
  const navigation = useNavigation<AppNavigation>();
  const sync = useAppStore((state) => state.sync);
  const retry = useAppStore((state) => state.retry);
  const shown = display(sync);

  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  if (shown === null) return null;
  const { icon, text, label, action } = shown;
  return (
    <View
      testID="sync-status-bar"
      style={[styles.bar, { backgroundColor: colors.surfaceContainer }]}
    >
      <View
        accessible
        accessibilityLabel={label ?? text}
        style={[styles.status, styles.row]}
      >
        <Icon source={icon} size={20} color={colors.onSurfaceVariant} />
        <Text
          variant="labelLarge"
          style={[{ color: colors.onSurfaceVariant }, styles.text]}
        >
          {text}
        </Text>
      </View>
      {action && (
        <Button
          mode="text"
          onPress={() =>
            action.target === 'retry'
              ? void retry()
              : // `initial: false` keeps the Settings root under SignIn when the tab was never opened.
                navigation.navigate('SettingsTab', {
                  screen: 'SignIn',
                  initial: false,
                })
          }
        >
          {action.label}
        </Button>
      )}
    </View>
  );
};

// The settings strip (`.sync-strip`): full width, 11 dp down, 20 dp at the sides.
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  status: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: {
    fontFamily: typeOverrides.syncStrip.fontFamily,
    fontSize: typeOverrides.syncStrip.fontSize,
  },
});
