import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

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
  <Text accessibilityRole={role} style={styles.hidden}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
