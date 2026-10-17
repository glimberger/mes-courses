import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { IconButton, Searchbar, useTheme } from 'react-native-paper';

import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';

export type SearchFieldProps = {
  /** Shown while the field is empty, and read by screen readers. */
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
};

// The mockups' search bar (`.searchbar`): a 54 dp stadium, 18 dp inside at the sides.
const BAR_HEIGHT = 54;
const BAR_SIDES_PADDING = 18;
const BAR_GAP = 12;
const BAR_MARGIN_TOP = 6;
const BAR_MARGIN_BOTTOM = 2;
const BAR_MARGIN_SIDES = 16;

/**
 * Paper's search bar with French labels (FR-031, FR-032): Paper names its icons "search" and
 * "clear". It is the mockups' stadium on surfaceContainer, its text in bodyLarge and muted. Its
 * 40 dp clear button gives way to a 48 dp square one (FR-034).
 */
export const SearchField = ({
  placeholder,
  value,
  onChangeText,
  style,
}: SearchFieldProps) => {
  const theme = useTheme() as AppTheme;
  const { colors, fonts } = theme;
  return (
    <Searchbar
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      searchAccessibilityLabel="Rechercher"
      // Paper's own clear button, which Paper hides once `right` is set.
      clearAccessibilityLabel="Effacer la recherche"
      value={value}
      onChangeText={onChangeText}
      iconColor={colors.onSurfaceVariant}
      placeholderTextColor={colors.onSurfaceVariant}
      inputStyle={[
        styles.input,
        {
          fontFamily: fonts.bodyLarge.fontFamily,
          fontSize: fonts.bodyLarge.fontSize,
        },
      ]}
      style={[styles.bar, { backgroundColor: colors.surfaceContainer }, style]}
      right={({ color }) =>
        value === '' ? null : (
          <IconButton
            icon="close"
            iconColor={color}
            accessibilityLabel="Effacer la recherche"
            onPress={() => onChangeText('')}
            style={styles.clear}
          />
        )
      }
    />
  );
};

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    borderRadius: shape.pill,
    gap: BAR_GAP,
    paddingHorizontal: BAR_SIDES_PADDING,
    marginTop: BAR_MARGIN_TOP,
    marginBottom: BAR_MARGIN_BOTTOM,
    marginHorizontal: BAR_MARGIN_SIDES,
  },
  // The gap alone sets the space after the icon.
  input: { paddingLeft: 0 },
  clear: { width: 48, height: 48, margin: 0 },
});
