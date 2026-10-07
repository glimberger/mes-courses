import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Whether a screen reader (TalkBack, VoiceOver) is on, following the setting as it changes. */
export const useScreenReaderOn = (): boolean => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      // Off is the starting value: setting it again would only draw the component once more.
      if (live && enabled) setOn(true);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setOn,
    );
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return on;
};
