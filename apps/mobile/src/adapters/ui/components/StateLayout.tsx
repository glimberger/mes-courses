import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme/spacing';

/**
 * The centered column LoadingState, EmptyState and ErrorState share. It grows to fill its
 * parent, so inside a FlatList or ScrollView the call site gives the content container
 * `flexGrow: 1` for the state to be centered.
 */
export const StateLayout = ({ children }: { children: ReactNode }) => (
  <View style={styles.container}>{children}</View>
);

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
});
