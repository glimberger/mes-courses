import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { AppIcon } from '../icons/AppIcon';
import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';

const BOX_SIZE = 24;
const TARGET_SIZE = 48;
const BORDER_WIDTH = 2;
const MARK_SIZE = 17;

/** The box and its mark, drawn from the state alone: rows that are already the checkbox use it. */
export const CheckboxBox = ({
  checked,
  testID,
}: {
  checked: boolean;
  testID?: string | undefined;
}) => {
  const { colors } = useTheme() as AppTheme;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.box,
        checked
          ? {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.onPrimaryContainer,
            }
          : { borderColor: colors.outline },
      ]}
    >
      {checked ? (
        <AppIcon
          name="check"
          weight={700}
          size={MARK_SIZE}
          color={colors.onPrimaryContainer}
        />
      ) : null}
    </View>
  );
};

export type BrandCheckboxProps = {
  checked: boolean;
  onPress: () => void;
  /** The row's name, read by screen readers with the checked state. */
  accessibilityLabel: string;
  testID?: string;
};

/**
 * The mockups' checkbox: a 24 dp box with a 2 dp border, yellow and dark-outlined when checked,
 * inside a 48 dp target. The mark is the weight-700 `check` (styles.css `.checkbox`).
 */
export const BrandCheckbox = ({
  checked,
  onPress,
  accessibilityLabel,
  testID,
}: BrandCheckboxProps) => (
  <Pressable
    accessibilityRole="checkbox"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ checked }}
    onPress={onPress}
    style={styles.target}
  >
    <CheckboxBox checked={checked} testID={testID} />
  </Pressable>
);

const styles = StyleSheet.create({
  target: {
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: shape.checkbox,
    borderWidth: BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
