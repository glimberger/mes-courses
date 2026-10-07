import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

/** The centered message of EmptyState and ErrorState. */
export const StateMessage = ({ children }: { children: string }) => (
  <Text variant="bodyLarge" style={styles.message}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  message: { textAlign: 'center' },
});
