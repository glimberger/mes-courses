import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Snackbar } from 'react-native-paper';

import type { Notice } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';

const text = (notice: Notice): string => {
  switch (notice.type) {
    case 'writeFailed':
      return "La modification n'a pas pu être enregistrée.";
    case 'storageFull':
      return 'Espace de stockage insuffisant. Libérez de la place sur votre téléphone.';
    case 'articleAdded':
      return `« ${notice.name} » ajouté`;
  }
};

/** The app-wide snackbar for the store's `notice`, rendered once at the root. */
export const NoticeSnackbar = () => {
  const notice = useAppStore((state) => state.notice);
  const dismissNotice = useAppStore((state) => state.dismissNotice);

  // Each new notice is announced as it appears, even one reading like the last (FR-038).
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(text(notice));
  }, [notice]);

  return (
    <Snackbar visible={notice !== null} onDismiss={dismissNotice}>
      {notice ? text(notice) : ''}
    </Snackbar>
  );
};
