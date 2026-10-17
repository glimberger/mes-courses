import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';

// The mockups' section measures (`.section`), which sit off the 4 dp spacing grid.
const PADDING_TOP = 18;
const PADDING_BOTTOM = 9;
const PADDING_SIDES = 20;
const GAP = 9;
const BAR_WIDTH = 4;
const BAR_HEIGHT = 16;

export type CategoryHeaderProps = {
  /** The category name. */
  title: string;
};

/**
 * A section header for a category: a short brand-yellow bar, then the category name in a
 * muted semibold title. The name wraps; it is a header for assistive technology.
 */
export const CategoryHeader = ({ title }: CategoryHeaderProps) => {
  const { colors } = useTheme() as AppTheme;
  return (
    <View testID="category-header" style={styles.container}>
      <View
        testID="category-bar"
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
    gap: GAP,
    paddingTop: PADDING_TOP,
    paddingBottom: PADDING_BOTTOM,
    paddingHorizontal: PADDING_SIDES,
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: shape.bar,
  },
});
