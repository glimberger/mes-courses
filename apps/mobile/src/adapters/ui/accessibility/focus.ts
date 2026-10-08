import type { RefObject } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  type HostInstance,
  type View,
} from 'react-native';

// Paper's dialogs take about 200 ms to open or close; a screen reader cannot focus an element
// that a closing dialog still covers.
const AFTER_TRANSITION_MS = 300;

/**
 * Moves screen reader focus to the element once the layout has settled (FR-037, research R12).
 * Does nothing when the element is gone by then.
 */
export const focusOn = (target: RefObject<HostInstance | null>): void => {
  setTimeout(() => {
    const node = target.current && findNodeHandle<typeof View>(target.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, AFTER_TRANSITION_MS);
};
