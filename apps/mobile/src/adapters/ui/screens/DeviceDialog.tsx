import { useEffect, useRef, type ReactNode } from 'react';
import type { HostInstance } from 'react-native';

import { focusOn } from '../accessibility/focus';
import { AppDialog } from '../components/AppDialog';
import type { IconCircleTone } from '../components/IconCircle';

export type DeviceDialogProps = {
  /** The title, which takes screen reader focus when the dialog opens (FR-037). */
  title: string;
  onClose: () => void;
  /** Not closed by a tap outside while a request runs, so its outcome is always shown. */
  dismissable?: boolean;
  /** A Material Symbol name, drawn in a circle above the title. */
  icon?: string | undefined;
  iconTone?: IconCircleTone | undefined;
  /** `centered` for a confirmation about a destructive action. */
  layout?: 'start' | 'centered' | undefined;
  children: ReactNode;
  actions: ReactNode;
};

/**
 * The frame the settings dialogs share, on the mockups' AppDialog: a header title that takes
 * screen reader focus, a body and the buttons. Mount it only while it is open.
 */
export const DeviceDialog = ({
  title,
  onClose,
  dismissable = true,
  icon,
  iconTone,
  layout,
  children,
  actions,
}: DeviceDialogProps) => {
  const titleRef = useRef<HostInstance>(null);
  useEffect(() => {
    focusOn(titleRef);
  }, []);
  return (
    <AppDialog
      visible
      title={title}
      titleRef={titleRef}
      dismissable={dismissable}
      onDismiss={onClose}
      icon={icon}
      iconTone={iconTone}
      layout={layout}
      actions={actions}
    >
      {children}
    </AppDialog>
  );
};
