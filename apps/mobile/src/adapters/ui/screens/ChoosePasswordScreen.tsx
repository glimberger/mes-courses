import { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PasswordProblem } from '@mes-courses/sync-core';

import { useAnnouncement } from '../accessibility/announce';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { PasswordField } from '../components/PasswordField';
import type { AppNavigation, RootStackParamList } from '../routes';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { signInErrorText } from './SignInScreen';

type ChooseFailure = Extract<
  Awaited<ReturnType<AppState['chooseInitialPassword']>>,
  { ok: false }
>['error'];

/** The French text of each rule a new password can break (contracts/ui-screens.md). */
export const passwordProblemText = (problem: PasswordProblem): string => {
  switch (problem) {
    case 'TooShort':
      return 'Le mot de passe doit contenir au moins 12 caractères.';
    case 'TooLong':
      return 'Le mot de passe ne doit pas dépasser 128 caractères.';
    case 'SameAsTemporary':
      return 'Choisissez un mot de passe différent du mot de passe temporaire.';
    case 'SameAsCurrent':
      return "Choisissez un mot de passe différent de l'actuel.";
  }
};

/** What the screen shows for a refusal, and whether it offers to go back to SignIn. */
export const chooseErrorText = (
  error: ChooseFailure,
): { text: string | null; back: boolean } => {
  switch (error.type) {
    case 'PasswordRejected':
      return { text: passwordProblemText(error.problem), back: false };
    case 'PasswordsDiffer':
      return {
        text: 'Les deux mots de passe ne sont pas identiques.',
        back: false,
      };
    case 'TemporaryPasswordInvalid':
      return {
        text: "Ce mot de passe temporaire n'est plus valable. Reconnectez-vous ou choisissez « Mot de passe oublié ? ».",
        back: true,
      };
    case 'TemporaryPasswordExpired':
      return { text: signInErrorText(error), back: true };
    default:
      return { text: signInErrorText(error), back: false };
  }
};

/**
 * Chooses the password that replaces the temporary one (US2-2). What the person typed on SignIn
 * comes in the route parameters, in memory only; going back keeps nothing.
 */
export const ChoosePasswordScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } =
    useRoute<RouteProp<RootStackParamList, 'ChoosePassword'>>();
  const chooseInitialPassword = useAppStore(
    (state) => state.chooseInitialPassword,
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<ReturnType<typeof chooseErrorText> | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const outcome = await chooseInitialPassword(
      params.url,
      params.email,
      params.temporaryPassword,
      newPassword,
      confirmation,
      params.deviceName,
    );
    setSaving(false);
    if (outcome.ok) {
      // Past SignIn and this screen, then to the current list, in the Courses tab.
      // `pop: true` pops back to CurrentList instead of pushing a second one
      // over a screen the Courses stack still holds, such as AddArticles.
      navigation.popToTop();
      navigation
        .getParent<AppNavigation>()
        ?.navigate('CoursesTab', { screen: 'CurrentList', pop: true });
      return;
    }
    setError(chooseErrorText(outcome.error));
  };

  return (
    <ChoosePasswordForm
      onBack={() => navigation.goBack()}
      newPassword={newPassword}
      onChangeNewPassword={setNewPassword}
      confirmation={confirmation}
      onChangeConfirmation={setConfirmation}
      error={error?.text ?? null}
      canGoBackToSignIn={error?.back ?? false}
      saving={saving}
      onSubmit={() => void submit()}
    />
  );
};

export type ChoosePasswordFormProps = {
  onBack: () => void;
  newPassword: string;
  onChangeNewPassword: (text: string) => void;
  confirmation: string;
  onChangeConfirmation: (text: string) => void;
  /** The French message of the last refusal, announced as it appears (FR-038). */
  error: string | null;
  /** The temporary password cannot work any more: offers "Retour" to SignIn. */
  canGoBackToSignIn: boolean;
  saving: boolean;
  onSubmit: () => void;
};

/** The form of ChoosePassword, its values and callbacks given as props, for the stories. */
export const ChoosePasswordForm = ({
  onBack,
  newPassword,
  onChangeNewPassword,
  confirmation,
  onChangeConfirmation,
  error,
  canGoBackToSignIn,
  saving,
  onSubmit,
}: ChoosePasswordFormProps) => {
  useAnnouncement(error);
  return (
    <KeyboardAvoidingView
      // Android draws edge to edge: the window no longer resizes for the keyboard, so it needs
      // the padding too.
      behavior="padding"
      style={styles.screen}
    >
      <ScreenHeader
        variant="center"
        title="Choisir votre mot de passe"
        onBack={onBack}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        <Text variant="bodyLarge">
          Choisissez un mot de passe d&apos;au moins 12 caractères. Il remplace
          le mot de passe temporaire.
        </Text>
        <PasswordField
          label="Nouveau mot de passe"
          kind="new"
          value={newPassword}
          onChangeText={onChangeNewPassword}
          disabled={saving}
        />
        <PasswordField
          label="Confirmer le mot de passe"
          kind="new"
          value={confirmation}
          onChangeText={onChangeConfirmation}
          disabled={saving}
        />
        {error !== null && <HelperText type="error">{error}</HelperText>}
        {canGoBackToSignIn && (
          <Button mode="outlined" onPress={onBack}>
            Retour
          </Button>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          mode="brand"
          disabled={saving}
          onPress={onSubmit}
          style={styles.submit}
        >
          Enregistrer et continuer
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  form: { padding: spacing.md, gap: spacing.sm },
  footer: { paddingHorizontal: spacing.md },
  submit: { marginVertical: spacing.sm },
});
