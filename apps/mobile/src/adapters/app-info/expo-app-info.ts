import Constants from 'expo-constants';

import {
  UNKNOWN_APP_INFO,
  type AppInfo,
  type AppInfoSource,
} from '../../application/ports/app-info';

/** The identity of the build, read from the Expo config and the build's public variables. */
export class ExpoAppInfo implements AppInfoSource {
  read(): AppInfo {
    const config = Constants.expoConfig;
    const code = config?.android?.versionCode;
    // Expo inlines `EXPO_PUBLIC_` variables only when read as written here.
    const environment = process.env.EXPO_PUBLIC_APP_ENVIRONMENT;
    return {
      version: config?.version || UNKNOWN_APP_INFO.version,
      build: typeof code === 'number' && code > 0 ? code : null,
      environment:
        environment === 'staging' || environment === 'production'
          ? environment
          : null,
    };
  }
}
