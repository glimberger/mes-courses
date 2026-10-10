import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useAppStore } from '../state/use-app-store';

/**
 * Tells a screen reader that the synchronization failed, and that it recovered after a failure
 * (FR-023, research R14). Mounted once above the screens, so the announcement is made once
 * however many of them are open; nothing is announced for the other transitions.
 */
export const SyncAnnouncer = () => {
  const connected = useAppStore(
    (state) => state.sync.connection === 'connected',
  );
  const status = useAppStore((state) => state.sync.status);
  const wasFailed = useRef(false);
  useEffect(() => {
    if (connected && status === 'failed') {
      if (!wasFailed.current) {
        AccessibilityInfo.announceForAccessibility(
          'Échec de la synchronisation',
        );
      }
      wasFailed.current = true;
    } else if (connected && status === 'saved' && wasFailed.current) {
      AccessibilityInfo.announceForAccessibility('Synchronisé');
      wasFailed.current = false;
    }
  }, [connected, status]);
  return null;
};
