import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { AppIcon } from '../icons/AppIcon';
import type { AppTheme } from '../theme/theme';

const TOGGLE_SIZE = 36;
const ICON_SIZE = 28;

export type AddToggleProps = {
  /** The article is on the list since the add screen opened or was tapped. */
  added: boolean;
  testID?: string;
};

/**
 * What a screen reader says of an article row of the add screen: "Ajouter Carotte", then, once
 * added, "Carotte ajoutée, toucher pour retirer".
 */
export const addToggleLabel = (name: string, added: boolean): string =>
  added ? `${name} ajoutée, toucher pour retirer` : `Ajouter ${name}`;

/**
 * The round toggle at the right of an add-screen row: `add_circle` outline, then `check_circle`
 * filled once added. It is drawn from the state alone: the row that holds it is the button (role,
 * label from `addToggleLabel` and the 48 dp target), as `CheckboxBox` does for the list's rows.
 */
export const AddToggle = ({ added, testID }: AddToggleProps) => {
  const { colors } = useTheme() as AppTheme;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.toggle}
    >
      {added ? (
        <AppIcon
          name="check_circle"
          filled
          size={ICON_SIZE}
          color={colors.onTertiaryContainer}
        />
      ) : (
        <AppIcon name="add_circle" size={ICON_SIZE} color={colors.primary} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toggle: {
    width: TOGGLE_SIZE,
    height: TOGGLE_SIZE,
    borderRadius: TOGGLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
