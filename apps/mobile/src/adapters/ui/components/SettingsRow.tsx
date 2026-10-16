import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Icon,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { shape } from '../theme/shape';
import { spacing } from '../theme/spacing';

export type SettingsRowProps = {
  icon: string;
  title: string;
  subtitle?: string | undefined;
  onPress?: () => void;
  trailing?: ReactNode;
};

/**
 * One setting of the settings screen: a soft brand-toned circular leading icon, a title and
 * an optional subtitle, grouped into a rounded card. Visual choices live here so screens stay
 * layout-only.
 */
export const SettingsRow = ({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
}: SettingsRowProps) => {
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  const circle = 44;
  const row = (
    <View style={styles.row}>
      <View
        style={[
          styles.iconCircle,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            backgroundColor: colors.surfaceContainerHigh,
          },
        ]}
      >
        <Icon source={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.text}>
        <Text variant="titleMedium">{title}</Text>
        {subtitle ? (
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  return (
    <Surface style={styles.surface} elevation={1}>
      {onPress ? (
        <TouchableRipple
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={title}
          style={styles.touchable}
        >
          {row}
        </TouchableRipple>
      ) : (
        row
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  surface: {
    borderRadius: shape.lg,
    marginVertical: spacing.xs,
  },
  touchable: {
    borderRadius: shape.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 48,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
});
