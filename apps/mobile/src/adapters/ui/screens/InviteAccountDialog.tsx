import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';

import { useAnnouncement } from '../accessibility/announce';
import { Button } from '../components/Button';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { DeviceDialog } from './DeviceDialog';

export type InviteAccountDialogProps = {
  /** `invited` is true when an invitation was sent, so the list loads again. */
  onClose: (invited: boolean) => void;
};

/** The French text of a refusal (contracts/ui-screens.md, Accounts). */
export const inviteFailureText = (type: string): string | null => {
  switch (type) {
    case 'InvalidEmail':
      return 'Saisissez une adresse e-mail valide.';
    case 'AccountExists':
      return 'Cette adresse a déjà un compte.';
    case 'MailFailed':
      return "L'invitation n'a pas pu être envoyée. Réessayez.";
    case 'Offline':
      return 'Connexion au serveur nécessaire.';
    case 'DeviceNotAuthorized':
    case 'UpdateRequired':
      // The sync bar says so.
      return null;
    default:
      return 'Une erreur est survenue. Réessayez.';
  }
};

/** Invites an address: the person receives an email with a temporary password (US1-1 to US1-4). */
export const InviteAccountDialog = ({ onClose }: InviteAccountDialogProps) => {
  const inviteAccount = useAppStore((state) => state.inviteAccount);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Set at once, so a second tap before the next render does not send a second invitation.
  const sendingRef = useRef(false);

  const submit = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    const outcome = await inviteAccount(email);
    sendingRef.current = false;
    setSending(false);
    if (outcome.ok) {
      onClose(true);
      return;
    }
    setError(inviteFailureText(outcome.error.type));
  };

  return (
    <InviteAccountDialogForm
      email={email}
      onChangeEmail={setEmail}
      error={error}
      sending={sending}
      onClose={() => onClose(false)}
      onSubmit={() => void submit()}
    />
  );
};

export type InviteAccountDialogFormProps = {
  email: string;
  onChangeEmail: (email: string) => void;
  error: string | null;
  sending: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

/** The dialog itself, its state given as props so a story can show each refusal. */
export const InviteAccountDialogForm = ({
  email,
  onChangeEmail,
  error,
  sending,
  onClose,
  onSubmit,
}: InviteAccountDialogFormProps) => {
  useAnnouncement(error);
  return (
    <DeviceDialog
      title="Inviter quelqu'un"
      onClose={onClose}
      dismissable={!sending}
      actions={
        <>
          <Button disabled={sending} onPress={onClose}>
            Annuler
          </Button>
          <Button disabled={sending} onPress={onSubmit}>
            Inviter
          </Button>
        </>
      }
    >
      <View style={styles.body}>
        <Text variant="bodyMedium">
          La personne recevra un e-mail avec un mot de passe temporaire.
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
      </View>
    </DeviceDialog>
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
