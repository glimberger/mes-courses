import type { Ref } from 'react';
import { StyleSheet, type View } from 'react-native';
import { Icon, TouchableRipple, useTheme } from 'react-native-paper';

export type AppbarIconActionProps = {
  icon: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** The button screen readers focus, for a focus move (FR-037). */
  ref?: Ref<View>;
};

/**
 * An Appbar icon action whose ref is the button itself, so screen reader focus can be moved to
 * it (FR-037): Paper's `Appbar.Action` gives its ref to a container screen readers skip. It is
 * 48 dp square (FR-034).
 */
export const AppbarIconAction = ({
  icon,
  accessibilityLabel,
  onPress,
  ref,
}: AppbarIconActionProps) => {
  const { colors } = useTheme();
  return (
    <TouchableRipple
      ref={ref}
      borderless
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.action}
    >
      <Icon source={icon} size={24} color={colors.onSurfaceVariant} />
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  action: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
