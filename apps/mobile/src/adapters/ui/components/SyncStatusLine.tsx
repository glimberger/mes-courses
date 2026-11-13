import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { AppNavigation } from '../routes';
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

// The line is 36 dp high: the slop brings the action's touch target to 48 dp.
// The line itself gets the same 12 dp, so its target is 48 dp too.
const LINE_HIT_SLOP = { top: 6, bottom: 6 };
const ACTION_HIT_SLOP = { top: 7, bottom: 7, left: 12, right: 12 };

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
  const navigation = useNavigation<AppNavigation>();
  const sync = useAppStore((state) => state.sync);
  const retry = useAppStore((state) => state.retry);
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  const line = syncLine(sync);
  if (line === null) return null;
  const textColor = colors.onSurfaceVariant;
  const iconColor =
    line.tone === 'error' ? colors.error : colors.onSurfaceVariant;
  return (
    <Pressable
      testID="sync-status-line"
      accessibilityRole="button"
      accessibilityLabel={line.text}
      hitSlop={LINE_HIT_SLOP}
      onPress={() =>
        navigation.navigate('SettingsTab', { screen: 'Settings', pop: true })
      }
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
        <Pressable
          testID="sync-status-line-action"
          accessibilityRole="button"
          accessibilityLabel={ACTION_LABELS[line.action](sync)}
          hitSlop={ACTION_HIT_SLOP}
          style={styles.action}
          onPress={() =>
            line.action === 'retry'
              ? void retry()
              : // `initial: false` keeps the Settings root under SignIn when the tab was never opened.
                navigation.navigate('SettingsTab', {
                  screen: 'SignIn',
                  initial: false,
                })
          }
        >
          <Text style={[styles.text, { color: colors.primary }]}>
            {ACTION_LABELS[line.action](sync)}
          </Text>
        </Pressable>
      )}
    </Pressable>
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
  action: {
    height: SYNC_LINE_HEIGHT - 2,
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  text: {
    flexShrink: 1,
    fontFamily: typeOverrides.syncLine.fontFamily,
    fontSize: typeOverrides.syncLine.fontSize,
  },
});
