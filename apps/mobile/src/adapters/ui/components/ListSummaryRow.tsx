import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';
import { Card } from './Card';
import { Chip } from './Chip';
import { IconCircle } from './IconCircle';

/** "4 articles", "1 article", "0 articles" (US3-8). */
const countText = (count: number) =>
  count === 1 ? '1 article' : `${count} articles`;

export type ListSummaryRowProps = {
  name: string;
  /** Every item, ticked or not. */
  itemCount: number;
  isCurrent: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * One list of the lists screen, as a mockup card: its name, its item count, and "en cours"
 * with a check icon on the current one, which is outlined in brand (US3-8). It reads as one
 * label, for example "Barbecue, 0 articles, liste en cours". The name wraps (FR-033) and the
 * card is at least 48 dp high (FR-034).
 */
export const ListSummaryRow = memo(function ListSummaryRow({
  name,
  itemCount,
  isCurrent,
  onPress,
  testID,
}: ListSummaryRowProps) {
  const { colors } = useTheme() as AppTheme;
  const count = countText(itemCount);
  return (
    <Card testID={testID} outlined={isCurrent}>
      <TouchableRipple
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${count}${isCurrent ? ', liste en cours' : ''}`}
        style={styles.touchable}
      >
        <View style={styles.rowline}>
          <IconCircle icon="format_list_bulleted" diameter={44} />
          <View style={styles.texts}>
            <Text variant="titleMedium" style={{ color: colors.onSurface }}>
              {name}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant }}
            >
              {count}
            </Text>
          </View>
          {isCurrent ? (
            <Chip tone="brand" icon="check">
              en cours
            </Chip>
          ) : (
            <Icon
              source="chevron_right"
              size={24}
              color={colors.onSurfaceVariant}
            />
          )}
        </View>
      </TouchableRipple>
    </Card>
  );
});

const styles = StyleSheet.create({
  // The declared floor of the 48 dp target (FR-034); the content sets the 72 dp card.
  touchable: { borderRadius: shape.lg, minHeight: 48 },
  rowline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  texts: { flex: 1, minWidth: 0 },
});
