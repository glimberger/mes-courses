import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { spacing } from '../theme/spacing';

/** "4 articles", "1 article", "0 articles" (US3-8). */
const countText = (count: number) =>
  count === 1 ? '1 article' : `${count} articles`;

export type ListSummaryRowProps = {
  name: string;
  /** Every item, ticked or not. */
  itemCount: number;
  isCurrent: boolean;
  onPress: () => void;
};

/**
 * One list of the lists screen: its name, its item count, and "Liste actuelle" with a check icon
 * on the current one (US3-8), read as one label, for example "Barbecue, 0 articles, liste
 * actuelle". The name wraps (FR-033) and the row is at least 48 dp high (FR-034).
 */
export const ListSummaryRow = memo(function ListSummaryRow({
  name,
  itemCount,
  isCurrent,
  onPress,
}: ListSummaryRowProps) {
  const { colors } = useTheme();
  const count = countText(itemCount);
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${count}${isCurrent ? ', liste actuelle' : ''}`}
      style={styles.row}
    >
      <View style={styles.content}>
        <View style={styles.text}>
          <Text variant="bodyLarge">{name}</Text>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            {count}
          </Text>
        </View>
        {isCurrent && (
          <View style={styles.current}>
            <Icon source="check" size={20} color={colors.primary} />
            <Text variant="labelLarge" style={{ color: colors.primary }}>
              Liste actuelle
            </Text>
          </View>
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { flex: 1 },
  current: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
