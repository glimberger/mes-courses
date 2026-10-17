import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { shape } from '../theme/shape';

// The radio mark: a 22 dp ring, with a 12 dp dot inside when selected.
const MARK = 22;
const DOT = 12;

export type RadioItemProps = {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * One choice of a radio group, drawn from theme roles: a ring that fills with a dot when selected,
 * and its label. The row is a radio, at least 48 dp high (FR-034).
 */
export const RadioItem = ({
  label,
  selected,
  disabled = false,
  onPress,
}: RadioItemProps) => {
  const { colors } = useTheme() as AppTheme;
  return (
    <TouchableRipple
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      style={styles.row}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.mark,
            { borderColor: selected ? colors.primary : colors.outline },
          ]}
        >
          {selected && (
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          )}
        </View>
        <Text
          variant="bodyLarge"
          style={[styles.label, { color: colors.onSurface }]}
        >
          {label}
        </Text>
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  row: { minHeight: 48, borderRadius: shape.lg },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  label: { flex: 1 },
});
