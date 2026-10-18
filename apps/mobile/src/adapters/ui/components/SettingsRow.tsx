import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { IconCircle } from './IconCircle';

export type SettingsRowProps = {
  icon: string;
  title: string;
  subtitle?: string | undefined;
  onPress?: (() => void) | undefined;
  /** Draws a muted chevron_right at the end, for a row that opens something. */
  chevron?: boolean | undefined;
  trailing?: ReactNode;
  /** Drawn under the subtitle, in the text column: for an element too wide to sit beside it. */
  footer?: ReactNode;
  /** Keeps the title on that many lines, ellipsized in the middle: for an email, which has no
   * space to wrap at. Omitted, a long title wraps. */
  titleNumberOfLines?: number | undefined;
};

/**
 * One setting of a settings card: a 44 dp brand circle, a title and an optional subtitle, and an
 * optional trailing chevron or element. The row draws no surface of its own; its card does. A
 * long title wraps. A wide element goes in `footer`, so it never squeezes the text.
 */
export const SettingsRow = ({
  icon,
  title,
  subtitle,
  onPress,
  chevron = false,
  trailing,
  footer,
  titleNumberOfLines,
}: SettingsRowProps) => {
  const { colors } = useTheme() as AppTheme;
  const row = (
    <View style={styles.row}>
      <IconCircle icon={icon} diameter={44} />
      <View style={styles.text}>
        <Text
          variant="titleMedium"
          style={{ color: colors.onSurface }}
          numberOfLines={titleNumberOfLines}
          ellipsizeMode="middle"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {subtitle}
          </Text>
        ) : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
      {trailing}
      {chevron && (
        <Icon
          source="chevron_right"
          size={24}
          color={colors.onSurfaceVariant}
        />
      )}
    </View>
  );

  if (!onPress) return row;
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={styles.touchable}
    >
      {row}
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  touchable: { borderRadius: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minHeight: 48,
  },
  text: { flex: 1, minWidth: 0 },
  footer: { marginTop: 6 },
});
