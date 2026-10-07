import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import type { NameError } from '../../../domain/name';
import { useAnnouncement } from '../accessibility/announce';

/** The French text of the name errors every form shares (contracts/ui-screens.md). */
export const nameErrorText = (error: NameError): string => {
  switch (error.type) {
    case 'NameRequired':
      return 'Indiquez un nom.';
    case 'NameTooLong':
      return 'Le nom ne peut pas dépasser 60 caractères.';
  }
};

export type NameFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** The French error shown under the field, announced as it appears (FR-038). */
  error: string | null;
};

/**
 * The "Nom" field of the forms. It sets no native `maxLength`, which counts UTF-16 units: the
 * 60-character limit is the domain's `NameTooLong` error (research R6).
 */
export const NameField = ({ value, onChangeText, error }: NameFieldProps) => {
  useAnnouncement(error);
  return (
    <View>
      <TextInput
        mode="outlined"
        label="Nom"
        accessibilityLabel="Nom"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="sentences"
        error={error !== null}
      />
      {error !== null && <HelperText type="error">{error}</HelperText>}
    </View>
  );
};
