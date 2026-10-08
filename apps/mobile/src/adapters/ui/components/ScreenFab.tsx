import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Icon,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import { spacing } from '../theme/spacing';

export type ScreenFabProps = {
  icon: string;
  /** Shown, and read by screen readers. */
  label: string;
  onPress: () => void;
  /** The button screen readers focus, for a focus move (FR-037). */
  ref?: Ref<View>;
};

/** The height of the FAB. */
const FAB_HEIGHT = 56;

/**
 * A screen's main action, floating at the bottom end. It is drawn as Paper's extended FAB, but
 * its ref is the button itself, so screen reader focus can be moved back to it (FR-037): Paper's
 * `FAB` gives its ref to a container screen readers skip. The screen's list leaves room for it
 * below its last row (`SCREEN_FAB_CLEARANCE`).
 */
export const ScreenFab = ({ icon, label, onPress, ref }: ScreenFabProps) => {
  const { colors } = useTheme();
  return (
    <Surface
      elevation={3}
      style={[styles.fab, { backgroundColor: colors.primaryContainer }]}
    >
      <TouchableRipple
        ref={ref}
        borderless
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.touchable}
      >
        <View style={styles.content}>
          <Icon source={icon} size={24} color={colors.onPrimaryContainer} />
          <Text
            variant="labelLarge"
            style={{ color: colors.onPrimaryContainer }}
          >
            {label}
          </Text>
        </View>
      </TouchableRipple>
    </Surface>
  );
};

/**
 * Where the app-wide snackbars sit: above the FAB, as Material places them, and above a screen's
 * bottom button, so neither is ever covered.
 */
export const ABOVE_SCREEN_FAB = { bottom: spacing.md + FAB_HEIGHT };

/** The bottom padding a list needs so the FAB never covers its last row. */
export const SCREEN_FAB_CLEARANCE = spacing.xl * 3;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    end: spacing.md,
    bottom: spacing.md,
    borderRadius: spacing.md,
  },
  touchable: { borderRadius: spacing.md },
  content: {
    minHeight: FAB_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
