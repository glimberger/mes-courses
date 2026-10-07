import { StyleSheet } from 'react-native';
import { FAB } from 'react-native-paper';

import { spacing } from '../theme/spacing';

export type ScreenFabProps = {
  icon: string;
  /** Shown, and read by screen readers. */
  label: string;
  onPress: () => void;
};

/**
 * A screen's main action, floating at the bottom end. The screen's list leaves room for it below
 * its last row (`SCREEN_FAB_CLEARANCE`).
 */
export const ScreenFab = ({ icon, label, onPress }: ScreenFabProps) => (
  <FAB
    icon={icon}
    label={label}
    accessibilityLabel={label}
    onPress={onPress}
    style={styles.fab}
  />
);

/** The bottom padding a list needs so the FAB never covers its last row. */
export const SCREEN_FAB_CLEARANCE = spacing.xl * 3;

const styles = StyleSheet.create({
  fab: { position: 'absolute', end: spacing.md, bottom: spacing.md },
});
