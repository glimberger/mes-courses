import Storage from 'expo-sqlite/kv-store';

import type { AppearanceStore } from '../../application/ports/appearance-store';
import {
  DEFAULT_APPEARANCE_SETTING,
  isAppearanceSetting,
  type AppearanceSetting,
} from '../../domain/appearance-setting';

const KEY = 'appearance';

/**
 * The appearance setting in Expo's key-value store, which has a synchronous API and its own
 * database file, so it is readable before the app's database is opened.
 */
export class KvAppearanceStore implements AppearanceStore {
  read(): AppearanceSetting {
    try {
      const stored = Storage.getItemSync(KEY);
      return isAppearanceSetting(stored) ? stored : DEFAULT_APPEARANCE_SETTING;
    } catch {
      return DEFAULT_APPEARANCE_SETTING;
    }
  }

  write(setting: AppearanceSetting): void {
    try {
      Storage.setItemSync(KEY, setting);
    } catch {
      // The choice still applies until the app closes.
    }
  }
}
