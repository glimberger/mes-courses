import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { SignedOutReason } from '../../../application/use-cases/synchronize';
import { Button } from '../components/Button';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { DeviceDialog } from './DeviceDialog';

export type SignedOutNoticeDialogProps = {
  reason: SignedOutReason;
  /** The changes that never reached the server and will be lost. */
  pendingCount: number;
  onAcknowledge: () => void;
};

const TEXT = {
  revoked: {
    title: 'Appareil déconnecté',
    body: 'Cet appareil a été retiré de votre compte. Les listes de ce compte vont être effacées de cet appareil.',
  },
  accountDeleted: {
    title: 'Compte supprimé',
    body: 'Ce compte a été supprimé. Les listes de ce compte vont être effacées de cet appareil.',
  },
} as const;

/** The paragraph about changes that can no longer be sent; `null` when there are none. */
export const lostChangesText = (count: number): string | null =>
  count === 0
    ? null
    : count === 1
      ? "1 modification n'a pas pu être envoyée et sera perdue."
      : `${count} modifications n'ont pas pu être envoyées et seront perdues.`;

/**
 * Explains why the server signed this device out and that its local copy is erased (US5-4, US6-5,
 * FR-017). The device cannot send what is waiting, so "Compris" is the only choice.
 */
export const SignedOutNoticeDialog = ({
  reason,
  pendingCount,
  onAcknowledge,
}: SignedOutNoticeDialogProps) => {
  const { title, body } = TEXT[reason];
  const lost = lostChangesText(pendingCount);
  return (
    <DeviceDialog
      title={title}
      onClose={onAcknowledge}
      dismissable={false}
      actions={
        <Button mode="brand" onPress={onAcknowledge}>
          Compris
        </Button>
      }
    >
      <View style={styles.body}>
        <Text variant="bodyMedium">{body}</Text>
        {lost !== null && <Text variant="bodyMedium">{lost}</Text>}
      </View>
    </DeviceDialog>
  );
};

/** Shown above every screen while the server has signed the device out. */
export const SignedOutNotice = () => {
  const connection = useAppStore((state) => state.sync.connection);
  const reason = useAppStore((state) => state.sync.signedOutReason);
  const pendingCount = useAppStore((state) => state.sync.pendingCount);
  const acknowledge = useAppStore((state) => state.acknowledgeSignedOut);
  if (connection !== 'signedOut' || reason === null) return null;
  return (
    <SignedOutNoticeDialog
      reason={reason}
      pendingCount={pendingCount}
      onAcknowledge={() => void acknowledge()}
    />
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
