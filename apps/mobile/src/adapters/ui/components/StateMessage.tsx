import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

/** The centered message of EmptyState and ErrorState. */
export const StateMessage = ({
  children,
  ref,
}: {
  children: string;
  /** The message as screen readers focus it, for a focus move (FR-037). */
  ref?: Ref<View> | undefined;
}) => (
  <View ref={ref} accessible>
    <Text variant="bodyLarge" style={styles.message}>
      {children}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  message: { textAlign: 'center' },
});
