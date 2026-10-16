import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { IconButton, Searchbar, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { shape } from '../theme/shape';

export type SearchFieldProps = {
  /** Shown while the field is empty, and read by screen readers. */
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Paper's search bar with French labels (FR-031, FR-032): Paper names its icons "search" and
 * "clear". Its 40 dp clear button gives way to a 48 dp square one (FR-034).
 */
export const SearchField = ({
  placeholder,
  value,
  onChangeText,
  style,
}: SearchFieldProps) => {
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  return (
    <Searchbar
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      searchAccessibilityLabel="Rechercher"
      // Paper's own clear button, which Paper hides once `right` is set.
      clearAccessibilityLabel="Effacer la recherche"
      value={value}
      onChangeText={onChangeText}
      style={[
        styles.bar,
        { borderRadius: shape.pill, backgroundColor: colors.surfaceContainer },
        style,
      ]}
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
  bar: {},
  clear: { width: 48, height: 48, margin: 0 },
});
