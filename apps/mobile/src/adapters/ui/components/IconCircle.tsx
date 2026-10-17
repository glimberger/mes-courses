import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

import type { AppTheme, SchemeRole } from '../theme/theme';

export type IconCircleTone = 'brand' | 'error';

const TONE_ROLES: Record<IconCircleTone, [SchemeRole, SchemeRole]> = {
  brand: ['brandSoft', 'onBrandSoft'],
  error: ['errorContainer', 'onErrorContainer'],
};

// The mockups' two circle sizes, each with its icon (`.d-icon`, `.item-icon`).
const ICON_SIZE = { 44: 24, 56: 28 } as const;

export type IconCircleProps = {
  /** A Material Symbol name. */
  icon: string;
  diameter?: keyof typeof ICON_SIZE;
  tone?: IconCircleTone;
  testID?: string;
};

/** A round tonal badge around an icon. It is decorative: its row or dialog carries the label. */
export const IconCircle = ({
  icon,
  diameter = 56,
  tone = 'brand',
  testID,
}: IconCircleProps): ReactNode => {
  const { colors } = useTheme() as AppTheme;
  const [background, foreground] = TONE_ROLES[tone];
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: colors[background],
        },
      ]}
    >
      <Icon
        source={icon}
        size={ICON_SIZE[diameter]}
        color={colors[foreground]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
