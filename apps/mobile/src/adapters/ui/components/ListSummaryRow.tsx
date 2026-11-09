import { memo, type Ref } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';
import { Card } from './Card';
import { Chip } from './Chip';
import { IconCircle } from './IconCircle';
import { RowMenu } from './RowMenu';

/** "4 articles", "1 article", "0 articles" (US3-8). */
const countText = (count: number) =>
  count === 1 ? '1 article' : `${count} articles`;

export type ListSummaryRowProps = {
  name: string;
  /** Every item, ticked or not. */
  itemCount: number;
  isCurrent: boolean;
  onPress: () => void;
  /** "Modifier" in the ⋮ menu. */
  onEdit: () => void;
  /** "Supprimer" in the ⋮ menu. */
  onDelete: () => void;
  /** Shows the ⋮ menu open, for stories. */
  menuInitiallyOpen?: boolean;
  /** The ⋮ button, for the screen to put screen reader focus back on it. */
  menuButtonRef?: Ref<HostInstance> | undefined;
  testID?: string;
};

/**
 * One list of the lists screen, as a mockup card: its name, its item count, and "en cours"
 * with a check icon on the current one, which is outlined in brand (US3-8). It reads as one
 * label, for example "Barbecue, 0 articles, liste en cours". The ⋮ button at the end, outside
 * the tappable row, opens "Modifier" and "Supprimer" (spec 012). The name wraps (FR-033) and
 * the card is at least 48 dp high (FR-034).
 */
export const ListSummaryRow = memo(function ListSummaryRow({
  name,
  itemCount,
  isCurrent,
  onPress,
  onEdit,
  onDelete,
  menuInitiallyOpen,
  menuButtonRef,
  testID,
}: ListSummaryRowProps) {
  const { colors } = useTheme() as AppTheme;
  const count = countText(itemCount);
  return (
    <Card testID={testID} outlined={isCurrent} style={styles.card}>
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
          ) : null}
        </View>
      </TouchableRipple>
      <RowMenu
        name={name}
        defaultVisible={menuInitiallyOpen ?? false}
        buttonRef={menuButtonRef}
        items={[
          {
            title: 'Modifier',
            accessibilityLabel: `Modifier ${name}`,
            onPress: onEdit,
          },
          {
            title: 'Supprimer',
            accessibilityLabel: `Supprimer ${name}`,
            onPress: onDelete,
          },
        ]}
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', paddingEnd: 4 },
  // The declared floor of the 48 dp target (FR-034); the content sets the 72 dp card.
  touchable: { flex: 1, borderRadius: shape.lg, minHeight: 48 },
  rowline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingStart: 16,
    paddingEnd: 4,
  },
  texts: { flex: 1, minWidth: 0 },
});
