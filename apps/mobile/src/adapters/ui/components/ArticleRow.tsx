import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';
import { AddToggle, addToggleLabel } from './AddToggle';
import { Card } from './Card';

export type ArticleRowProps = {
  name: string;
  /** On the current list: added by a tap of this visit of the add screen. */
  added: boolean;
  onPress: () => void;
};

const ROW_MIN_HEIGHT = 64;
const ADDED_BORDER = 2;

/**
 * One article of the add screen: its name, and the round `AddToggle` on the right. A tap on the
 * row adds the article, or takes it off the list again. An added row tints its card and border.
 * The name wraps (FR-033) and the row is at least 48 dp high (FR-034).
 */
export const ArticleRow = memo(function ArticleRow({
  name,
  added,
  onPress,
}: ArticleRowProps) {
  const { colors } = useTheme() as AppTheme;

  return (
    <Card
      testID="article-row-card"
      style={[
        styles.card,
        added
          ? {
              backgroundColor: colors.tertiaryContainer,
              borderColor: colors.onTertiaryContainer,
            }
          : { borderColor: colors.surfaceContainerLowest },
      ]}
    >
      <TouchableRipple
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={addToggleLabel(name, added)}
        style={styles.row}
      >
        <View style={styles.content}>
          <Text
            variant="titleMedium"
            style={[
              styles.name,
              { color: added ? colors.onTertiaryContainer : colors.onSurface },
            ]}
          >
            {name}
          </Text>
          <AddToggle added={added} />
        </View>
      </TouchableRipple>
    </Card>
  );
});

const styles = StyleSheet.create({
  // The border is always there, the card's own color until added, so adding does not shift the row.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: ADDED_BORDER,
  },
  row: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: shape.lg,
  },
  content: {
    minHeight: ROW_MIN_HEIGHT - 2 * ADDED_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingStart: 14,
    paddingEnd: 10,
  },
  name: { flex: 1 },
});
