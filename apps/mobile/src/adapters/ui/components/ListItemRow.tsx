import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Checkbox, Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { Quantity } from '../../../domain/quantity';
import { spacing } from '../theme/spacing';
import { formatQuantity } from './format-quantity';

export type ListItemRowProps = {
  name: string;
  quantity: Quantity | null;
  inCart: boolean;
  onToggle: () => void;
};

/** "Lait, 2 L, dans le caddie" (FR-032). */
const label = ({
  name,
  quantity,
  inCart,
}: Omit<ListItemRowProps, 'onToggle'>) =>
  [
    name,
    ...(quantity === null ? [] : [formatQuantity(quantity)]),
    inCart ? 'dans le caddie' : 'pas dans le caddie',
  ].join(', ');

/**
 * One item of a list, ticked or unticked by a tap. The whole row is the one checkbox screen
 * readers see. A ticked item shows a check mark and struck-through text in `onSurfaceVariant`,
 * never a lower opacity, so its contrast is the one the theme test checks (FR-035, FR-036). The
 * name wraps (FR-033) and the row is at least 48 dp high (FR-034).
 */
export const ListItemRow = memo(function ListItemRow({
  name,
  quantity,
  inCart,
  onToggle,
}: ListItemRowProps) {
  const { colors } = useTheme();
  const textStyle = [
    { color: inCart ? colors.onSurfaceVariant : colors.onSurface },
    inCart && styles.ticked,
  ];
  return (
    <TouchableRipple
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: inCart }}
      accessibilityLabel={label({ name, quantity, inCart })}
      style={styles.row}
    >
      <View style={styles.content}>
        <View
          importantForAccessibility="no-hide-descendants"
          style={styles.checkbox}
        >
          <Checkbox.Android status={inCart ? 'checked' : 'unchecked'} />
        </View>
        <Text variant="bodyLarge" style={[styles.name, ...textStyle]}>
          {name}
        </Text>
        {quantity !== null && (
          <Text variant="bodyMedium" style={textStyle}>
            {formatQuantity(quantity)}
          </Text>
        )}
      </View>
    </TouchableRipple>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 48, justifyContent: 'center' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingStart: spacing.sm,
    paddingEnd: spacing.md,
  },
  // The row takes the tap; the box only shows the state.
  checkbox: { pointerEvents: 'none' },
  name: { flex: 1 },
  ticked: { textDecorationLine: 'line-through' },
});
