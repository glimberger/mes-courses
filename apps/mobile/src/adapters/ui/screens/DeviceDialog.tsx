import { useEffect, useRef, type ReactNode } from 'react';
import { View, type HostInstance } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';

import { focusOn } from '../accessibility/focus';

export type DeviceDialogProps = {
  /** The title, which takes screen reader focus when the dialog opens (FR-037). */
  title: string;
  onClose: () => void;
  /** Not closed by a tap outside while a request runs, so its outcome is always shown. */
  dismissable?: boolean;
  children: ReactNode;
  actions: ReactNode;
};

/**
 * The frame the device dialogs of Settings share: a header title that takes screen reader focus,
 * a body and the buttons. Mount it only while it is open.
 */
export const DeviceDialog = ({
  title,
  onClose,
  dismissable = true,
  children,
  actions,
}: DeviceDialogProps) => {
  const titleRef = useRef<HostInstance>(null);
  useEffect(() => {
    focusOn(titleRef);
  }, []);
  return (
    <Portal>
      <Dialog
        visible
        dismissable={dismissable}
        onDismiss={onClose}
        overlayAccessibilityLabel="Fermer la boîte de dialogue"
      >
        <View ref={titleRef} accessible accessibilityRole="header">
          <Dialog.Title>{title}</Dialog.Title>
        </View>
        <Dialog.Content>{children}</Dialog.Content>
        <Dialog.Actions>{actions}</Dialog.Actions>
      </Dialog>
    </Portal>
  );
};
