import { memo, type Ref } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { Card } from './Card';
import { RowMenu } from './RowMenu';
import { UsageBadge, usageLabel } from './UsageBadge';

export type CatalogArticleRowProps = {
  name: string;
  /** The number of lists holding the article; the badge is hidden at 0. */
  count: number;
  /** "Modifier" in the ⋮ menu. */
  onEdit: () => void;
  /** "Supprimer" in the ⋮ menu. */
  onDelete: () => void;
  /** Shows the ⋮ menu open, for stories. */
  menuInitiallyOpen?: boolean;
  /** The row's label, for the screen to put screen reader focus back on it. */
  ref?: Ref<HostInstance>;
};

// The mockups' row: a 64 dp card.
const ROW_MIN_HEIGHT = 64;

/**
 * One article of the Articles tab: its name and the number of lists holding it. The row reads as
 * one label, "Lait, dans 2 listes"; the badge is not read a second time. The ⋮ button opens
 * "Modifier" and "Supprimer".
 */
export const CatalogArticleRow = memo(function CatalogArticleRow({
  name,
  count,
  onEdit,
  onDelete,
  menuInitiallyOpen,
  ref,
}: CatalogArticleRowProps) {
  const { colors } = useTheme() as AppTheme;
  return (
    <Card style={styles.row}>
      <View
        ref={ref}
        accessible
        accessibilityLabel={count > 0 ? usageLabel(name, count) : name}
        style={styles.content}
      >
        <Text
          variant="titleMedium"
          style={[styles.name, { color: colors.onSurface }]}
        >
          {name}
        </Text>
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <UsageBadge name={name} count={count} />
        </View>
      </View>
      <RowMenu
        name={name}
        defaultVisible={menuInitiallyOpen ?? false}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: 8,
    paddingEnd: 4,
    paddingStart: 14,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  name: { flex: 1 },
});
