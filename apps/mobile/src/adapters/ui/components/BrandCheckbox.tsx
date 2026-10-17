import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { AppIcon } from '../icons/AppIcon';
import { shape } from '../theme/shape';
import type { AppTheme } from '../theme/theme';

const BOX_SIZE = 24;
const BORDER_WIDTH = 2;
const MARK_SIZE = 17;

/**
 * The mockups' checkbox box: 24 dp with a 2 dp border, yellow and dark-outlined when checked, the
 * mark being the weight-700 `check` (styles.css `.checkbox`). It is drawn from the state alone:
 * the row that holds it is the checkbox (role, state and the 48 dp target), as in `ListItemRow`.
 */
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

const styles = StyleSheet.create({
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: shape.checkbox,
    borderWidth: BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
