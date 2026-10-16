import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';

export type IconCircleProps = {
  icon: string;
  size?: number;
  color?: string;
  diameter?: number;
  backgroundColor?: string;
};

export const IconCircle = ({
  icon,
  size = 32,
  color,
  diameter = 56,
  backgroundColor,
}: IconCircleProps): ReactNode => {
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  return (
    <View
      style={[
        styles.circle,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: backgroundColor ?? colors.surfaceContainerHigh,
        },
      ]}
    >
      <Icon source={icon} size={size} color={color ?? colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
