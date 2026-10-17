import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Text that screen readers read but nothing draws: a heading for a screen whose mockup shows no
 * title (sign-in).
 */
export const VisuallyHidden = ({
  children,
  role,
}: {
  children: ReactNode;
  role?: 'header' | undefined;
}) => (
  // A 1 dp clip, not a transparent view: screen readers skip views with an alpha of 0.
  <View style={styles.clip}>
    <Text accessibilityRole={role}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  clip: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
});
