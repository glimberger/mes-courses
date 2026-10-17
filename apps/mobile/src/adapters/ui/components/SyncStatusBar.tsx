import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../routes';
import type { SyncSlice } from '../state/store-kit';
import { useAppStore } from '../state/use-app-store';
import type { AppTheme } from '../theme/theme';
import { shape } from '../theme/shape';
import { spacing } from '../theme/spacing';
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
 * The state of the synchronization, under the Appbar of every data screen (FR-020). Not a live
 * region: the failure and the recovery are announced by `SyncAnnouncer`, once for all the bars.
 */
export const SyncStatusBar = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sync = useAppStore((state) => state.sync);
  const retry = useAppStore((state) => state.retry);
  const shown = display(sync);

  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  if (shown === null) return null;
  const { icon, text, label, action } = shown;
  return (
    <View
      testID="sync-status-bar"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surfaceContainer,
          borderRadius: shape.md,
        },
      ]}
    >
      <TouchableRipple
        accessibilityRole="button"
        accessibilityLabel={label ?? text}
        onPress={() => navigation.navigate('Settings')}
        style={styles.status}
      >
        <View style={styles.row}>
          <Icon source={icon} size={20} color={colors.onSurfaceVariant} />
          <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>
            {text}
          </Text>
        </View>
      </TouchableRipple>
      {action && (
        <Button
          mode="text"
          onPress={() =>
            action.target === 'retry'
              ? void retry()
              : navigation.navigate('SignIn')
          }
        >
          {action.label}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  status: { flex: 1, minHeight: 48, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
