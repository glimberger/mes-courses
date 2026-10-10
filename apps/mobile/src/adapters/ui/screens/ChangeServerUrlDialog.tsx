import { useRef, useState } from 'react';
import { HelperText, TextInput } from 'react-native-paper';

import { useAnnouncement } from '../accessibility/announce';
import { Button } from '../components/Button';
import type { AppState } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { DeviceDialog } from './DeviceDialog';

export type ChangeServerUrlDialogProps = {
  /** The address now saved, shown without its scheme and prefilled. */
  currentUrl: string;
  onClose: () => void;
};

type ChangeFailure = Extract<
  Awaited<ReturnType<AppState['changeServerUrl']>>,
  { ok: false }
>['error'];

/** The French text of each way the new address can be refused (contracts/ui-screens.md). */
export const changeUrlErrorText = (error: ChangeFailure): string | null => {
  switch (error.type) {
    case 'InvalidUrl':
      return 'Saisissez une adresse comme courses.example.fr.';
    case 'ServerUnreachable':
      return "Impossible de joindre le serveur. Vérifiez l'adresse et votre connexion.";
    case 'UntrustedServer':
      return "La connexion au serveur n'est pas sécurisée. Vérifiez l'adresse ou le certificat du serveur.";
    case 'ServerMismatch':
      return 'Cette adresse ne correspond pas à votre serveur.';
    case 'WriteFailed':
      // The snackbar says so.
      return null;
  }
};

/** Points this device at a new address of the same server; the authorization is kept (FR-016). */
export const ChangeServerUrlDialog = ({
  currentUrl,
  onClose,
}: ChangeServerUrlDialogProps) => {
  const changeServerUrl = useAppStore((state) => state.changeServerUrl);
  const [address, setAddress] = useState(
    currentUrl.replace(/^https?:\/\//, ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const submit = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const outcome = await changeServerUrl(address);
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      onClose();
      return;
    }
    setError(changeUrlErrorText(outcome.error));
  };

  return (
    <ChangeServerUrlDialogForm
      address={address}
      onChangeAddress={setAddress}
      error={error}
      saving={saving}
      onClose={onClose}
      onSubmit={() => void submit()}
    />
  );
};

export type ChangeServerUrlDialogFormProps = {
  address: string;
  onChangeAddress: (text: string) => void;
  /** The French message of the last refusal, announced as it appears (FR-038). */
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

/** The dialog as drawn, its values and callbacks given as props, so a story can show a refusal. */
export const ChangeServerUrlDialogForm = ({
  address,
  onChangeAddress,
  error,
  saving,
  onClose,
  onSubmit,
}: ChangeServerUrlDialogFormProps) => {
  useAnnouncement(error);
  return (
    <DeviceDialog
      title="Modifier l'adresse du serveur"
      onClose={onClose}
      dismissable={!saving}
      actions={
        <>
          <Button disabled={saving} onPress={onClose}>
            Annuler
          </Button>
          <Button disabled={saving} onPress={onSubmit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <TextInput
        mode="outlined"
        label="Adresse du serveur"
        accessibilityLabel="Adresse du serveur"
        placeholder="courses.example.fr"
        value={address}
        onChangeText={onChangeAddress}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={error !== null}
        disabled={saving}
      />
      {error !== null && <HelperText type="error">{error}</HelperText>}
    </DeviceDialog>
  );
};
