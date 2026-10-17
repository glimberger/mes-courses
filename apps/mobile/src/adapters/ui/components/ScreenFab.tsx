import type { Ref } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shadows } from '../theme/elevation';
import { shape } from '../theme/shape';
import { spacing } from '../theme/spacing';
import type { AppTheme } from '../theme/theme';
import { paperRef } from './paper-ref';

export type ScreenFabProps = {
  icon: string;
  /** Shown, and read by screen readers. */
  label: string;
  onPress: () => void;
  /** The button screen readers focus, for a focus move (FR-037). */
  ref?: Ref<HostInstance>;
  testID?: string;
};

// The mockups' FAB measures (`.fab`), off the 4 dp grid.
const FAB_HEIGHT = 56;
const FAB_END = 16;
const FAB_BOTTOM = 24;
const FAB_SIDES = 22;
const FAB_GAP = 9;
const SNACKBAR_GAP = 12;
const ICON_SIZE = 24;

/**
 * A screen's main action, floating at the bottom end: a 56 dp extended button on primaryContainer
 * with the soft fab shadow. Its ref is the button itself, so screen reader focus can be moved back
 * to it (FR-037). The screen's list leaves room for it below its last row (`SCREEN_FAB_CLEARANCE`).
 */
export const ScreenFab = ({
  icon,
  label,
  onPress,
  ref,
  testID,
}: ScreenFabProps) => {
  const theme = useTheme() as AppTheme;
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={[
        styles.fab,
        {
          bottom: FAB_BOTTOM + insets.bottom,
          backgroundColor: colors.primaryContainer,
          boxShadow: shadows(theme).fab,
        },
      ]}
    >
      <TouchableRipple
        ref={paperRef(ref)}
        borderless
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.touchable}
      >
        <View style={styles.content}>
          <Icon
            source={icon}
            size={ICON_SIZE}
            color={colors.onPrimaryContainer}
          />
          <Text
            variant="labelLarge"
            style={{ color: colors.onPrimaryContainer }}
          >
            {label}
          </Text>
        </View>
      </TouchableRipple>
    </View>
  );
};

/**
 * Where the app-wide snackbars sit: above the FAB, as Material places them, and above a screen's
 * bottom button, so neither is ever covered (24 + 56 + 12 dp).
 */
export const ABOVE_SCREEN_FAB = {
  bottom: FAB_BOTTOM + FAB_HEIGHT + SNACKBAR_GAP,
};

/** The bottom padding a list needs so the FAB never covers its last row. */
export const SCREEN_FAB_CLEARANCE = spacing.xl * 3;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    end: FAB_END,
    height: FAB_HEIGHT,
    borderRadius: shape.fab,
  },
  touchable: { borderRadius: shape.fab, flex: 1 },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FAB_GAP,
    paddingHorizontal: FAB_SIDES,
  },
});
