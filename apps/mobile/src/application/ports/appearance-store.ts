import type { AppearanceSetting } from '../../domain/appearance-setting';

/**
 * Where the appearance setting is kept on this device. It is synchronous on purpose: the theme
 * must be known on the first render, before the database is open, so the app never shows the
 * wrong theme first.
 */
export interface AppearanceStore {
  /** The stored setting; `system` when none is stored or it cannot be read. */
  read(): AppearanceSetting;
  /** Keeps the setting for the next opening; a failure to store it is not an error to show. */
  write(setting: AppearanceSetting): void;
}
