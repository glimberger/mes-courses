import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from 'react-native-paper';

import { shadows } from '../theme/elevation';
import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';

export type CardProps = ViewProps & {
  /** Draws the 2 dp brand border of the current list's card. */
  outlined?: boolean;
};

/** The mockups' card: a lifted surface with 16 dp corners and the soft card shadow. */
export const Card = ({ outlined = false, style, ...props }: CardProps) => {
  const theme = useTheme() as AppTheme;
  const { colors } = theme;
  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLowest,
          boxShadow: shadows(theme).card,
        },
        outlined && styles.outlined,
        outlined && { borderColor: colors.primaryContainer },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: shape.lg },
  outlined: { borderWidth: 2 },
});
