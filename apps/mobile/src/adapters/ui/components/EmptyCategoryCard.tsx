import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';
import { typeOverrides } from '../theme/typography';
import { Button } from './Button';
import { Card } from './Card';

export type EmptyCategoryCardProps = {
  /** Says the category holds no article. */
  message: string;
  actionLabel: string;
  onAction: () => void;
  testID?: string;
  /** The test id of the action button. */
  actionTestID?: string | undefined;
};

/**
 * The card a category without articles shows (the mockups' empty category): a message, muted, and
 * a text button that acts on it. The message wraps (FR-033).
 */
export const EmptyCategoryCard = ({
  message,
  actionLabel,
  onAction,
  testID,
  actionTestID,
}: EmptyCategoryCardProps) => {
  const { colors } = useTheme() as AppTheme;
  return (
    <Card testID={testID} style={styles.card}>
      <View style={styles.message}>
        <Text
          style={{
            color: colors.onSurfaceVariant,
            fontFamily: typeOverrides.emptyCategory.fontFamily,
            fontSize: typeOverrides.emptyCategory.fontSize,
          }}
        >
          {message}
        </Text>
      </View>
      <Button mode="text" onPress={onAction} testID={actionTestID}>
        {actionLabel}
      </Button>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingStart: 16,
    paddingEnd: 6,
    paddingVertical: 4,
  },
  message: { flex: 1 },
});
