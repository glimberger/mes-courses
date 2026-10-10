import { useRef, useState } from 'react';
import { Text } from 'react-native-paper';

import { Button } from '../components/Button';
import { useAppStore } from '../state/use-app-store';
import { DeviceDialog } from './DeviceDialog';

export type DisconnectDialogProps = {
  onClose: () => void;
};

/** Asks before disconnecting this device; its lists stay on it (US4-11). */
export const DisconnectDialog = ({ onClose }: DisconnectDialogProps) => {
  const disconnect = useAppStore((state) => state.disconnect);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const confirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    // A failed save shows its own notice; either way the dialog closes.
    await disconnect();
    savingRef.current = false;
    setSaving(false);
    onClose();
  };

  return (
    <DeviceDialog
      title="Déconnecter cet appareil ?"
      onClose={onClose}
      dismissable={!saving}
      actions={
        <>
          <Button disabled={saving} onPress={onClose}>
            Annuler
          </Button>
          <Button disabled={saving} onPress={() => void confirm()}>
            Déconnecter
          </Button>
        </>
      }
    >
      <Text variant="bodyMedium">
        Vos listes restent sur cet appareil mais ne seront plus synchronisées.
      </Text>
    </DeviceDialog>
  );
};
