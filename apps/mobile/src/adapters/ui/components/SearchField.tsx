import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { IconButton, Searchbar } from 'react-native-paper';

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
}: SearchFieldProps) => (
  <Searchbar
    placeholder={placeholder}
    accessibilityLabel={placeholder}
    searchAccessibilityLabel="Rechercher"
    // Paper's own clear button, which Paper hides once `right` is set.
    clearAccessibilityLabel="Effacer la recherche"
    value={value}
    onChangeText={onChangeText}
    style={style}
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

const styles = StyleSheet.create({
  clear: { width: 48, height: 48, margin: 0 },
});
