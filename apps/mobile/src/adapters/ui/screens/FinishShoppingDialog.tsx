import { useEffect, useRef } from 'react';
import { View, type HostInstance } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { focusOn } from '../accessibility/focus';

export type FinishShoppingDialogProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Asks before unticking every item (US1-8, US1-9). Screen reader focus goes to its title when it
 * opens (FR-037); the screen that opened it moves focus back when it closes.
 */
export const FinishShoppingDialog = ({
  visible,
  onCancel,
  onConfirm,
}: FinishShoppingDialogProps) => {
  const titleRef = useRef<HostInstance>(null);
  useEffect(() => {
    if (visible) focusOn(titleRef);
  }, [visible]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        {/* The title read as one header, and the target of the focus move. */}
        <View ref={titleRef} accessible accessibilityRole="header">
          <Dialog.Title>Terminer les courses ?</Dialog.Title>
        </View>
        <Dialog.Content>
          <Text variant="bodyMedium">
            Tous les articles seront décochés et resteront dans la liste.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>Annuler</Button>
          <Button onPress={onConfirm}>Terminer</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};
