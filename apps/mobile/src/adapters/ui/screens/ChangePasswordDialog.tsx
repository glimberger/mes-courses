import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { Button } from '../components/Button';
import { PasswordField } from '../components/PasswordField';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { DeviceDialog } from './DeviceDialog';
import { passwordProblemText } from './ChoosePasswordScreen';
import { signInErrorText } from './SignInScreen';

type ChangeFailure = Extract<
  Awaited<ReturnType<AppState['changePassword']>>,
  { ok: false }
>['error'];

/** What each field of the dialog shows; a refusal belongs to the field that can fix it. */
export type ChangePasswordErrors = {
  current: string | null;
  next: string | null;
  confirmation: string | null;
};

const NO_ERRORS: ChangePasswordErrors = {
  current: null,
  next: null,
  confirmation: null,
};

/** The French text of each refusal, under the field it concerns (contracts/ui-screens.md). */
export const changePasswordErrors = (
  error: ChangeFailure,
): ChangePasswordErrors => {
  switch (error.type) {
    case 'InvalidCredentials':
      return { ...NO_ERRORS, current: 'Mot de passe actuel incorrect.' };
    case 'PasswordRejected':
      return { ...NO_ERRORS, next: passwordProblemText(error.problem) };
    case 'PasswordsDiffer':
      return {
        ...NO_ERRORS,
        confirmation: 'Les deux mots de passe ne sont pas identiques.',
      };
    case 'TooManyAttempts':
      return {
        ...NO_ERRORS,
        current: signInErrorText(error),
      };
    case 'Offline':
      return { ...NO_ERRORS, current: 'Connexion au serveur nécessaire.' };
    case 'DeviceNotAuthorized':
    case 'AccountDeleted':
    case 'AccountSuspended':
    case 'UpdateRequired':
      // The sync bar says so.
      return NO_ERRORS;
    default:
      return { ...NO_ERRORS, current: 'Une erreur est survenue. Réessayez.' };
  }
};

/** Changes the password of the account; the other devices stay signed in (US6-2). */
export const ChangePasswordDialog = ({ onClose }: { onClose: () => void }) => {
  const changePassword = useAppStore((state) => state.changePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<ChangePasswordErrors>(NO_ERRORS);
  const [saving, setSaving] = useState(false);
  // Set at once, so a second tap before the next render does not send a second request.
  const savingRef = useRef(false);

  const submit = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErrors(NO_ERRORS);
    const outcome = await changePassword(current, next, confirmation);
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      // The snackbar says "Mot de passe modifié.".
      onClose();
      return;
    }
    setErrors(changePasswordErrors(outcome.error));
  };

  return (
    <ChangePasswordDialogForm
      current={current}
      onChangeCurrent={setCurrent}
      next={next}
      onChangeNext={setNext}
      confirmation={confirmation}
      onChangeConfirmation={setConfirmation}
      errors={errors}
      saving={saving}
      onClose={onClose}
      onSubmit={() => void submit()}
    />
  );
};

export type ChangePasswordDialogFormProps = {
  current: string;
  onChangeCurrent: (text: string) => void;
  next: string;
  onChangeNext: (text: string) => void;
  confirmation: string;
  onChangeConfirmation: (text: string) => void;
  errors: ChangePasswordErrors;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

/** The dialog itself, its values given as props so a story can show each refusal. */
export const ChangePasswordDialogForm = ({
  current,
  onChangeCurrent,
  next,
  onChangeNext,
  confirmation,
  onChangeConfirmation,
  errors,
  saving,
  onClose,
  onSubmit,
}: ChangePasswordDialogFormProps) => {
  const { colors } = useTheme();
  return (
    <DeviceDialog
      title="Changer de mot de passe"
      onClose={onClose}
      dismissable={!saving}
      actions={
        <>
          <Button disabled={saving} onPress={onClose}>
            Annuler
          </Button>
          <Button
            disabled={saving}
            mode="contained-tonal"
            buttonColor={colors.primaryContainer}
            textColor={colors.onPrimaryContainer}
            onPress={onSubmit}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <View style={styles.body}>
        <PasswordField
          label="Mot de passe actuel"
          value={current}
          onChangeText={onChangeCurrent}
          error={errors.current}
          disabled={saving}
        />
        <PasswordField
          label="Nouveau mot de passe"
          kind="new"
          value={next}
          onChangeText={onChangeNext}
          error={errors.next}
          disabled={saving}
        />
        <PasswordField
          label="Confirmer le mot de passe"
          kind="new"
          value={confirmation}
          onChangeText={onChangeConfirmation}
          error={errors.confirmation}
          disabled={saving}
        />
      </View>
    </DeviceDialog>
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
