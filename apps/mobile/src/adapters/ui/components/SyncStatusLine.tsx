import { StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { SyncSlice } from '../state/store-kit';
import { useAppStore } from '../state/use-app-store';
import type { AppTheme } from '../theme/theme';
import { spacing } from '../theme/spacing';
import { typeOverrides } from '../theme/typography';
import { SYNC_LINE_HEIGHT } from './SyncLineOffset';

export type SyncLine = {
  icon: string;
  text: string;
  tone: 'error' | 'neutral';
  action?: 'retry' | 'reconnect';
};

const ACTION_LABELS = {
  retry: () => 'Réessayer',
  reconnect: (slice: SyncSlice) =>
    slice.signedOutReason === 'accountDeleted'
      ? 'Se connecter'
      : 'Se reconnecter',
} as const;

/** What the line shows for the slice, or null when there is no problem to show. */
export const syncLine = ({
  connection,
  signedOutReason,
  status,
}: Pick<
  SyncSlice,
  'connection' | 'signedOutReason' | 'status'
>): SyncLine | null => {
  switch (connection) {
    case 'notConnected':
      return null;
    case 'signedOut':
      return {
        icon: 'cloud_off',
        text:
          signedOutReason === 'accountDeleted'
            ? 'Compte supprimé'
            : 'Appareil déconnecté',
        tone: 'error',
        action: 'reconnect',
      };
    case 'updateRequired':
      return {
        icon: 'update',
        text: 'Mise à jour requise pour synchroniser',
        tone: 'error',
      };
    case 'suspended':
      // Not an error: the lists stay on the phone and keep working (Principle VII).
      return {
        icon: 'pause_circle',
        text: 'Compte suspendu · listes conservées',
        tone: 'neutral',
      };
    case 'connected':
      return status === 'failed'
        ? {
            icon: 'cloud_alert',
            text: 'Échec de la synchronisation',
            tone: 'error',
            action: 'retry',
          }
        : null;
  }
};

/**
 * The sync problems, in one line above the tab bar of every screen but Réglages (FR-020).
 * Not a live region: `SyncAnnouncer` announces the transitions.
 */
export const SyncStatusLine = () => {
  const sync = useAppStore((state) => state.sync);
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  const line = syncLine(sync);
  if (line === null) return null;
  const textColor = colors.onSurfaceVariant;
  const iconColor =
    line.tone === 'error' ? colors.error : colors.onSurfaceVariant;
  return (
    <View
      testID="sync-status-line"
      style={[
        styles.line,
        {
          backgroundColor: colors.surfaceContainer,
          borderTopColor: colors.surfaceContainerHigh,
          borderBottomColor: colors.outlineVariant,
        },
      ]}
    >
      <Icon source={line.icon} size={18} color={iconColor} />
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.text, { color: textColor }]}
      >
        {line.text}
      </Text>
      {line.action && (
        <Text
          testID="sync-status-line-action"
          style={[styles.text, { color: colors.primary }]}
        >
          {ACTION_LABELS[line.action](sync)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  line: {
    height: SYNC_LINE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  text: {
    flexShrink: 1,
    fontFamily: typeOverrides.syncLine.fontFamily,
    fontSize: typeOverrides.syncLine.fontSize,
  },
});
