import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the keyboard is open on Android, following it as it opens and closes; always false on
 * iOS, where the tab bar stays under the keyboard (research.md, "Pushed screens and the tab bar").
 */
export const useAndroidKeyboardShown = (): boolean => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showing = Keyboard.addListener('keyboardDidShow', () =>
      setShown(true),
    );
    const hiding = Keyboard.addListener('keyboardDidHide', () =>
      setShown(false),
    );
    return () => {
      showing.remove();
      hiding.remove();
    };
  }, []);
  return shown;
};
