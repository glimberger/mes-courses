import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { Button } from '../components/Button';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { DeviceDialog } from './DeviceDialog';

/** The paragraph about changes that would be lost; `null` when none waits (US6-4). */
export const pendingChangesText = (count: number): string | null =>
  count === 0
    ? null
    : count === 1
      ? "1 modification n'a pas encore été envoyée et sera perdue."
      : `${count} modifications n'ont pas encore été envoyées et seront perdues.`;

export type SignOutDialogProps = {
  onClose: () => void;
  /** The device is signed out: Settings goes to SignIn. */
  onSignedOut: () => void;
};

/**
 * Asks before signing this device out (US6-4). The lists leave the device and stay on the
 * account; changes that never reached the server are lost, so the dialog says how many.
 */
export const SignOutDialog = ({ onClose, onSignedOut }: SignOutDialogProps) => {
  const signOut = useAppStore((state) => state.signOut);
  const pendingCount = useAppStore((state) => state.sync.pendingCount);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const confirm = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    // A failed erasure shows its own notice; either way the dialog closes.
    const outcome = await signOut();
    savingRef.current = false;
    setSaving(false);
    onClose();
    if (outcome.ok) onSignedOut();
  };

  return (
    <SignOutDialogView
      pendingCount={pendingCount}
      saving={saving}
      onClose={onClose}
      onConfirm={() => void confirm()}
    />
  );
};

export type SignOutDialogViewProps = {
  pendingCount: number;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** The dialog itself, its state given as props so a story can show the pending changes. */
export const SignOutDialogView = ({
  pendingCount,
  saving,
  onClose,
  onConfirm,
}: SignOutDialogViewProps) => {
  const { colors } = useTheme();
  const lost = pendingChangesText(pendingCount);
  return (
    <DeviceDialog
      title="Se déconnecter de cet appareil ?"
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
            onPress={onConfirm}
          >
            {lost === null ? 'Se déconnecter' : 'Se déconnecter quand même'}
          </Button>
        </>
      }
    >
      <View style={styles.body}>
        <Text variant="bodyMedium">
          Vos listes seront effacées de cet appareil. Elles restent sur votre
          compte.
        </Text>
        {lost !== null && <Text variant="bodyMedium">{lost}</Text>}
      </View>
    </DeviceDialog>
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
