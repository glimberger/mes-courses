import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../routes';
import type { SyncSlice } from '../state/store-kit';
import { useAppStore } from '../state/use-app-store';
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
  status,
  pendingCount,
}: SyncSlice): Display | null => {
  switch (connection) {
    case 'notConnected':
      return null;
    case 'disconnectedByServer':
      return {
        icon: 'cloud-off-outline',
        text: "Cet appareil n'est plus connecté au serveur.",
        action: { label: 'Se reconnecter', target: 'reconnect' },
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
      return { icon: 'cloud-check-outline', text: 'Synchronisé' };
    case 'waiting':
      return {
        icon: 'cloud-clock-outline',
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
      return { icon: 'progress-upload', text: 'Synchronisation…' };
    case 'failed':
      return {
        icon: 'cloud-alert-outline',
        text: 'Échec de la synchronisation',
        action: { label: 'Réessayer', target: 'retry' },
      };
  }
};

/**
 * The state of the synchronization, under the Appbar of every data screen (FR-020). Not a live
 * region: only a failure and the recovery after it are announced (FR-023, research R14).
 */
export const SyncStatusBar = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const sync = useAppStore((state) => state.sync);
  const retry = useAppStore((state) => state.retry);
  const shown = display(sync);

  const wasFailed = useRef(false);
  const connected = sync.connection === 'connected';
  const { status } = sync;
  useEffect(() => {
    if (connected && status === 'failed') {
      if (!wasFailed.current) {
        AccessibilityInfo.announceForAccessibility(
          'Échec de la synchronisation',
        );
      }
      wasFailed.current = true;
    } else if (connected && status === 'saved' && wasFailed.current) {
      AccessibilityInfo.announceForAccessibility('Synchronisé');
      wasFailed.current = false;
    }
  }, [connected, status]);

  const { colors } = useTheme();
  if (shown === null) return null;
  const { icon, text, label, action } = shown;
  return (
    <View
      testID="sync-status-bar"
      style={[styles.bar, { backgroundColor: colors.elevation.level2 }]}
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
              : navigation.navigate('ConnectServer')
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
