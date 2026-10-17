import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';

import { useAnnouncement } from '../accessibility/announce';
import { Button } from '../components/Button';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { DeviceDialog } from './DeviceDialog';

export type ForgotPasswordDialogProps = {
  /** The server address typed in SignIn. */
  address: string;
  /** The email typed in SignIn, prefilled. */
  initialEmail: string;
  onClose: () => void;
};

type ResetFailure = Extract<
  Awaited<ReturnType<AppState['requestPasswordReset']>>,
  { ok: false }
>['error'];

/** What the dialog shows once the server accepted the request, whether the account exists or not. */
export const SENT_TEXT =
  "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.";

/** The French text of each way the request can be refused (contracts/ui-screens.md). */
export const resetFailureText = (error: ResetFailure): string | null => {
  switch (error.type) {
    case 'InvalidEmail':
      return 'Saisissez une adresse e-mail valide.';
    case 'InvalidUrl':
      return 'Saisissez une adresse comme courses.example.fr.';
    case 'TooManyAttempts':
      return `Trop de demandes. Réessayez dans ${error.minutesToWait} ${
        error.minutesToWait === 1 ? 'minute' : 'minutes'
      }.`;
    case 'UntrustedServer':
      return "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.";
    case 'UpdateRequired':
      // The sync bar says so.
      return null;
    default:
      return "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.";
  }
};

/** Asks for a new temporary password by email (US4-1, US4-3, US4-4). */
export const ForgotPasswordDialog = ({
  address,
  initialEmail,
  onClose,
}: ForgotPasswordDialogProps) => {
  const requestPasswordReset = useAppStore(
    (state) => state.requestPasswordReset,
  );
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  // Set at once, so a second tap before the next render does not send a second request.
  const sendingRef = useRef(false);

  const submit = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    const outcome = await requestPasswordReset(address, email);
    sendingRef.current = false;
    setSending(false);
    if (outcome.ok) {
      setSent(true);
      return;
    }
    setError(resetFailureText(outcome.error));
  };

  return (
    <ForgotPasswordDialogForm
      email={email}
      onChangeEmail={setEmail}
      error={error}
      sent={sent}
      sending={sending}
      onClose={onClose}
      onSubmit={() => void submit()}
    />
  );
};

export type ForgotPasswordDialogFormProps = {
  email: string;
  onChangeEmail: (email: string) => void;
  error: string | null;
  sent: boolean;
  sending: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

/** The dialog itself, its state given as props so a story can show each outcome. */
export const ForgotPasswordDialogForm = ({
  email,
  onChangeEmail,
  error,
  sent,
  sending,
  onClose,
  onSubmit,
}: ForgotPasswordDialogFormProps) => {
  useAnnouncement(sent ? SENT_TEXT : error);
  return (
    <DeviceDialog
      title="Mot de passe oublié"
      onClose={onClose}
      dismissable={!sending}
      actions={
        sent ? (
          <Button mode="text" onPress={onClose}>
            Fermer
          </Button>
        ) : (
          <>
            <Button mode="text" disabled={sending} onPress={onClose}>
              Annuler
            </Button>
            <Button disabled={sending} mode="brand" onPress={onSubmit}>
              Envoyer
            </Button>
          </>
        )
      }
    >
      <View style={styles.body}>
        {sent ? (
          <Text variant="bodyMedium">{SENT_TEXT}</Text>
        ) : (
          <>
            <Text variant="bodyMedium">
              Saisissez votre adresse e-mail. Si un compte existe, vous recevrez
              un mot de passe temporaire.
            </Text>
            <TextInput
              mode="outlined"
              label="Adresse e-mail"
              accessibilityLabel="Adresse e-mail"
              value={email}
              onChangeText={onChangeEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              error={error !== null}
              disabled={sending}
            />
            {error !== null && <HelperText type="error">{error}</HelperText>}
          </>
        )}
      </View>
    </DeviceDialog>
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
