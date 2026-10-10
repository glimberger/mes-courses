import { useRef, useState } from 'react';
import { HelperText, Text } from 'react-native-paper';

import { useAnnouncement } from '../accessibility/announce';
import { Button } from '../components/Button';
import { useAppStore } from '../state/use-app-store';
import { DeviceDialog } from './DeviceDialog';
import { deviceFailureText } from './RenameDeviceDialog';

export type RevokeDeviceDialogProps = {
  device: { id: string; name: string };
  onClose: () => void;
};

/** Asks before revoking a device (US4-9). Revoking this device is "Déconnecter". */
export const RevokeDeviceDialog = ({
  device,
  onClose,
}: RevokeDeviceDialogProps) => {
  const revokeDevice = useAppStore((state) => state.revokeDevice);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useAnnouncement(error);

  const confirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const outcome = await revokeDevice(device.id);
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      onClose();
      return;
    }
    // A device already revoked elsewhere is gone from the list once it reloads.
    if (outcome.error.type === 'NotFound') {
      onClose();
      return;
    }
    setError(deviceFailureText(outcome.error.type));
  };

  return (
    <DeviceDialog
      title={`Révoquer « ${device.name} » ?`}
      onClose={onClose}
      dismissable={!saving}
      actions={
        <>
          <Button disabled={saving} onPress={onClose}>
            Annuler
          </Button>
          <Button disabled={saving} onPress={() => void confirm()}>
            Révoquer
          </Button>
        </>
      }
    >
      <Text variant="bodyMedium">
        {
          "Cet appareil ne pourra plus synchroniser. Ses données restent sur l'appareil."
        }
      </Text>
      {error !== null && <HelperText type="error">{error}</HelperText>}
    </DeviceDialog>
  );
};
