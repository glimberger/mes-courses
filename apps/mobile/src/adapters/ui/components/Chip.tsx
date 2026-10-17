import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { AppTheme, SchemeRole } from '../theme/theme';

export type ChipTone = 'secondary' | 'tertiary' | 'brand';

const TONE_ROLES: Record<ChipTone, [SchemeRole, SchemeRole]> = {
  secondary: ['secondaryContainer', 'onSecondaryContainer'],
  tertiary: ['tertiaryContainer', 'onTertiaryContainer'],
  brand: ['primaryContainer', 'onPrimaryContainer'],
};

export type ChipProps = {
  tone: ChipTone;
  /** A Material Symbol name drawn at 16 dp before the label. */
  icon?: string;
  children: string;
  testID?: string;
};

/** A stadium label on a tonal container (the mockups' `.chip`): secondary, tertiary or brand. */
export const Chip = ({
  tone,
  icon,
  children,
  testID,
}: ChipProps): ReactNode => {
  const { colors } = useTheme() as AppTheme;
  const [background, foreground] = TONE_ROLES[tone];
  return (
    <View
      testID={testID}
      style={[styles.chip, { backgroundColor: colors[background] }]}
    >
      {icon ? (
        <Icon source={icon} size={16} color={colors[foreground]} />
      ) : null}
      <Text variant="labelMedium" style={{ color: colors[foreground] }}>
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
});
