/** Which build of the app is running, as the About row of Settings tells it. */
export type AppInfo = {
  /** The app version (`X.Y.Z`); `0.0.0` when the build does not tell it. */
  version: string;
  /** The build number (the Android `versionCode`); null when the build has none. */
  build: number | null;
  /** The environment the build targets; null when the build does not tell it. */
  environment: 'staging' | 'production' | null;
};

/** What `AppInfo` holds when nothing is known about the build. */
export const UNKNOWN_APP_INFO: AppInfo = {
  version: '0.0.0',
  build: null,
  environment: null,
};

/** Where the identity of the running build is read from. */
export interface AppInfoSource {
  read(): AppInfo;
}
