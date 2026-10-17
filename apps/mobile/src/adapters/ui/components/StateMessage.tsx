import type { Ref } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { AppTheme } from '../theme/theme';

/** The centered, muted message of EmptyState and ErrorState. */
export const StateMessage = ({
  children,
  ref,
}: {
  children: string;
  /** The message as screen readers focus it, for a focus move (FR-037). */
  ref?: Ref<HostInstance> | undefined;
}) => {
  const { colors } = useTheme() as AppTheme;
  return (
    <View ref={ref} accessible>
      <Text
        variant="bodyMedium"
        style={[styles.message, { color: colors.onSurfaceVariant }]}
      >
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  message: { textAlign: 'center' },
});
