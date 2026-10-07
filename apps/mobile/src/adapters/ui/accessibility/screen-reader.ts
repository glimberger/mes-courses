import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Whether a screen reader (TalkBack, VoiceOver) is on, following the setting as it changes. */
export const useScreenReaderOn = (): boolean => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    // A change heard before the first reading answers is newer than that reading.
    let changed = false;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      // Off is the starting value: setting it again would only draw the component once more.
      if (live && !changed && enabled) setOn(true);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled: boolean) => {
        changed = true;
        setOn(enabled);
      },
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return on;
};
