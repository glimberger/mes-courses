import { useEffect, useRef } from 'react';
import type { HostInstance } from 'react-native';

import { focusOn } from '../accessibility/focus';
import { AppDialog } from '../components/AppDialog';

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
    <AppDialog
      visible={visible}
      onDismiss={onCancel}
      icon="shopping_cart_checkout"
      layout="centered"
      title="Terminer les courses ?"
      titleRef={titleRef}
      message="Tous les articles seront décochés et resteront dans la liste."
      cancel={{ label: 'Annuler', onPress: onCancel }}
      confirm={{ label: 'Terminer', onPress: onConfirm, mode: 'brand' }}
    />
  );
};
