import type { RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle } from 'react-native';

type Focusable = Parameters<typeof findNodeHandle>[0];

// Paper's dialogs take about 200 ms to open or close; a screen reader cannot focus an element
// that a closing dialog still covers.
const AFTER_TRANSITION_MS = 300;

/**
 * Moves screen reader focus to the element once the layout has settled (FR-037, research R12).
 * Does nothing when the element is gone by then.
 */
export const focusOn = (target: RefObject<Focusable>): void => {
  setTimeout(() => {
    const node = target.current && findNodeHandle(target.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, AFTER_TRANSITION_MS);
};
