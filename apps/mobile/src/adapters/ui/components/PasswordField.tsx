import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import { useAnnouncement } from '../accessibility/announce';

export type PasswordFieldProps = {
  /** The visible label, also the accessible one ("Mot de passe", "Nouveau mot de passe"…). */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** The French error shown under the field, announced as it appears (FR-038). */
  error?: string | null;
  /** Locks the field, for a form being saved. */
  disabled?: boolean;
  /** Lets the system offer a stored password; a new one asks for a generated password. */
  kind?: 'current' | 'new';
};

/**
 * A password field: the text is hidden, with a toggle to show it. It sets no native `maxLength`,
 * which counts UTF-16 units: the length rules are `validateNewPassword`'s, in code points.
 */
export const PasswordField = ({
  label,
  value,
  onChangeText,
  error = null,
  disabled = false,
  kind = 'current',
}: PasswordFieldProps) => {
  const [shown, setShown] = useState(false);
  useAnnouncement(error);
  return (
    <View>
      <TextInput
        mode="outlined"
        label={label}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={kind === 'new' ? 'new-password' : 'current-password'}
        error={error !== null}
        disabled={disabled}
        right={
          <TextInput.Icon
            icon={shown ? 'eye-off-outline' : 'eye-outline'}
            accessibilityLabel={
              shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
            }
            style={styles.toggle}
            onPress={() => setShown((visible) => !visible)}
          />
        }
      />
      {error !== null && <HelperText type="error">{error}</HelperText>}
    </View>
  );
};

/** Paper draws the icon button 40 dp wide; a finger needs 48 (FR-034). */
const styles = StyleSheet.create({
  toggle: { width: 48, height: 48 },
});
