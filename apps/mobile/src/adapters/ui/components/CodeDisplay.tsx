import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { spacing } from '../theme/spacing';

/** A short code to read out and type on another device, large and in monospace (US4-3). */
export const CodeDisplay = ({ code }: { code: string }) => (
  <Text
    variant="headlineMedium"
    selectable
    style={styles.code}
    // Read letter by letter: a code is not a word.
    accessibilityLabel={`Code ${code.split('').join(' ')}`}
  >
    {code}
  </Text>
);

const styles = StyleSheet.create({
  code: {
    fontFamily: 'monospace',
    letterSpacing: 2,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
});
