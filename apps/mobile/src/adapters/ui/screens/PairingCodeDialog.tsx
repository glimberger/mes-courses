import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native-paper';
import type { PairingCode } from '@mes-courses/sync-core';

import { Button } from '../components/Button';
import { CodeDisplay } from '../components/CodeDisplay';
import { formatClockTime } from '../components/format-last-sync';
import { useAppStore } from '../state/use-app-store';
import { DeviceDialog } from './DeviceDialog';

export type PairingCodeDialogProps = {
  onClose: () => void;
};

type Shown =
  | { type: 'loading' }
  | { type: 'code'; code: PairingCode }
  | { type: 'offline' }
  | { type: 'failed' };

/** "Ajouter un appareil": a one-time code to type on the new device (US4-3). */
export const PairingCodeDialog = ({ onClose }: PairingCodeDialogProps) => {
  const createPairingCode = useAppStore((state) => state.createPairingCode);
  const [shown, setShown] = useState<Shown>({ type: 'loading' });

  useEffect(() => {
    let current = true;
    void createPairingCode().then((outcome) => {
      if (!current) return;
      if (outcome.ok) setShown({ type: 'code', code: outcome.value });
      else {
        setShown({
          type: outcome.error.type === 'Offline' ? 'offline' : 'failed',
        });
      }
    });
    return () => {
      current = false;
    };
  }, [createPairingCode]);

  return (
    <DeviceDialog
      title="Ajouter un appareil"
      onClose={onClose}
      actions={<Button onPress={onClose}>Fermer</Button>}
    >
      <PairingCodeBody shown={shown} />
    </DeviceDialog>
  );
};

const PairingCodeBody = ({ shown }: { shown: Shown }) => {
  switch (shown.type) {
    case 'loading':
      return <ActivityIndicator accessibilityLabel="Chargement" />;
    case 'offline':
      return (
        <Text variant="bodyMedium">
          Connexion au serveur nécessaire pour ajouter un appareil.
        </Text>
      );
    case 'failed':
      return (
        <Text variant="bodyMedium">
          Impossible de créer un code. Réessayez plus tard.
        </Text>
      );
    case 'code':
      return (
        <>
          <Text variant="bodyMedium">
            Sur le nouvel appareil, ouvrez Réglages › Connecter à un serveur et
            saisissez :
          </Text>
          <CodeDisplay code={shown.code.code} />
          <Text variant="bodyMedium">
            {`Valable jusqu'à ${formatClockTime(shown.code.expiresAt)}.`}
          </Text>
        </>
      );
  }
};
