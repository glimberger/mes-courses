import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Has screen readers read the text when it appears or changes, not again while it stays the
 * same (FR-038). Nothing is read while it is null.
 */
export const useAnnouncement = (text: string | null): void => {
  useEffect(() => {
    if (text !== null) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
};
