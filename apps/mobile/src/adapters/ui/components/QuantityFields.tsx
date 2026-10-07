import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import type { QuantityError } from '../../../domain/quantity';
import { useAnnouncement } from '../accessibility/announce';
import { spacing } from '../theme/spacing';

/** The French text of each quantity error (FR-016, contracts/ui-screens.md). */
export const quantityErrorText = (error: QuantityError): string => {
  switch (error.type) {
    case 'AmountNotANumber':
    case 'AmountNotPositive':
      return 'La quantité doit être un nombre positif écrit en chiffres, par exemple 2 ou 1,5.';
    case 'AmountTooPrecise':
      return 'La quantité ne peut pas avoir plus de 3 décimales.';
    case 'AmountTooLarge':
      return 'La quantité ne peut pas dépasser 9999.';
    case 'UnitWithoutAmount':
      return 'Indiquez une quantité pour cette unité.';
    case 'UnitTooLong':
      return "L'unité ne peut pas dépasser 15 caractères.";
  }
};

export type QuantityFieldsProps = {
  amount: string;
  unit: string;
  onChangeAmount: (text: string) => void;
  onChangeUnit: (text: string) => void;
  /** The error of the last check, shown under the field it is about. */
  error: QuantityError | null;
};

/**
 * The optional quantity: an amount typed on the decimal pad and a unit, each with its error
 * in a `HelperText`, announced as it appears (FR-014, FR-016, FR-038). The texts are read by the
 * domain's `parseQuantity`.
 */
export const QuantityFields = ({
  amount,
  unit,
  onChangeAmount,
  onChangeUnit,
  error,
}: QuantityFieldsProps) => {
  const message = error && quantityErrorText(error);
  // A missing amount is asked for under the amount, like every amount error.
  const unitMessage = error?.type === 'UnitTooLong' ? message : null;
  const amountMessage = unitMessage === null ? message : null;
  useAnnouncement(message);

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <TextInput
          mode="outlined"
          label="Quantité"
          accessibilityLabel="Quantité"
          value={amount}
          onChangeText={onChangeAmount}
          inputMode="decimal"
          error={amountMessage !== null}
        />
        {amountMessage !== null && (
          <HelperText type="error">{amountMessage}</HelperText>
        )}
      </View>
      <View style={styles.field}>
        <TextInput
          mode="outlined"
          label="Unité"
          accessibilityLabel="Unité"
          value={unit}
          onChangeText={onChangeUnit}
          autoCapitalize="none"
          error={unitMessage !== null}
        />
        {unitMessage !== null && (
          <HelperText type="error">{unitMessage}</HelperText>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
});
