import { memo, type Ref } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { Chip, Text, TouchableRipple } from 'react-native-paper';

import { spacing } from '../theme/spacing';
import { paperRef } from './paper-ref';

export type ArticleRowProps = {
  name: string;
  /** Already on the current list (FR-011, US2-8). */
  onList: boolean;
  onPress: () => void;
  /** The row screen readers focus, for a focus move (FR-037). */
  ref?: Ref<HostInstance>;
};

/**
 * One article of the catalog, opening the quantity dialog when tapped. An article already on the
 * list shows the "Déjà dans la liste" chip, which its label reads too. The name wraps (FR-033)
 * and the row is at least 48 dp high (FR-034).
 */
export const ArticleRow = memo(function ArticleRow({
  name,
  onList,
  onPress,
  ref,
}: ArticleRowProps) {
  return (
    <TouchableRipple
      ref={paperRef(ref)}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={onList ? `${name}, déjà dans la liste` : name}
      style={styles.row}
    >
      <View style={styles.content}>
        <Text variant="bodyLarge" style={styles.name}>
          {name}
        </Text>
        {onList && (
          // Read with the row's label.
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={styles.chip}
          >
            <Chip compact icon="check">
              Déjà dans la liste
            </Chip>
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  name: { flex: 1 },
  // The row takes the tap.
  chip: { pointerEvents: 'none' },
});
