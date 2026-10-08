import { StyleSheet } from 'react-native';
import { Appbar } from 'react-native-paper';

/**
 * The Appbar's "Retour", grown from Paper's 40 dp to a 48 dp square (FR-034), taking the place of
 * its margins so the title does not move.
 */
export const BackAction = ({ onPress }: { onPress: () => void }) => (
  <Appbar.BackAction
    accessibilityLabel="Retour"
    onPress={onPress}
    style={styles.target}
  />
);

const styles = StyleSheet.create({
  target: { width: 48, height: 48, marginHorizontal: 2 },
});
