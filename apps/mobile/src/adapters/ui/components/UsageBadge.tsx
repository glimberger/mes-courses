import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';

/** The accessible label of an article row: its name and the lists holding it. */
export const usageLabel = (name: string, count: number): string =>
  `${name}, dans ${count} ${count === 1 ? 'liste' : 'listes'}`;

export type UsageBadgeProps = {
  name: string;
  /** The number of lists holding the article; nothing is drawn at 0. */
  count: number;
  testID?: string;
};

/** The Articles tab's badge (mockup 19): a list icon and the number of lists. */
export const UsageBadge = ({
  name,
  count,
  testID,
}: UsageBadgeProps): ReactNode => {
  const { colors } = useTheme() as AppTheme;
  if (count <= 0) return null;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={usageLabel(name, count)}
      style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}
    >
      <Icon
        source="format_list_bulleted"
        size={15}
        color={colors.onSecondaryContainer}
      />
      <Text
        variant="labelMedium"
        style={{ color: colors.onSecondaryContainer }}
      >
        {String(count)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
});
