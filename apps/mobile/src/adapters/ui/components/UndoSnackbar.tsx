import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Snackbar } from 'react-native-paper';

import { useAnnouncement } from '../accessibility/announce';
import { useScreenReaderOn } from '../accessibility/screen-reader';
import type { PendingUndo } from '../state/app-store';
import { useAppStore } from '../state/use-app-store';
import { ABOVE_SCREEN_FAB } from './ScreenFab';

/** The room one snackbar takes: Paper's 48 dp minimum height and its 8 dp margins. */
const SNACKBAR_SPACE = 48 + 2 * 8;

/** Where a notice shown during an undo offer sits: above the offer, never covering it. */
export const ABOVE_UNDO_OFFER = {
  bottom: ABOVE_SCREEN_FAB.bottom + SNACKBAR_SPACE,
};

/** How long "Annuler" is offered, with no screen reader on (FR-010). */
export const UNDO_DELAY_MS = 5000;

const text = (offer: PendingUndo): string =>
  `« ${offer.name} » retiré de la liste`;

/**
 * The app-wide "Annuler" offer for the store's `pendingUndo`, rendered once at the root so it
 * stays across screens (FR-010, contracts/ui-screens.md#undo-offer). Its 5 s count from the
 * removal, by the clock: a timer ends it, and so does coming back to the app or turning the
 * screen reader off once they are over. While a screen reader is on, only the user or the
 * next write ends it.
 */
export const UndoSnackbar = () => {
  const pendingUndo = useAppStore((state) => state.pendingUndo);
  const undo = useAppStore((state) => state.undo);
  const dismissUndo = useAppStore((state) => state.dismissUndo);
  const screenReaderOn = useScreenReaderOn();
  // The last offer shown, kept while the snackbar fades out, and numbered so that an offer
  // replacing a visible one gets its own snackbar.
  const [shown, setShown] = useState<{ offer: PendingUndo; id: number } | null>(
    null,
  );
  if (pendingUndo !== null && pendingUndo !== shown?.offer) {
    setShown({ offer: pendingUndo, id: (shown?.id ?? 0) + 1 });
  }
  // When the offer shown was made: the effect below sees it first, right after the removal.
  const madeAt = useRef<{ offer: PendingUndo; at: number } | null>(null);

  useEffect(() => {
    if (pendingUndo === null) return;
    if (madeAt.current?.offer !== pendingUndo) {
      madeAt.current = { offer: pendingUndo, at: Date.now() };
    }
    if (screenReaderOn) return;
    const deadline = madeAt.current.at + UNDO_DELAY_MS;
    if (Date.now() >= deadline) {
      dismissUndo();
      return;
    }
    // Timers may not run while the app is in the background: the clock is checked again when
    // it comes back.
    const timer = setTimeout(dismissUndo, deadline - Date.now());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() >= deadline) dismissUndo();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [pendingUndo, screenReaderOn, dismissUndo]);

  // Each offer is announced as it appears, with its action (FR-038).
  useAnnouncement(
    pendingUndo === null || shown === null
      ? null
      : `${text(shown.offer)}, Annuler`,
  );

  return (
    <Snackbar
      key={shown?.id}
      visible={pendingUndo !== null}
      onDismiss={dismissUndo}
      // Ended by the effect above, never by the snackbar's own timer.
      duration={Number.POSITIVE_INFINITY}
      action={{ label: 'Annuler', onPress: () => void undo() }}
      // Announced above on both platforms; a live region would read it a second time on Android.
      accessibilityLiveRegion="none"
      wrapperStyle={ABOVE_SCREEN_FAB}
    >
      {shown ? text(shown.offer) : ''}
    </Snackbar>
  );
};
