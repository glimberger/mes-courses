import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { shape } from '../theme/shape';
import { spacing } from '../theme/spacing';

export type CategoryHeaderProps = {
  /** The category name. */
  title: string;
};

/**
 * A section header for a category: a small brand-yellow accent bar followed by a muted semibold
 * category name. Screens keep layout-only styling.
 */
export const CategoryHeader = ({ title }: CategoryHeaderProps) => {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View
        style={[styles.bar, { backgroundColor: colors.primaryContainer }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text
        variant="titleSmall"
        style={{ color: colors.onSurfaceVariant }}
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bar: {
    width: shape.xs,
    height: spacing.md,
    borderRadius: shape.xs / 2,
  },
});
