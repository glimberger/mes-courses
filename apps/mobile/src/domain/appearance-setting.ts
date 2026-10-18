/** How the user wants the app drawn: as the device is set, or always light, or always dark. */
export type AppearanceSetting = 'system' | 'light' | 'dark';

export const APPEARANCE_SETTINGS: readonly AppearanceSetting[] = [
  'system',
  'light',
  'dark',
];

/** What a new install, or a value that cannot be read, falls back to. */
export const DEFAULT_APPEARANCE_SETTING: AppearanceSetting = 'system';

export const isAppearanceSetting = (
  value: unknown,
): value is AppearanceSetting =>
  APPEARANCE_SETTINGS.some((setting) => setting === value);
