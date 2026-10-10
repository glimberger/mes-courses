import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Snackbar } from 'react-native-paper';

import type { Notice } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { ABOVE_SCREEN_FAB } from './ScreenFab';
import { ABOVE_UNDO_OFFER } from './UndoSnackbar';

const text = (notice: Notice): string => {
  switch (notice.type) {
    case 'writeFailed':
      return "La modification n'a pas pu être enregistrée.";
    case 'storageFull':
      return 'Espace de stockage insuffisant. Libérez de la place sur votre téléphone.';
    case 'articleAdded':
      return `« ${notice.name} » ajouté`;
    case 'deviceConnected':
      return 'Appareil connecté. Synchronisation en cours…';
    case 'articleDeletedElsewhere':
      return 'Cet article a été supprimé sur un autre appareil.';
    case 'itemRemovedElsewhere':
      return 'Cet article a été retiré de la liste sur un autre appareil.';
  }
};

/** The app-wide snackbar for the store's `notice`, rendered once at the root. */
export const NoticeSnackbar = () => {
  const notice = useAppStore((state) => state.notice);
  const dismissNotice = useAppStore((state) => state.dismissNotice);
  const undoOffered = useAppStore((state) => state.pendingUndo !== null);
  // The last notice shown, kept while the snackbar fades out, and numbered so that a notice
  // replacing a visible one gets its own snackbar and its own hide delay.
  const [shown, setShown] = useState<{ notice: Notice; id: number } | null>(
    null,
  );
  if (notice !== null && notice !== shown?.notice) {
    setShown({ notice, id: (shown?.id ?? 0) + 1 });
  }

  // Each new notice is announced as it appears, even one reading like the last (FR-038).
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(text(notice));
  }, [notice]);

  return (
    <Snackbar
      key={shown?.id}
      visible={notice !== null}
      onDismiss={dismissNotice}
      // Announced above on both platforms; a live region would read it a second time on Android.
      accessibilityLiveRegion="none"
      // Stacked above the undo offer, if one shows (a failed write leaves it).
      wrapperStyle={undoOffered ? ABOVE_UNDO_OFFER : ABOVE_SCREEN_FAB}
    >
      {shown ? text(shown.notice) : ''}
    </Snackbar>
  );
};
