import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { Button } from '../components/Button';
import { PasswordField } from '../components/PasswordField';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { DeviceDialog } from './DeviceDialog';
import { signInErrorText } from './SignInScreen';

type DeleteFailure = Extract<
  Awaited<ReturnType<AppState['deleteMyAccount']>>,
  { ok: false }
>['error'];

export const MY_LAST_ADMINISTRATOR =
  'Le seul administrateur ne peut pas supprimer son compte.';

/** The French text of each refusal (contracts/ui-screens.md); `null` when the sync bar says it. */
export const deleteMyAccountErrorText = (
  error: DeleteFailure,
): string | null => {
  switch (error.type) {
    case 'InvalidCredentials':
      return 'Mot de passe incorrect.';
    case 'LastAdministrator':
      return MY_LAST_ADMINISTRATOR;
    case 'TooManyAttempts':
      return signInErrorText(error);
    case 'Offline':
      return 'Connexion au serveur nécessaire.';
    case 'DeviceNotAuthorized':
    case 'AccountDeleted':
    case 'AccountSuspended':
    case 'UpdateRequired':
      return null;
    default:
      return 'Une erreur est survenue. Réessayez.';
  }
};

export type DeleteMyAccountDialogProps = {
  onClose: () => void;
  /** The account is deleted and the device cleared: Settings goes to SignIn. */
  onDeleted: () => void;
};

/** Deletes the account and its data from the server after the password is typed (US6-6, US6-7). */
export const DeleteMyAccountDialog = ({
  onClose,
  onDeleted,
}: DeleteMyAccountDialogProps) => {
  const deleteMyAccount = useAppStore((state) => state.deleteMyAccount);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const confirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const outcome = await deleteMyAccount(password);
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      onClose();
      onDeleted();
      return;
    }
    // A failed erasure shows its own notice (the snackbar).
    setError(
      outcome.error.type === 'WriteFailed'
        ? null
        : deleteMyAccountErrorText(outcome.error),
    );
  };

  return (
    <DeleteMyAccountDialogForm
      password={password}
      onChangePassword={setPassword}
      error={error}
      saving={saving}
      onClose={onClose}
      onConfirm={() => void confirm()}
    />
  );
};

export type DeleteMyAccountDialogFormProps = {
  password: string;
  onChangePassword: (text: string) => void;
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** The dialog itself, its state given as props so a story can show each refusal. */
export const DeleteMyAccountDialogForm = ({
  password,
  onChangePassword,
  error,
  saving,
  onClose,
  onConfirm,
}: DeleteMyAccountDialogFormProps) => {
  const { colors } = useTheme();
  return (
    <DeviceDialog
      title="Supprimer votre compte ?"
      onClose={onClose}
      dismissable={!saving}
      actions={
        <>
          <Button disabled={saving} onPress={onClose}>
            Annuler
          </Button>
          <Button
            disabled={saving}
            textColor={colors.error}
            onPress={onConfirm}
          >
            Supprimer mon compte
          </Button>
        </>
      }
    >
      <View style={styles.body}>
        <Text variant="bodyMedium">
          Votre compte et toutes vos listes seront supprimés du serveur, sans
          retour possible.
        </Text>
        <PasswordField
          label="Mot de passe"
          value={password}
          onChangeText={onChangePassword}
          error={error}
          disabled={saving}
        />
      </View>
    </DeviceDialog>
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
