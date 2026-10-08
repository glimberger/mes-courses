import { StyleSheet } from 'react-native';
import { RadioButton } from 'react-native-paper';

/** One choice of a radio group, labelled by its visible text and at least 48 dp high (FR-034). */
export const RadioItem = ({
  label,
  value,
  disabled = false,
}: {
  label: string;
  value: string;
  disabled?: boolean;
}) => (
  <RadioButton.Item
    mode="android"
    label={label}
    value={value}
    disabled={disabled}
    style={styles.target}
  />
);

const styles = StyleSheet.create({
  target: { minHeight: 48 },
});
