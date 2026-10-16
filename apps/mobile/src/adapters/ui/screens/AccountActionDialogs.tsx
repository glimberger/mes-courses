import { useRef, useState } from 'react';
import { Text, HelperText, useTheme } from 'react-native-paper';
import type { AccountSummary } from '@mes-courses/sync-core';

import { useAnnouncement } from '../accessibility/announce';
import { Button } from '../components/Button';
import { useAppStore } from '../state/use-app-store';
import { DeviceDialog } from './DeviceDialog';
import { inviteFailureText } from './InviteAccountDialog';

/** The French text of a refused administration action; `null` when the sync bar says it. */
export const accountActionFailureText = (
  type: string,
  lastAdministrator: string,
): string | null => {
  switch (type) {
    case 'LastAdministrator':
      return lastAdministrator;
    case 'MailFailed':
      return inviteFailureText('MailFailed');
    case 'Offline':
      return 'Connexion au serveur nécessaire.';
    case 'DeviceNotAuthorized':
    case 'AccountDeleted':
    case 'UpdateRequired':
      return null;
    default:
      return 'Une erreur est survenue. Réessayez.';
  }
};

export const SUSPEND_LAST_ADMINISTRATOR =
  'Le seul administrateur ne peut pas être suspendu.';
export const DELETE_LAST_ADMINISTRATOR =
  'Le seul administrateur ne peut pas être supprimé.';

type FrameProps = {
  title: string;
  body: string;
  confirm: string;
  /** The confirming button in the error color (a deletion without return). */
  destructive?: boolean;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** The dialog the three actions share, its state given as props so a story can show each one. */
export const AccountActionDialogForm = ({
  title,
  body,
  confirm,
  destructive = false,
  error,
  busy,
  onClose,
  onConfirm,
}: FrameProps) => {
  const { colors } = useTheme();
  useAnnouncement(error);
  return (
    <DeviceDialog
      title={title}
      onClose={onClose}
      dismissable={!busy}
      actions={
        <>
          <Button disabled={busy} onPress={onClose}>
            Annuler
          </Button>
          <Button
            disabled={busy}
            {...(destructive
              ? { textColor: colors.error }
              : {
                  mode: 'contained-tonal',
                  buttonColor: colors.primaryContainer,
                  textColor: colors.onPrimaryContainer,
                })}
            onPress={onConfirm}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <Text variant="bodyMedium">{body}</Text>
      {error !== null && <HelperText type="error">{error}</HelperText>}
    </DeviceDialog>
  );
};

export type AccountActionDialogProps = {
  account: AccountSummary;
  /** `done` is true when the action took effect, so the list loads again. */
  onClose: (done: boolean) => void;
};

/** Runs one action once: a second tap before the next render does nothing. */
const useAction = (
  run: () => Promise<{ ok: true } | { ok: false; error: { type: string } }>,
  lastAdministrator: string,
  onClose: (done: boolean) => void,
) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const submit = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const outcome = await run();
    busyRef.current = false;
    setBusy(false);
    if (outcome.ok) return onClose(true);
    // The account is gone already: the list is what is out of date.
    if (outcome.error.type === 'NotFound') return onClose(true);
    setError(accountActionFailureText(outcome.error.type, lastAdministrator));
  };
  return { error, busy, submit: () => void submit() };
};

export const SuspendAccountDialog = ({
  account,
  onClose,
}: AccountActionDialogProps) => {
  const suspend = useAppStore((state) => state.suspendAccount);
  const { error, busy, submit } = useAction(
    () => suspend(account.id),
    SUSPEND_LAST_ADMINISTRATOR,
    onClose,
  );
  return (
    <AccountActionDialogForm
      title="Suspendre ce compte ?"
      body={`${account.email} ne pourra plus synchroniser. Ses données sont conservées.`}
      confirm="Suspendre"
      error={error}
      busy={busy}
      onClose={() => onClose(false)}
      onConfirm={submit}
    />
  );
};

export const ResendCredentialsDialog = ({
  account,
  onClose,
}: AccountActionDialogProps) => {
  const resend = useAppStore((state) => state.resendCredentials);
  const { error, busy, submit } = useAction(
    () => resend(account.id),
    '',
    onClose,
  );
  return (
    <AccountActionDialogForm
      title="Renvoyer les identifiants ?"
      body={`Un nouveau mot de passe temporaire sera envoyé à ${account.email}. L'ancien ne fonctionnera plus.`}
      confirm="Renvoyer"
      error={error}
      busy={busy}
      onClose={() => onClose(false)}
      onConfirm={submit}
    />
  );
};

export const DeleteAccountDialog = ({
  account,
  onClose,
}: AccountActionDialogProps) => {
  const remove = useAppStore((state) => state.deleteAccountAsAdmin);
  const { error, busy, submit } = useAction(
    () => remove(account.id),
    DELETE_LAST_ADMINISTRATOR,
    onClose,
  );
  return (
    <AccountActionDialogForm
      title="Supprimer ce compte ?"
      body={`Le compte de ${account.email} et toutes ses listes seront supprimés du serveur, sans retour possible.`}
      confirm="Supprimer"
      destructive
      error={error}
      busy={busy}
      onClose={() => onClose(false)}
      onConfirm={submit}
    />
  );
};
