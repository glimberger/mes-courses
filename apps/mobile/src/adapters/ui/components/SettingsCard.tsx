import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Surface } from 'react-native-paper';

import { shape } from '../theme/shape';
import { spacing } from '../theme/spacing';

export type SettingsCardProps = {
  children: ReactNode;
};

/**
 * A rounded, elevated card that groups related settings (account, server, devices, actions).
 * Screens stay layout-only; the visual card styling lives here.
 */
export const SettingsCard = ({ children }: SettingsCardProps) => (
  <Surface style={styles.card} elevation={1}>
    {children}
  </Surface>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: shape.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
});
