import { useRef, useState } from 'react';

import { validateName } from '../../../domain/name';
import { Button } from '../components/Button';
import { nameErrorText, NameField } from '../components/NameField';
import { useAppStore } from '../state/use-app-store';
import { DeviceDialog } from './DeviceDialog';

export type RenameDeviceDialogProps = {
  device: { id: string; name: string };
  onClose: () => void;
};

/** The French text of a refusal that is not the name's (contracts/ui-screens.md). */
export const deviceFailureText = (type: string): string | null => {
  switch (type) {
    case 'Offline':
      return 'Connexion au serveur nécessaire.';
    case 'NotFound':
      return "Cet appareil n'existe plus.";
    case 'DeviceNotAuthorized':
    case 'UpdateRequired':
      // The sync bar says so.
      return null;
    default:
      return 'Une erreur est survenue. Réessayez.';
  }
};

/** Renames a device (FR-019c); the name follows the same rules as every other name. */
export const RenameDeviceDialog = ({
  device,
  onClose,
}: RenameDeviceDialogProps) => {
  const renameDevice = useAppStore((state) => state.renameDevice);
  const [name, setName] = useState(device.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set at once, so a second tap before the next render does not send a second request.
  const savingRef = useRef(false);

  const submit = async () => {
    if (savingRef.current) return;
    const validated = validateName(name);
    if (!validated.ok) {
      setError(nameErrorText(validated.error));
      return;
    }
    setError(null);
    savingRef.current = true;
    setSaving(true);
    const outcome = await renameDevice(device.id, name);
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      onClose();
      return;
    }
    if (
      outcome.error.type === 'NameRequired' ||
      outcome.error.type === 'NameTooLong'
    ) {
      setError(nameErrorText(outcome.error));
      return;
    }
    setError(deviceFailureText(outcome.error.type));
  };

  return (
    <DeviceDialog
      title="Renommer l'appareil"
      onClose={onClose}
      dismissable={!saving}
      actions={
        <>
          <Button disabled={saving} onPress={onClose}>
            Annuler
          </Button>
          <Button disabled={saving} onPress={() => void submit()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <NameField
        value={name}
        onChangeText={setName}
        error={error}
        disabled={saving}
      />
    </DeviceDialog>
  );
};
